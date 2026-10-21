/** Pinned-font readiness seam: Studio text refuses families outside this set. */
const PINNED = new Set([
  "IBM Plex Sans Arabic",
  "IBM Plex Sans",
]);

export type StudioFontRuntime = {
  ready: Promise<unknown>;
  check(font: string): boolean;
  load(font: string): Promise<unknown>;
};

export function createPinnedFontRuntime(
  base: FontFaceSet | null = typeof document !== "undefined" ? document.fonts : null,
): StudioFontRuntime {
  return {
    ready: base?.ready ?? Promise.resolve(),
    check(font: string) {
      const family = extractFamily(font);
      if (!PINNED.has(family)) return false;
      return base?.check(font) ?? false;
    },
    async load(font: string) {
      const family = extractFamily(font);
      if (!PINNED.has(family)) {
        throw new Error(`Studio font family not pinned: ${family}`);
      }
      if (!base) return;
      return base.load(font);
    },
  };
}

function extractFamily(font: string): string {
  const m = /(?:^| )\s*(?:["']([^"']+)["']|([^,]+))/.exec(font);
  return (m?.[1] ?? m?.[2] ?? font).trim();
}

export function isPinnedStudioFont(family: string): boolean {
  return PINNED.has(family);
}
