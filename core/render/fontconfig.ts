// Fontconfig confinement for FFmpeg/libass (Q3 / R8). Workers see only the
// pinned fonts directory through FONTCONFIG_FILE, not the host font catalog.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PinnedFont } from "./fonts.ts";

const toFontconfigPath = (p: string) => path.resolve(p).replace(/\\/g, "/");

export async function writePinnedFontconfig(
  fontsDir: string,
  confPath: string,
) {
  const dir = toFontconfigPath(fontsDir);
  const cache = toFontconfigPath(path.join(fontsDir, ".fontconfig-cache"));
  await mkdir(path.dirname(confPath), { recursive: true });
  const xml = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${dir}</dir>
  <cachedir>${cache}</cachedir>
</fontconfig>
`;
  await writeFile(confPath, xml, { flag: "wx" });
}

export async function stageTitleFonts(
  dir: string,
  fonts: PinnedFont[],
): Promise<{ fontsDir: string; confPath: string }> {
  const fontsDir = path.join(dir, "fonts");
  await mkdir(fontsDir);
  for (const font of fonts)
    await writeFile(path.join(fontsDir, font.name), font.bytes, { flag: "wx" });
  const confPath = path.join(dir, "fonts.conf");
  await writePinnedFontconfig(fontsDir, confPath);
  return { fontsDir, confPath };
}

export function fontconfigEnv(confPath: string): Record<string, string> {
  return { FONTCONFIG_FILE: path.resolve(confPath) };
}
