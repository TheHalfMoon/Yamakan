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
// A busy or briefly unavailable renderer is asked again, a few times.
const RETRIED = new Set(["BUSY", "UNAVAILABLE"]);
const MAX_ATTEMPTS = 3;
// Refusals whose text is shown as the service wrote it: named, plain
// messages (a missing font, no disk space). Anything else (an internal
// error can carry host details) shows only the general failure.
const SHOWN_REASONS = new Set([
  "VALIDATION",
  "NOT_FOUND",
  "LIMIT_EXCEEDED",
  "CAPABILITY_UNAVAILABLE",
  "RECOVERY_REQUIRED",
]);
const REASON_CHARS = 200;

type Failure = { src: string; retry: boolean; reason: string | null };

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
  const path = `/api/v1/projects/${encodeURIComponent(projectId)}/preview?revision=${revision}`;
  const base = mediaUrl(path);
  // Attempts belong to one frame of one revision: a new frame starts at 0.
  const view = `${base}|${settled}`;
  const [tries, setTries] = useState({ view, n: 0 });
  // Each visit to a frame starts afresh (coming back is not a retry).
  useEffect(
    () => setTries((t) => (t.view === view ? t : { view, n: 0 })),
    [view],
  );
  const attempt = tries.view === view ? tries.n : 0;
  const src = `${base}&kind=frame&start=${settled}${attempt ? `&attempt=${attempt}` : ""}`;
  // The frame shown (for the revision and address it was asked for) and the
  // failure of the frame asked for now, with the service's reason when it
  // is a plain refusal.
  const [shown, setShown] = useState<{
    base: string;
    src: string;
    url: string;
  } | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const shownUrl = useRef<string | null>(null);
  const [segment, setSegment] = useState<string | null>(null);
  // Each frame is fetched, and a superseded one is abandoned at once (the
  // service then stops a render nobody waits for). While the next frame of
  // the same revision renders, the last one stays up, marked as rendering.
  useEffect(() => {
    if (totalFrames < 1) return;
    const controller = new AbortController();
    setFailure(null);
    void (async () => {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: { code?: string; message?: string };
          } | null;
          if (controller.signal.aborted) return;
          const code = body?.error?.code;
          const retry = code === undefined || RETRIED.has(code);
          setFailure({
            src,
            retry,
            reason:
              !retry && SHOWN_REASONS.has(code) && body?.error?.message
                ? body.error.message.slice(0, REASON_CHARS)
                : null,
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
        setShown({ base, src, url });
      } catch {
        if (!controller.signal.aborted)
          setFailure({ src, retry: true, reason: null });
      }
    })();
    return () => controller.abort();
  }, [src, base, totalFrames]);
  // Another revision or project never shows the previous one's frame.
  useEffect(() => {
    if (shown && shown.base !== base) {
      if (shownUrl.current) URL.revokeObjectURL(shownUrl.current);
      shownUrl.current = null;
      setShown(null);
    }
  }, [base, shown]);
  useEffect(
    () => () => {
      if (shownUrl.current) URL.revokeObjectURL(shownUrl.current);
    },
    [],
  );
  const failed = failure?.src === src;
  // Final: a refusal, or a busy renderer after the last attempt. Until then
  // the last frame stays up, marked as rendering.
  const final = failed && (!failure?.retry || attempt >= MAX_ATTEMPTS);
  useEffect(() => {
    if (!failed || !failure?.retry || attempt >= MAX_ATTEMPTS) return;
    const timer = setTimeout(() => setTries({ view, n: attempt + 1 }), 1500);
    return () => clearTimeout(timer);
  }, [failed, failure, attempt, view]);
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
  const current = shown?.base === base ? shown : null;
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
        current &&
        !final && (
          <img
            src={current.url}
            // The frame's address without the media key (tests, support).
            data-src={`${path}&kind=frame&start=${settled}`}
            alt={t("reference.alt", { frame: settled, revision })}
            data-state={current.src === src ? "ready" : "loading"}
            onError={() =>
              setFailure({ src: current.src, retry: true, reason: null })
            }
          />
        )
      )}
      {current?.src !== src && !final && !segment ? (
        <small>{t("reference.rendering")}</small>
      ) : null}
      {final && !segment ? (
        <small className="error" role="alert">
          {t("reference.failed")}
          {failure?.reason ? ` ${failure.reason}` : ""}
        </small>
      ) : null}
    </div>
  );
}
