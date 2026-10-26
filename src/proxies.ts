// Edit proxies in the browser (YU-017): while proxies are on, each video
// asset of the open project gets its proxy requested once, and its state is
// followed until it settles. The preview plays a proxy only once it is
// ready; until then, and when proxies are off, it plays the original.
// Export and reference preview never use proxies (the service decides).
import { useEffect, useRef, useState } from "react";

type Call = (
  operation: string,
  parameters: Record<string, unknown>,
) => Promise<unknown>;
export type ProxySummary = {
  ready: ReadonlySet<string>;
  building: number;
  // Assets whose proxy failed or cannot be made: they play the original.
  unavailable: number;
  total: number;
};
const EMPTY: ProxySummary = {
  ready: new Set(),
  building: 0,
  unavailable: 0,
  total: 0,
};
const POLL_MS = 2000;
const MAX_REQUESTS = 5;
const PREFERENCE = "yamakan.editProxies";

// The viewer's choice, kept in this browser only (on by default).
export function proxiesPreferred() {
  try {
    return globalThis.localStorage?.getItem(PREFERENCE) !== "off";
  } catch {
    return true;
  }
}
export function preferProxies(on: boolean) {
  try {
    globalThis.localStorage?.setItem(PREFERENCE, on ? "on" : "off");
  } catch {
    // Not kept: the choice lasts for this page only.
  }
}

const stateOf = (value: unknown) =>
  typeof (value as { state?: unknown } | null)?.state === "string"
    ? (value as { state: string }).state
    : "failed";

export function useEditProxies(
  projectId: string | null,
  videoAssetIds: readonly string[],
  enabled: boolean,
  call: Call,
): ProxySummary {
  const [summary, setSummary] = useState<ProxySummary>(EMPTY);
  const caller = useRef(call);
  caller.current = call;
  // The asset list as a value, so a new array with the same ids is no change.
  const ids = [...new Set(videoAssetIds)].sort().join(",");
  useEffect(() => {
    setSummary(EMPTY);
    if (!enabled || !projectId || !ids) return;
    // Every answer belongs to this project, asset list and choice: a late
    // one after any of them changed (or after unmount) is dropped.
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const assets = ids.split(",");
    // How often each absent proxy has been asked for: a busy service is
    // asked again on later looks, a few times at most.
    const asked = new Map<string, number>();
    const look = async () => {
      const states = new Map<string, string>();
      for (const assetId of assets) {
        let state = stateOf(
          await caller
            .current("yamakan.proxy.status", { projectId, assetId })
            .catch(() => null),
        );
        const times = asked.get(assetId) ?? 0;
        if (state === "absent" && times < MAX_REQUESTS) {
          asked.set(assetId, times + 1);
          // A refusal (busy, no rights) leaves the original playing.
          state = stateOf(
            await caller
              .current("yamakan.proxy.build", { projectId, assetId })
              .catch(() => ({ state: "absent" })),
          );
        } else if (state === "absent") state = "failed";
        if (!current) return;
        states.set(assetId, state);
      }
      const values = [...states.values()];
      setSummary({
        ready: new Set(
          [...states].filter(([, s]) => s === "ready").map(([id]) => id),
        ),
        building: values.filter((s) => s === "queued" || s === "building")
          .length,
        unavailable: values.filter((s) => s === "failed" || s === "unsupported")
          .length,
        total: assets.length,
      });
      // Followed until nothing is underway (a busy queue is asked again).
      if (
        values.some((s) => s === "queued" || s === "building" || s === "absent")
      )
        timer = setTimeout(() => void look(), POLL_MS);
    };
    void look();
    return () => {
      current = false;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, ids, enabled]);
  return summary;
}
