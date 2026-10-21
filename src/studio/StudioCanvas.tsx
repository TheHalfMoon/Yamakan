import { useEffect, useRef, useState } from "react";
import { STUDIO_ENABLED, studioCapability } from "./flags.ts";

type Props = {
  /** When true, attempt mount even if STUDIO_ENABLED is false (Q8 measurement). */
  forceMount?: boolean;
};

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
    (async () => {
      try {
        const { createCanvasEngine } = await import("./canvas-engine/engine.ts");
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
          uploadImage: async (blob) => {
            const bmp = await createImageBitmap(blob);
            const meta = {
              height: bmp.height,
              width: bmp.width,
              imageName: `studio-${crypto.randomUUID()}`,
            };
            bmp.close();
            return meta;
          },
          uploadIntermediateImage: async (blob) => {
            const bmp = await createImageBitmap(blob);
            const meta = {
              height: bmp.height,
              width: bmp.width,
              imageName: `tmp-${crypto.randomUUID()}`,
            };
            bmp.close();
            return meta;
          },
          reportError: (report) => {
            setError(String(report.message));
          },
          imageResolver: async () => new Blob(),
          fonts,
        });

        composition.engine.surface.attach(screen, overlay);
        destroy = () => {
          composition.engine.lifecycle.dispose();
        };
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
              style={{ width: "100%", height: "auto", display: "block" }}
            />
            <canvas
              ref={overlayRef}
              width={1024}
              height={1024}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "auto",
                pointerEvents: "none",
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
        <p data-testid="studio-disabled-reason">
          {studioCapability().reason}
        </p>
      ) : null}
    </section>
  );
}
