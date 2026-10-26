// Reference preview (plan T8): the frame at the playhead of the saved
// revision, rendered by the same plan compiler, filtergraph, ASS titles and
// fonts as export. The interactive preview above it is fast but
// approximate; this one is what the export will contain. It always names
// the revision it shows, and says so plainly when there are unsaved edits.
import React, { useEffect, useRef, useState } from "react";
import type { MessageKey } from "./i18n.ts";
import { mediaUrl } from "./session.ts";

type Props = {
  projectId: string;
  revision: number;
  // Frame at the playhead (30 fps edit frames).
  frame: number;
  totalFrames: number;
  unsaved: boolean;
  playing: boolean;
  // Saves the edits, so the reference shows the current timeline.
  onSave: () => void;
  // The interface language's messages.
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const SEGMENT_FRAMES = 60;

export function ReferencePreview(props: Props) {
  const { projectId, revision, totalFrames, unsaved, playing, onSave, t } =
    props;
  const frame = Math.max(0, Math.min(totalFrames - 1, props.frame));
  // Follow the playhead only once it rests, so scrubbing does not queue
  // renders; nothing is requested during playback.
  const [settled, setSettled] = useState(frame);
  useEffect(() => {
    if (playing) return;
    const timer = setTimeout(() => setSettled(frame), 250);
    return () => clearTimeout(timer);
  }, [frame, playing]);
  // The frame shown (by the address it was asked for) and a failure with
  // the service's reason, so a missing font or a full disk is said plainly.
  const [shown, setShown] = useState<{ src: string; url: string } | null>(null);
  const [failure, setFailure] = useState<{
    src: string;
    reason: string | null;
  } | null>(null);
  const shownUrl = useRef<string | null>(null);
  const [segment, setSegment] = useState<string | null>(null);
  const base = mediaUrl(
    `/api/v1/projects/${encodeURIComponent(projectId)}/preview?revision=${revision}`,
  );
  // A failed frame (busy renderer, transient error) is asked for again a
  // few times; the attempt number only changes the address.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [base, settled]);
  const src = `${base}&kind=frame&start=${settled}${attempt ? `&attempt=${attempt}` : ""}`;
  // Each frame is fetched, and a superseded one is abandoned at once (the
  // service then stops a render nobody waits for). The last frame stays
  // up, marked as rendering, until the next one arrives.
  useEffect(() => {
    if (totalFrames < 1) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: { code?: string; message?: string };
          } | null;
          // A busy renderer is asked again; anything else is reported.
          const code = body?.error?.code;
          const busy =
            code === "BUSY" || code === "UNAVAILABLE" || code === undefined;
          setFailure({
            src,
            reason: busy ? null : (body?.error?.message ?? null),
          });
          return;
        }
        const url = URL.createObjectURL(await response.blob());
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }
        if (shownUrl.current) URL.revokeObjectURL(shownUrl.current);
        shownUrl.current = url;
        setShown({ src, url });
      } catch {
        if (!controller.signal.aborted) setFailure({ src, reason: null });
      }
    })();
    return () => controller.abort();
  }, [src, totalFrames]);
  useEffect(
    () => () => {
      if (shownUrl.current) URL.revokeObjectURL(shownUrl.current);
    },
    [],
  );
  const failed = failure?.src === src;
  useEffect(() => {
    if (!failed || failure?.reason || attempt >= 3) return;
    const timer = setTimeout(() => setAttempt((n) => n + 1), 1500);
    return () => clearTimeout(timer);
  }, [failed, failure, attempt]);
  useEffect(() => setSegment(null), [projectId, revision]);
  if (totalFrames < 1)
    return (
      <div
        className="reference"
        role="region"
        aria-label={t("reference.region")}
      >
        <p>{t("reference.empty")}</p>
      </div>
    );
  return (
    <div className="reference" role="region" aria-label={t("reference.region")}>
      <div className="reference-head">
        <strong>{t("reference.title")}</strong>
        <span>
          {t("reference.state", { revision, frame: settled })}
          {unsaved ? ` · ${t("reference.stale")}` : ""}
        </span>
        {unsaved ? (
          <button type="button" onClick={onSave}>
            {t("reference.save")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() =>
            setSegment(
              `${base}&kind=segment&start=${settled}&frames=${SEGMENT_FRAMES}`,
            )
          }
        >
          {t("reference.play")}
        </button>
      </div>
      {segment ? (
        <video
          key={segment}
          src={segment}
          controls
          autoPlay
          aria-label={t("reference.segment")}
          onEnded={() => setSegment(null)}
        />
      ) : (
        shown && (
          <img
            src={shown.url}
            // The address of the frame (for tests and support).
            data-src={src}
            alt={t("reference.alt", { frame: settled, revision })}
            data-state={
              failed ? "error" : shown.src === src ? "ready" : "loading"
            }
          />
        )
      )}
      {shown?.src !== src && !failed && !segment ? (
        <small>{t("reference.rendering")}</small>
      ) : null}
      {failed && !segment ? (
        <small className="error" role="alert">
          {t("reference.failed")}
          {failure?.reason ? ` ${failure.reason}` : ""}
        </small>
      ) : null}
    </div>
  );
}
