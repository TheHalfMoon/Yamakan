/**
 * Live title preview entry (W12 / M15). Construction is refused while
 * JASSUB_ENABLED is false. Export/preview parity remains server libass
 * reference stills until H1 native Arabic review signs off.
 *
 * When enabled, JASSUB is constructed with queryFonts:false, pinned fonts
 * only, non-zero libass memory/glyph limits, and locally served worker/wasm
 * (non-threaded). CSP 'wasm-unsafe-eval' remains a separate reviewed change.
 */
import {
  JASSUB_ENABLED,
  jassubCapability,
} from "../../core/preview/jassub-flags.ts";
import { TITLE_FONT } from "../../core/render/fonts.ts";

export { JASSUB_ENABLED, jassubCapability };

/** libass bitmap cache limit (MiB). Non-zero per M15 / W12. */
export const JASSUB_LIBASS_MEMORY_LIMIT_MIB = 64;
/** libass glyph cache entry limit. Non-zero per M15 / W12. */
export const JASSUB_LIBASS_GLYPH_LIMIT = 10_000;

/** Lowercased family key JASSUB uses for availableFonts / defaultFont. */
export const JASSUB_PINNED_FONT_KEY = TITLE_FONT.family.toLowerCase();

export type TitlePreviewFont = {
  family: string;
  /** Same-origin URL or absolute path served by the local service. */
  url: string;
};

export type TitlePreviewOptions = {
  canvas: HTMLCanvasElement;
  /** Local ASS text compiled by Yamakan (Encoding -1). */
  ass: string;
  /** Same-origin font URLs only (pinned OFL set). */
  fonts: readonly TitlePreviewFont[];
  /** Local non-threaded worker URL (served by Yamakan). */
  workerUrl: string;
  /** Local non-threaded wasm URL (served by Yamakan). */
  wasmUrl: string;
};

/**
 * Options passed to `new JASSUB(...)` once enablement is approved.
 * Exported so tests can assert isolation without flipping the flag.
 */
export type JassubConstructOptions = {
  canvas: HTMLCanvasElement;
  subContent: string;
  queryFonts: false;
  defaultFont: string;
  availableFonts: Record<string, string>;
  /**
   * Same-origin font URLs loaded before createTrackMem. Required so the first
   * frame is not drawn before glyphs exist (jassub does not redraw after
   * lazy availableFonts fetch — see worker `_allocFonts` TODO).
   */
  fonts: string[];
  libassMemoryLimit: number;
  libassGlyphLimit: number;
  workerUrl: string;
  wasmUrl: string;
};

function isLocalFontUrl(url: string): boolean {
  if (!url) return false;
  // Same-origin path or relative URL (served by the local service).
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (url.startsWith("./") || url.startsWith("../")) return true;
  try {
    const u = new URL(url);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      (u.hostname === "127.0.0.1" || u.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

function assertPinnedFontsOnly(fonts: readonly TitlePreviewFont[]): void {
  if (!fonts.length) {
    throw new Error(
      "JASSUB title preview requires at least one pinned font URL.",
    );
  }
  for (const font of fonts) {
    if (font.family.toLowerCase() !== JASSUB_PINNED_FONT_KEY) {
      throw new Error(
        `JASSUB title preview refuses non-pinned font family "${font.family}".`,
      );
    }
    if (!isLocalFontUrl(font.url)) {
      throw new Error(
        `JASSUB title preview refuses non-local font URL "${font.url}".`,
      );
    }
  }
}

/**
 * Build the exact JASSUB constructor options Yamakan will use when enabled.
 * Does not instantiate JASSUB and does not consult the feature flag.
 */
export function buildJassubConstructOptions(
  options: TitlePreviewOptions,
): JassubConstructOptions {
  assertPinnedFontsOnly(options.fonts);
  if (!options.workerUrl || !options.wasmUrl) {
    throw new Error(
      "JASSUB title preview requires local workerUrl and wasmUrl.",
    );
  }
  const availableFonts: Record<string, string> = {};
  const fontUrls: string[] = [];
  for (const font of options.fonts) {
    availableFonts[font.family.toLowerCase()] = font.url;
    fontUrls.push(font.url);
  }
  // Never leave Liberation Sans / system fallback in place.
  delete availableFonts["liberation sans"];
  return {
    canvas: options.canvas,
    subContent: options.ass,
    queryFonts: false,
    defaultFont: JASSUB_PINNED_FONT_KEY,
    availableFonts,
    fonts: fontUrls,
    libassMemoryLimit: JASSUB_LIBASS_MEMORY_LIMIT_MIB,
    libassGlyphLimit: JASSUB_LIBASS_GLYPH_LIMIT,
    workerUrl: options.workerUrl,
    wasmUrl: options.wasmUrl,
  };
}

/**
 * Test helper: force option construction while JASSUB_ENABLED stays false.
 * Production callers must use createTitlePreview, which refuses when gated.
 */
export function forceBuildJassubOptionsForTest(
  options: TitlePreviewOptions,
): JassubConstructOptions {
  return buildJassubConstructOptions(options);
}

/**
 * Create a JASSUB-backed title preview. Throws while the feature flag is off.
 * Callers must not catch-and-ignore this to fake availability.
 */
export async function createTitlePreview(
  options: TitlePreviewOptions,
): Promise<never> {
  const cap = jassubCapability();
  if (!JASSUB_ENABLED) {
    throw new Error(
      cap.reason ??
        "JASSUB title preview is unavailable until Q11 and H1 complete.",
    );
  }
  // Enablement path (H1 + Q11 + CSP review) will construct JASSUB here from
  // buildJassubConstructOptions(options). Kept unreachable while gated.
  void buildJassubConstructOptions(options);
  throw new Error(
    "JASSUB_ENABLED is true but live construction is not wired in this build.",
  );
}
