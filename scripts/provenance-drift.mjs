import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function resolveSource(source, ledger) {
  const sources = [...new Set(ledger.map((e) => e.source))];
  return sources.find(
    (s) =>
      s === source ||
      s.endsWith(`/${source}`) ||
      s.toLowerCase().includes(source.toLowerCase()),
  );
}

export function loadCloneMap() {
  try {
    const doc = JSON.parse(
      readFileSync("docs/provenance/donor-clones.json", "utf8"),
    );
    return doc.clones ?? {};
  } catch {
    return {};
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readUpstreamAtPin(entry, cloneRoot) {
  if (cloneRoot) {
    const candidates = [
      path.join(cloneRoot, entry.original),
      path.join(cloneRoot, "apps", "web", "src", entry.original),
    ];
    for (const file of candidates) {
      if (existsSync(file)) return readFileSync(file);
    }
    throw new Error(
      `Missing ${entry.original} under clone ${cloneRoot} (expected pin ${entry.sha}).`,
    );
  }
  const [owner, repo] = entry.source.split("/");
  const prefixes = ["", "apps/web/src/"];
  let lastStatus = 0;
  for (const prefix of prefixes) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${entry.sha}/${prefix}${entry.original}`;
    const response = await fetch(url);
    lastStatus = response.status;
    if (response.ok) return Buffer.from(await response.arrayBuffer());
  }
  throw new Error(
    `Could not read ${entry.original} at ${entry.sha} (last HTTP ${lastStatus}).`,
  );
}

export async function diffSource(source, ledger, options = {}) {
  const resolved = resolveSource(source, ledger);
  if (!resolved) throw new Error(`Unknown source: ${source}`);
  const cloneMap = loadCloneMap();
  const cloneRoot =
    options.cloneRoot ??
    cloneMap[resolved] ??
    process.env.YAMAKAN_DONOR_CLONE_ROOT;
  const entries = ledger.filter((e) => e.source === resolved);
  const drifts = [];
  for (const entry of entries) {
    const bytes = await readUpstreamAtPin(entry, cloneRoot);
    const upstreamSha256 = sha256(bytes);
    if (upstreamSha256 !== entry.sha256)
      drifts.push({
        original: entry.original,
        imported: entry.imported,
        expectedSha256: entry.sha256,
        upstreamSha256,
      });
  }
  return {
    source: resolved,
    pin: entries[0]?.sha,
    cloneRoot: cloneRoot ?? "(raw pin fetch)",
    filesChecked: entries.length,
    drifts,
  };
}

async function compareBranch(owner, repo, pin, branch) {
  const url = `https://api.github.com/repos/${owner}/${repo}/compare/${pin}...${branch}`;
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok)
    throw new Error(
      `GitHub compare failed for ${owner}/${repo} (${response.status}).`,
    );
  return response.json();
}

export async function upstreamSource(source, ledger) {
  const resolved = resolveSource(source, ledger);
  if (!resolved) throw new Error(`Unknown source: ${source}`);
  const pin = ledger.find((e) => e.source === resolved)?.sha;
  if (!pin) throw new Error(`No ledger pin for ${resolved}`);
  const [owner, repo] = resolved.split("/");
  let data;
  try {
    data = await compareBranch(owner, repo, pin, "main");
  } catch {
    data = await compareBranch(owner, repo, pin, "master");
  }
  return {
    source: resolved,
    pin,
    status: data.status,
    aheadBy: data.ahead_by ?? 0,
    behindBy: data.behind_by ?? 0,
    commits: (data.commits ?? []).slice(0, 25).map((c) => ({
      sha: c.sha.slice(0, 12),
      title: c.commit.message.split("\n")[0],
    })),
  };
}
