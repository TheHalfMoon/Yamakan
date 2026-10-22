/**
 * Live title preview entry (W12). Construction is refused while JASSUB_ENABLED is false.
 * Export/preview parity remains server libass reference stills until H1.
 */
import {
  JASSUB_ENABLED,
  jassubCapability,
} from "../../core/preview/jassub-flags.ts";

export { JASSUB_ENABLED, jassubCapability };

export type TitlePreviewOptions = {
  canvas: HTMLCanvasElement;
  /** Local ASS text compiled by Yamakan (Encoding -1). */
  ass: string;
  /** Same-origin font URLs only (pinned OFL set). */
  fonts: readonly { family: string; url: string }[];
};

/**
 * Create a JASSUB-backed title preview. Throws while the feature flag is off.
 * Callers must not catch-and-ignore this to fake availability.
 */
export async function createTitlePreview(
  _options: TitlePreviewOptions,
): Promise<never> {
  const cap = jassubCapability();
  throw new Error(
    cap.reason ??
      "JASSUB title preview is unavailable until Q11 and H1 complete.",
  );
}
