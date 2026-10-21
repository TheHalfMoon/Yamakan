import { useEffect, useRef, useState } from "react";
import { STUDIO_ENABLED, studioCapability } from "./flags.ts";
import { createStudioAssetStore } from "./host/assetStore.ts";

type Props = {
  /** When true, attempt mount even if STUDIO_ENABLED is false (Q8 measurement). */
  forceMount?: boolean;
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
export function StudioCanvas({ forceMount = false }: Props) {
  const screenRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cap = studioCapability();
    if (!STUDIO_ENABLED && !forceMount) {
      setStatus(`disabled: ${cap.reason ?? "unavailable"}`);
      return;
    }
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const assets = createStudioAssetStore();
    (async () => {
      try {
        const { createCanvasEngine } =
          await import("./canvas-engine/engine.ts");
        const { createStudioHostPort } = await import("./host/port.ts");
        const { canvasFromStudioDocument, newStudioSession } =
          await import("./host/documentStore.ts");
        const { createPinnedFontRuntime } = await import("./host/fonts.ts");
        const session = newStudioSession("Studio");
        const port = createStudioHostPort(
          canvasFromStudioDocument(session.document),
        );
        const fonts = createPinnedFontRuntime();
        const screen = screenRef.current;
        const overlay = overlayRef.current;
        if (!screen || !overlay || cancelled) return;

        const composition = createCanvasEngine({
          projectId: session.document.id,
          mutationPort: port,
          uploadImage: (blob) => assets.uploadImage(blob),
          uploadIntermediateImage: (blob) =>
            assets.uploadIntermediateImage(blob),
          reportError: (report) => {
            setError(String(report.message));
          },
          imageResolver: (imageName, signal) =>
            assets.imageResolver(imageName, signal),
          fonts,
        });

        composition.engine.surface.attach(screen, overlay);
        const exposeMeasurement = STUDIO_ENABLED || forceMount;
        destroy = () => {
          if (exposeMeasurement && window.__yamakanStudioQ8) {
            delete window.__yamakanStudioQ8;
          }
          composition.engine.lifecycle.dispose();
          assets.dispose();
        };

        if (exposeMeasurement) {
          const { interaction, tools, history } = composition.engine;
          const { createQ10StudioCanvasState } =
            await import("./host/q10Fixture.ts");
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
  }, [forceMount]);

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
