/**
 * What a host has before a real check runs on it (the plan's common contract, rule 6). What a
 * check needs is unmeasured where it says so, and nothing is refused for it here.
 */
import { execFileSync } from "node:child_process";
import { statfsSync } from "node:fs";
import { freemem, loadavg, tmpdir } from "node:os";

// Windows only, and only a reading: null is not known.
const onAcPower = () => {
  if (process.platform !== "win32") return null;
  try {
    const said = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemInformation]::PowerStatus.PowerLineStatus",
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    return said === "Online" ? true : said === "Offline" ? false : null;
  } catch {
    return null;
  }
};

export function readHost() {
  const disk = statfsSync(tmpdir());
  const host = {
    platform: process.platform,
    // GitHub's own machines say so; a person's computer says nothing of itself.
    githubImage: process.env.ImageOS ?? null,
    freeDiskBytes: Number(disk.bavail) * Number(disk.bsize),
    freeMemoryBytes: freemem(),
    onAcPower: onAcPower(),
    // Windows reports none.
    load: process.platform === "win32" ? null : loadavg(),
    need: "unmeasured",
  };
  console.log(JSON.stringify(host));
  return host;
}
