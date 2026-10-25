import { useEffect, useRef, useState } from "react";
import { STUDIO_ENABLED, studioCapability } from "./flags.ts";
import { createStudioAssetStore } from "./host/assetStore.ts";
import type { StudioAssetStore } from "./host/assetStore.ts";
import {
  createProjectStudioAssetStore,
  loadStudioDocument,
  saveStudioCanvas,
} from "./host/persistence.ts";
import type { StudioClient, StudioSaveState } from "./host/persistence.ts";
import type { MessageKey } from "../i18n.ts";

type Props = {
  /** When true, attempt mount even if STUDIO_ENABLED is false (Q8 measurement). */
  forceMount?: boolean;
  /** The open project: its Studio document is loaded and saved (YU-011). */
  project?: { id: string; revision: number } | null;
  client?: StudioClient;
  t?: (key: MessageKey) => string;
  /**
   * A save moved `projectId` from `from` to `to`, changing only its
   * documents (the timeline is unchanged).
   */
  onSaved?: (projectId: string, from: number, to: number) => void;
};

/** Q8/Q10 measurement handle exposed only while forceMount is active. */
export type YamakanStudioQ8Handle = {
  setBrushTool: () => void;
  getActiveTool: () => string;
  getLayerPixelEpoch: () => number;
  getDocumentEpoch: () => number;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  /** Replace host canvas with 4096² × 20-layer Q10 fixture; returns geometry. */
  loadQ10Fixture: () => {
    width: number;
    height: number;
    layerCount: number;
    selectedLayerId: string | null;
  };
  getCanvasGeometry: () => {
    width: number;
    height: number;
    layerCount: number;
    selectedLayerId: string | null;
  };
  sampleScreenPixel: (x: number, y: number) => number[] | null;
};

declare global {
  interface Window {
    __yamakanStudioQ8?: YamakanStudioQ8Handle;
  }
}

/**
 * Host shell for the canvas-engine. Talks only through the host port.
 * Real stroke drawing requires STUDIO_ENABLED (or forceMount for Q8).
 */
