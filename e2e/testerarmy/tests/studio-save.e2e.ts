// YU-011, phase 1: create a project, draw a real brush stroke on the Studio
// canvas, save it to the project, and survive a conflicting save from
// another writer. run.mjs then kills the service and starts phase 2.
import { writeFileSync } from 'node:fs';
import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';

const state = process.env.YAMAKAN_E2E_STATE ?? '';

// Polls a page expression until it returns a truthy JSON value.
async function until<T>(browser: Browser, expression: string, what: string, ms = 60_000): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = (await browser.evaluate(expression)) as T;
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}
const saveState = `document.querySelector('[data-testid="studio-save-state"]')?.getAttribute('data-state') ?? null`;
const savedHash = `document.querySelector('[data-testid="studio-save-state"][data-state="saved"]')?.getAttribute('data-content-hash') || null`;

test('a Studio stroke is saved to the project and a conflicting save is caught', async ({ browser, screen }) => {
  await browser.goto(process.env.YAMAKAN_E2E_LAUNCH!);
  await until(browser, `location.hash === ''`, 'the launch secret to leave the address bar');
  await screen.getByLabel('Project name', { exact: true }).fill('Studio journey');
  await screen.getByRole('button', 'Create project').tap();
  await expect(screen.getByRole('heading', 'Studio journey')).toBeVisible();
  await screen.getByRole('tab', 'Edit').tap();
  await screen.getByRole('button', 'Open Studio').tap();
  await until(browser, `${saveState} === 'new'`, 'a new, unsaved Studio canvas');
  await until(
    browser,
    `document.querySelector('[data-testid="studio-canvas"]')?.getAttribute('data-studio-status') === 'mounted' && Boolean(window.__yamakanStudioQ8)`,
    'the Studio engine to mount',
  );

  // A real brush stroke with the pointer, across the canvas.
  await browser.evaluate(`window.__yamakanStudioQ8.setBrushTool()`);
  const box = (await browser.evaluate(
    `(() => { const r = document.querySelector('[data-testid="studio-overlay"]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`,
  )) as { x: number; y: number; w: number; h: number };
  const at = (fx: number, fy: number) => [box.x + box.w * fx, box.y + box.h * fy] as const;
  const epoch = (await browser.evaluate(`window.__yamakanStudioQ8.getLayerPixelEpoch()`)) as number;
  await browser.mouse.move(...at(0.3, 0.3));
  await browser.mouse.down();
  for (let i = 1; i <= 24; i++) await browser.mouse.move(...at(0.3 + (0.4 * i) / 24, 0.3 + (0.4 * i) / 24));
  await browser.mouse.up();
  await until(browser, `window.__yamakanStudioQ8.getLayerPixelEpoch() > ${epoch}`, 'the stroke to paint');
  const pixel = (await until<number[]>(
    browser,
    `(() => { const r = document.querySelector('[data-testid="studio-screen"]'); const c = r.getBoundingClientRect(); const p = window.__yamakanStudioQ8.sampleScreenPixel(r.width * 0.5, r.height * 0.5); return p && p[3] > 0 ? p : null; })()`,
    'painted pixels at the stroke',
  )) as number[];

  await screen.getByTestId('studio-save').tap();
  const first = await until<string>(browser, savedHash, 'the first save');

  // Another writer saves this canvas first (same project, through the API
  // with this page's own session): this window's next save must conflict.
  const other = (await browser.evaluate(`(async () => {
    const session = JSON.parse(sessionStorage.getItem('yamakan.session')).session;
    const headers = { 'Content-Type': 'application/json', 'X-Yamakan-Session': session };
    const call = async (operation, parameters) => {
      const r = await fetch('/api/v1/call', { method: 'POST', headers, body: JSON.stringify({ apiVersion: 1, operation, parameters }) });
      const v = await r.json();
      if (!r.ok || v.error) throw new Error(operation + ': ' + JSON.stringify(v.error ?? v));
      return v.result;
    };
    const [p] = await call('yamakan.project.list', {});
    const project = await call('yamakan.project.open', { projectId: p.id });
    const [ref] = await call('yamakan.document.list', { projectId: p.id });
    const doc = (await call('yamakan.document.get', { projectId: p.id, documentId: ref.id })).content;
    doc.name = 'Saved by another window';
    const body = new TextEncoder().encode(JSON.stringify(doc));
    const digest = await crypto.subtle.digest('SHA-256', body);
    const sha = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const stagedResponse = await fetch('/api/v1/projects/' + p.id + '/documents/stage', {
      method: 'POST',
      headers: { ...headers, 'X-Request-Id': crypto.randomUUID(), 'X-Content-SHA256': sha, 'X-Document-Kind': 'studio', 'X-Document-Schema-Version': '1' },
      body,
    });
    const staged = await stagedResponse.json();
    if (!stagedResponse.ok) throw new Error('stage: ' + JSON.stringify(staged));
    const committed = await call('yamakan.document.commit', {
      projectId: p.id, expectedRevision: project.revision, documentId: ref.id, kind: 'studio', schemaVersion: 1,
      expectedContentHash: ref.contentHash, source: { stagedUploadId: staged.stagedUploadId, contentHash: staged.contentHash },
    });
    return { projectId: p.id, documentId: ref.id, otherHash: committed.document.contentHash };
  })()`)) as { projectId: string; documentId: string; otherHash: string };
  expect(other.otherHash).not.toBe(first);

  await screen.getByTestId('studio-save').tap();
  await until(browser, `${saveState} === 'conflict'`, 'the conflicting save to be refused');
  await screen.getByTestId('studio-reload').tap();
  const reloaded = await until<string>(browser, savedHash, 'the reloaded canvas');
  expect(reloaded).toBe(other.otherHash);

  writeFileSync(state, JSON.stringify({ ...other, firstHash: first, pixel }));
});
