// The project shell (YU-030): three workspaces over one open project, its
// selection, revision history and job tray. Story holds the brief, scene
// and shot cards, Director and the Cinema previs; Edit holds the preview,
// timeline and inspector, with Studio as a panel opened from it; Finish
// holds output, the job and agent tools. A workspace, once shown, stays
// mounted while others are shown, so moving between them never discards a
// draft, a Studio document or a running Director stage. Only the choice of
// workspace is kept (per browser); the project model is unchanged.
import React, { useRef, useState, type ReactNode } from "react";
import type { MessageKey } from "../i18n.ts";

export const WORKSPACES = ["story", "edit", "finish"] as const;
export type Workspace = (typeof WORKSPACES)[number];

const PREFERENCE = "yamakan.workspace";
const SHELL = "yamakan.shell";

// The prior shell (Production and Agent tools), kept behind a bounded flag:
// ?shell=classic, or yamakan.shell=classic in this browser.
export function classicShell() {
  try {
    if (
      new URLSearchParams(globalThis.location?.search).get("shell") ===
      "classic"
    )
      return true;
    return globalThis.localStorage?.getItem(SHELL) === "classic";
  } catch {
    return false;
  }
}

function preferredWorkspace(): Workspace {
  try {
    const saved = globalThis.localStorage?.getItem(PREFERENCE);
    return (WORKSPACES as readonly string[]).includes(saved ?? "")
      ? (saved as Workspace)
      : "edit";
  } catch {
    return "edit";
  }
}

// The open workspace and the ones shown so far (kept mounted).
export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(preferredWorkspace);
  const [visited, setVisited] = useState<ReadonlySet<Workspace>>(
    () => new Set([workspace]),
  );
  const open = (next: Workspace) => {
    setWorkspace(next);
    setVisited((v) => (v.has(next) ? v : new Set([...v, next])));
    try {
      globalThis.localStorage?.setItem(PREFERENCE, next);
    } catch {
      // Not kept: the choice lasts for this page only.
    }
  };
  return { workspace, visited, open };
}

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

// The workspace tabs: arrow keys move between them (mirrored in a
// right-to-left interface), Home and End go to the first and last.
export function WorkspaceTabs(props: {
  workspace: Workspace;
  onOpen: (w: Workspace) => void;
  t: Translate;
  // Shown on the tabs whatever is open, so nothing is happening unseen.
  unsaved: boolean;
  job: string | null;
}) {
  const { workspace, onOpen, t, unsaved, job } = props;
  const tabs = useRef<Partial<Record<Workspace, HTMLButtonElement | null>>>({});
  const move = (to: Workspace) => {
    onOpen(to);
    tabs.current[to]?.focus();
  };
  return (
    <div className="workspaces">
      <div role="tablist" aria-label={t("workspace.label")}>
        {WORKSPACES.map((w, i) => (
          <button
            key={w}
            ref={(el) => {
              tabs.current[w] = el;
            }}
            type="button"
            role="tab"
            id={`workspace-tab-${w}`}
            aria-controls={`workspace-${w}`}
            aria-selected={workspace === w}
            tabIndex={workspace === w ? 0 : -1}
            onClick={() => onOpen(w)}
            onKeyDown={(e) => {
              const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
              const step =
                e.key === "ArrowRight"
                  ? rtl
                    ? -1
                    : 1
                  : e.key === "ArrowLeft"
                    ? rtl
                      ? 1
                      : -1
                    : 0;
              if (step) {
                e.preventDefault();
                move(
                  WORKSPACES[
                    (i + step + WORKSPACES.length) % WORKSPACES.length
                  ],
                );
              } else if (e.key === "Home") {
                e.preventDefault();
                move(WORKSPACES[0]);
              } else if (e.key === "End") {
                e.preventDefault();
                move(WORKSPACES[WORKSPACES.length - 1]);
              }
            }}
          >
            {t(`workspace.${w}`)}
          </button>
        ))}
      </div>
      {unsaved ? (
        <span className="pending" data-testid="shell-unsaved">
          {t("toolbar.unsaved")}
        </span>
      ) : null}
      {job ? (
        <button
          type="button"
          className="job-tray"
          data-testid="job-tray"
          onClick={() => onOpen("finish")}
        >
          {t(`job.${job}` as MessageKey)}
        </button>
      ) : null}
    </div>
  );
}

// One workspace's panel: mounted once first shown, hidden (not removed)
// while another is open.
export function WorkspacePanel(props: {
  id: Workspace;
  workspace: Workspace;
  visited: ReadonlySet<Workspace>;
  t: Translate;
  children: ReactNode;
}) {
  const { id, workspace, visited, t, children } = props;
  return (
    <div
      role="tabpanel"
      id={`workspace-${id}`}
      aria-labelledby={`workspace-tab-${id}`}
      aria-label={t(`workspace.${id}`)}
      hidden={workspace !== id}
      className="workspace-panel"
    >
      {visited.has(id) ? children : null}
    </div>
  );
}
