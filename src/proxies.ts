// Edit proxies in the browser (YU-017): while proxies are on, each video
// asset of the open project gets its proxy requested, two at a time, and
// its state is followed until it settles. The preview plays a proxy only
// once it is ready; until then, and when proxies are off, it plays the
// original. Export and reference preview never use proxies (the service
// decides).
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
const POLL_MS = 2000;
// A project's builds asked for at once (the service queues four in all).
const AT_ONCE = 2;
// Looks at one project before following stops (about 20 minutes).
const MAX_LOOKS = 600;
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
    : null;
const underway = (s: string | undefined) => s === "queued" || s === "building";

const summarize = (
  states: ReadonlyMap<string, string>,
  assets: readonly string[],
): ProxySummary => {
  const of = assets.map((id) => states.get(id));
  return {
    ready: new Set(assets.filter((id) => states.get(id) === "ready")),
    building: of.filter(underway).length,
    unavailable: of.filter((s) => s === "failed" || s === "unsupported").length,
    total: assets.length,
  };
};

export function useEditProxies(
  projectId: string | null,
  videoAssetIds: readonly string[],
  enabled: boolean,
  call: Call,
): ProxySummary {
  // What is known of each asset of the open project: kept while assets are
  // added or removed, so an import never sends ready clips back to their
  // originals; forgotten when the project changes or proxies go off.
  const known = useRef<{ project: string | null; states: Map<string, string> }>(
    { project: null, states: new Map() },
  );
  const caller = useRef(call);
  caller.current = call;
  // The asset list as a value, so a new array with the same ids is no change.
  const ids = [...new Set(videoAssetIds)].sort().join(",");
  const assets = ids ? ids.split(",") : [];
  if (!enabled || known.current.project !== projectId)
    known.current = { project: enabled ? projectId : null, states: new Map() };
  const [summary, setSummary] = useState<ProxySummary>(() =>
    summarize(known.current.states, assets),
  );
  useEffect(() => {
    if (!enabled || !projectId || !ids) {
      setSummary(summarize(new Map(), []));
      return;
    }
    // Every answer belongs to this project, asset list and choice: a late
    // one after any of them changed (or after unmount) is dropped.
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const list = ids.split(",");
    const states = known.current.states;
    for (const id of states.keys()) if (!list.includes(id)) states.delete(id);
    setSummary(summarize(states, list));
    let looks = 0;
    const open = (id: string) => {
      const s = states.get(id);
      return (
        underway(s) || s === "absent" || s === "unknown" || s === undefined
      );
    };
    const look = async () => {
      looks++;
      // After the first look, only assets still settling are asked about.
      for (const assetId of looks === 1 ? list : list.filter(open)) {
        const answer = stateOf(
          await caller
            .current("yamakan.proxy.status", { projectId, assetId })
            .catch(() => null),
        );
        if (!current) return;
        // An unanswered look keeps what was known and looks again.
        if (answer) states.set(assetId, answer);
        else if (!states.has(assetId)) states.set(assetId, "unknown");
      }
      // Ask for absent proxies, a few at a time; a refusal (busy, no
      // rights) leaves the original playing and is asked again later.
      for (const assetId of list) {
        if ([...states.values()].filter(underway).length >= AT_ONCE) break;
        if (states.get(assetId) !== "absent") continue;
        const answer = stateOf(
          await caller
            .current("yamakan.proxy.build", { projectId, assetId })
            .catch(() => null),
        );
        if (!current) return;
        if (answer) states.set(assetId, answer);
      }
      setSummary(summarize(states, list));
      if (list.some(open) && looks < MAX_LOOKS)
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
