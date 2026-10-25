// YU-011, phase 2: after the service was killed and restarted on the same
// workspace, the project's Studio canvas reopens from the project itself:
// the same saved hash, and the stroke's pixels resolved from stored bitmaps.
import { readFileSync } from "node:fs";
import { test } from "@e2e-dev/web";
import type { Browser } from "@e2e-dev/web";
import { expect } from "e2e";

async function until<T>(
  browser: Browser,
  expression: string,
  what: string,
  ms = 60_000,
): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = (await browser.evaluate(expression)) as T;
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

test("after a service crash the saved Studio canvas reopens with its pixels", async ({
  browser,
  screen,
}) => {
  const saved = JSON.parse(
    readFileSync(process.env.YAMAKAN_E2E_STATE!, "utf8"),
  ) as {
    otherHash: string;
    pixel: number[];
  };
  await browser.goto(process.env.YAMAKAN_E2E_LAUNCH!);
  await until(
    browser,
    `location.hash === ''`,
    "the launch secret to leave the address bar",
  );
  await screen.getByRole("button", /Studio journey Revision/).tap();
  await expect(screen.getByRole("heading", "Studio journey")).toBeVisible();
  await screen.getByRole("button", "Agent tools").tap();
  const hash = await until<string>(
    browser,
    `document.querySelector('[data-testid="studio-save-state"][data-state="saved"]')?.getAttribute('data-content-hash') || null`,
    "the saved Studio canvas",
  );
  expect(hash).toBe(saved.otherHash);
  // The stroke's layer bitmap comes back from the project's object store,
  // asynchronously: the background shows first, so wait for the stroke.
  const pixel = await until<number[]>(
    browser,
    `(() => { const r = document.querySelector('[data-testid="studio-screen"]'); const p = window.__yamakanStudioQ8?.sampleScreenPixel(r.width * 0.5, r.height * 0.5); return p && p.join() === ${JSON.stringify(saved.pixel.join())} ? p : null; })()`,
    "the stroke to be drawn again from stored bitmaps",
  );
  expect(pixel).toEqual(saved.pixel);
});