export function StudioCanvas({
  forceMount = false,
  project = null,
  client,
  t,
  onSaved,
}: Props) {
  const screenRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const [save, setSave] = useState<StudioSaveState | null>(null);
  const [persistence, setPersistence] = useState<boolean | null>(null);
  const [reloads, setReloads] = useState(0);
  // The newest project revision known here (the editor's saves advance it
  // too), read when a save starts.
  const revision = useRef(project?.revision ?? 0);
  revision.current = Math.max(revision.current, project?.revision ?? 0);
  const saver = useRef<(() => Promise<void>) | null>(null);
  const projectId = project?.id ?? null;

  useEffect(() => {
    const cap = studioCapability();
    if (!STUDIO_ENABLED && !forceMount) {
      setStatus(`disabled: ${cap.reason ?? "unavailable"}`);
      return;
    }
    let cancelled = false;
    let destroy: (() => void) | undefined;
    let assets: StudioAssetStore = createStudioAssetStore();
    // A new run starts clean: nothing of the previous project's state stays.
    saver.current = null;
    setSave(null);
    setError(null);
    (async () => {
      try {
        // Everything the run needs is loaded first, so once the engine
        // exists nothing else is awaited before cleanup can dispose it.
        const { createCanvasEngine } =
          await import("./canvas-engine/engine.ts");
        const { createStudioHostPort } = await import("./host/port.ts");
        const {
          canvasFromStudioDocument,
          newStudioSession,
          studioDocumentFromCanvas,
        } = await import("./host/documentStore.ts");
        const { createPinnedFontRuntime } = await import("./host/fonts.ts");
        const { createQ10StudioCanvasState } =
          await import("./host/q10Fixture.ts");
        if (cancelled) return;
        // Project-bound when the service accepts creative documents.
        const enabled =
          projectId && client
            ? Boolean(
                (
                  (await client.call("yamakan.document.capability", {})) as {
                    available: boolean;
                  }
                ).available,
              )
            : false;
        if (cancelled) return;
        setPersistence(projectId && client ? enabled : null);
        if (enabled && projectId && client)
          assets = createProjectStudioAssetStore(client, projectId);
        if (enabled) setSave({ state: "loading" });
        const stored =
          enabled && projectId && client
            ? await loadStudioDocument(client, projectId)
            : null;
        if (cancelled) return;
        let headRevision: number | null = null;
        if (enabled && projectId && client) {
          // Opened (or reloaded after a conflict) against the current head.
          const head = (await client.call("yamakan.project.open", {
            projectId,
          })) as { revision: number };
          if (cancelled) return;
          headRevision = head.revision;
        }
        if (headRevision !== null) revision.current = headRevision;
        const session = newStudioSession("Studio");
        const studioDocument = stored?.document ?? session.document;
        let savedHash = stored?.ref.contentHash ?? null;
        const port = createStudioHostPort(
          canvasFromStudioDocument(studioDocument),
        );
        if (enabled)
          setSave(
            savedHash
              ? { state: "saved", contentHash: savedHash }
              : { state: "new" },
          );
        const fonts = createPinnedFontRuntime();
        const screen = screenRef.current;
        const overlay = overlayRef.current;
        if (!screen || !overlay || cancelled) return;

        const exposeMeasurement = STUDIO_ENABLED || forceMount;
        const composition = createCanvasEngine({
          projectId: session.document.id,
          mutationPort: port,
          uploadImage: (blob) => assets.uploadImage(blob),
          uploadIntermediateImage: (blob) =>
            assets.uploadIntermediateImage(blob),
          reportError: (report) => {
            // The full report (label, cause) goes to the console for diagnosis.
            console.warn("Studio engine:", report);
            setError(String(report.message));
          },
          imageResolver: (imageName, signal) =>
            assets.imageResolver(imageName, signal),
          fonts,
        });

        destroy = () => {
          if (exposeMeasurement && window.__yamakanStudioQ8) {
            delete window.__yamakanStudioQ8;
          }
          composition.engine.lifecycle.dispose();
          assets.dispose();
        };
        composition.engine.surface.attach(screen, overlay);
        if (enabled && projectId && client) {
          // The reference's own id (an agent may have committed it).
          const documentId = stored?.ref.id ?? studioDocument.id;
          saver.current = async () => {
            if (cancelled) return;
            setSave({ state: "saving" });
            try {
              const result = await saveStudioCanvas({
                client,
                projectId,
                expectedRevision: revision.current,
                documentId,
                name: studioDocument.name,
                expectedContentHash: savedHash,
                flush: () => composition.engine.lifecycle.flushPendingUploads(),
                canvas: () => port.getCanvasState(),
                toDocument: (canvas) =>
                  studioDocumentFromCanvas({
                    id: studioDocument.id,
                    name: studioDocument.name,
                    canvas,
                  }),
              });
              const from = revision.current;
              savedHash = result.contentHash;
              if (cancelled) return;
              revision.current = result.project.revision;
              port.clearDirty();
              setSave({ state: "saved", contentHash: result.contentHash });
              onSaved?.(projectId, from, result.project.revision);
            } catch (e) {
              if (cancelled) return;
              const code = (e as { code?: string }).code;
              const message = e instanceof Error ? e.message : String(e);
              setSave(
                code === "REVISION_CONFLICT"
                  ? { state: "conflict", message }
                  : { state: "error", message },
              );
            }
          };
        }
        if (exposeMeasurement) {
          const { interaction, tools, history } = composition.engine;
          const geometryOf = () => {
            const canvas = port.getCanvasState();
            const doc = canvas?.document;
            const layerCount = doc
              ? Object.values(doc.stacks).reduce(
                  (n, roots) => n + roots.length,
                  0,
                )
              : 0;
            return {
              width: doc?.width ?? 0,
              height: doc?.height ?? 0,
              layerCount,
              selectedLayerId: doc?.selectedLayerId ?? null,
            };
          };
          window.__yamakanStudioQ8 = {
            setBrushTool: () => tools.setTool("brush"),
            getActiveTool: () => interaction.get("activeTool"),
            getLayerPixelEpoch: () => interaction.get("layerPixelEpoch"),
            getDocumentEpoch: () => interaction.get("documentEpoch"),
            canUndo: () => interaction.get("canUndo"),
            canRedo: () => interaction.get("canRedo"),
            undo: () => history.undo(),
            redo: () => history.redo(),
            loadQ10Fixture: () => {
              port.replaceCanvas(createQ10StudioCanvasState(4096, 4096, 20));
              return geometryOf();
            },
            getCanvasGeometry: () => geometryOf(),
            sampleScreenPixel: (x, y) => {
              const ctx = screen.getContext("2d");
              if (!ctx) return null;
              const px = ctx.getImageData(
                Math.floor(x),
                Math.floor(y),
                1,
                1,
              ).data;
              return [px[0], px[1], px[2], px[3]];
            },
          };
        }

        if (!cancelled) setStatus("mounted");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [forceMount, projectId, client, reloads]);

  return (
    <section
      data-testid="studio-canvas"
      data-studio-enabled={STUDIO_ENABLED ? "true" : "false"}
      data-studio-force-mount={forceMount ? "true" : "false"}
      data-studio-status={status}
      aria-label="Studio canvas"
    >
      <div
        data-testid="studio-surface"
        style={{ position: "relative", width: "100%", minHeight: 120 }}
      >
        {(STUDIO_ENABLED || forceMount) && (
          <>
            <canvas
              ref={screenRef}
              width={1024}
              height={1024}
              data-testid="studio-screen"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
            <canvas
              ref={overlayRef}
              width={1024}
              height={1024}
              data-testid="studio-overlay"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "auto",
                // Engine binds pointer input to the overlay surface.
                touchAction: "none",
              }}
            />
          </>
        )}
      </div>
      {project && persistence === false ? (
        <p data-testid="studio-save-state" data-state="unavailable">
          {t?.("studio.state.unavailable")}
        </p>
      ) : null}
      {!project && client ? (
        <p data-testid="studio-save-state" data-state="no-project">
          {t?.("studio.noProject")}
        </p>
      ) : null}
      {save ? (
        <div className="studio-persistence">
          <p
            role="status"
            data-testid="studio-save-state"
            data-state={save.state}
            data-content-hash={save.state === "saved" ? save.contentHash : ""}
          >
            {t?.(`studio.state.${save.state}` as MessageKey)}
          </p>
          {save.state === "error" || save.state === "conflict" ? (
            <p data-testid="studio-save-detail">{save.message}</p>
          ) : null}
          {save.state === "conflict" ? (
            <button
              type="button"
              data-testid="studio-reload"
              onClick={() => setReloads((n) => n + 1)}
            >
              {t?.("studio.reload")}
            </button>
          ) : (
            <button
              type="button"
              data-testid="studio-save"
              disabled={save.state === "saving" || save.state === "loading"}
              onClick={() => void saver.current?.()}
            >
              {t?.("studio.save")}
            </button>
          )}
        </div>
      ) : null}
      {error ? (
        <p role="alert" data-testid="studio-error">
          {error}
        </p>
      ) : null}
      {!STUDIO_ENABLED && !forceMount ? (
        <p data-testid="studio-disabled-reason">{studioCapability().reason}</p>
      ) : null}
    </section>
  );
}
