// A fresh installed Microsoft Edge per attempt, attached over DevTools on
// loopback (no browser download, no hosted browser). run.mjs ends every
// browser recorded in YAMAKAN_E2E_PIDS with its process tree and removes its
// profile once the suite is over.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((path) => existsSync(path));

export async function freshEdge(signal: AbortSignal): Promise<string> {
  if (!EDGE) throw new Error('Microsoft Edge is not installed');
  const profile = mkdtempSync(join(process.env.YAMAKAN_E2E_ROOT || tmpdir(), 'yamakan-ta-edge-'));
  const child = spawn(
    EDGE,
    [
      '--headless=new',
      `--user-data-dir=${profile}`,
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-features=msEdgeSidebarV2,EdgeCollections',
      '--window-size=1440,1050',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const portFile = join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 20_000;
  while (!existsSync(portFile) || readFileSync(portFile, 'utf8').split('\n').length < 2) {
    if (signal.aborted || Date.now() > deadline) throw new Error('Edge did not open DevTools');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const [port, path] = readFileSync(portFile, 'utf8').split('\n');
  const endpoint = `ws://127.0.0.1:${port!.trim()}${path!.trim()}`;
  if (process.env.YAMAKAN_E2E_PIDS && child.pid !== undefined)
    appendFileSync(process.env.YAMAKAN_E2E_PIDS, `${child.pid}\t${profile}\t${endpoint}\n`);
  return endpoint;
}
