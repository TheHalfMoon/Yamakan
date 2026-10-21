import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  BUNDLE_FORMAT,
  installVersion,
  readCurrentVersion,
  rollback,
  scaffoldDevBundle,
  switchVersion,
  uninstallBinaries,
  verifyInstalledBinaries,
} from "../scripts/bundle.ts";

const bases: string[] = [];
after(() =>
  Promise.all(bases.map((b) => rm(b, { recursive: true, force: true }))),
);

test("bundle manifest records file hashes and install switches pointer", async () => {
  const bundle = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-src-"));
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-root-"));
  bases.push(bundle, root);
  await scaffoldDevBundle(bundle, "1.0.0-test");
  await installVersion(bundle, "1.0.0-test", root);
  assert.equal(await readCurrentVersion(root), "1.0.0-test");
  await scaffoldDevBundle(bundle, "1.0.1-test");
  await installVersion(bundle, "1.0.1-test", root);
  assert.equal(await readCurrentVersion(root), "1.0.1-test");
  const rolled = await rollback(root, true);
  assert.equal(rolled, "1.0.0-test");
  const manifest = JSON.parse(
    await readFile(path.join(root, "bundle.manifest.json"), "utf8"),
  );
  assert.equal(manifest.format, BUNDLE_FORMAT);
  await verifyInstalledBinaries(root);
  const removed = await uninstallBinaries(root);
  assert.ok(removed.removed.length >= 2);
});

test("downgrade without confirmation is refused", async () => {
  const bundle = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-down-"));
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-down-root-"));
  bases.push(bundle, root);
  await scaffoldDevBundle(bundle, "1.0.0-test");
  await installVersion(bundle, "1.0.0-test", root);
  await scaffoldDevBundle(bundle, "1.0.1-test");
  await installVersion(bundle, "1.0.1-test", root);
  await assert.rejects(() => rollback(root, false), /confirmation/i);
});

test("tampered bundle file fails verification", async () => {
  const bundle = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-tamper-"));
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-tamper-root-"));
  bases.push(bundle, root);
  await scaffoldDevBundle(bundle, "1.0.0-test");
  await installVersion(bundle, "1.0.0-test", root);
  const versionFile = path.join(root, "1.0.0-test", "bundle-version.txt");
  await writeFile(versionFile, "tampered\n", "utf8");
  await assert.rejects(() => verifyInstalledBinaries(root), /hash mismatch/i);
});
