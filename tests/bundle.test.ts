import test, { after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  BUNDLE_FORMAT,
  installVersion,
  readCurrentVersion,
  rollback,
  scaffoldDevBundle,
  installDevBundle,
  uninstallBinaries,
  resolvePinnedMediaTools,
  resolvePinnedNode,
  verifyInstalledBinaries,
} from "../scripts/bundle.ts";

const bases: string[] = [];
after(() =>
  Promise.all(bases.map((b) => rm(b, { recursive: true, force: true }))),
);

test("pinned node and media tools match manifest hashes", async () => {
  const pinned = await resolvePinnedMediaTools();
  const node = await resolvePinnedNode();
  const bundle = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-pin-"));
  bases.push(bundle);
  const manifest = await scaffoldDevBundle(bundle, "pin-test");
  assert.equal(manifest.pinned.node.sha256, node.sha256);
  assert.equal(manifest.pinned.ffmpeg.sha256, pinned.ffmpeg.sha256);
  assert.equal(manifest.pinned.ffprobe.sha256, pinned.ffprobe.sha256);
  assert.ok(manifest.files.some((f) => f.path === "node/node.exe"));
  assert.ok(
    manifest.files.some(
      (f) => f.path === "fonts/IBMPlexSansArabic-Regular.ttf",
    ),
  );
});

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

test("uninstall does not follow a junction inside the version folder", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows junction uninstall");
    return;
  }
  const bundle = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-junc-"));
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-junc-root-"));
  const outside = await mkdtemp(
    path.join(tmpdir(), "yamakan-bundle-junc-out-"),
  );
  bases.push(bundle, root, outside);
  await writeFile(path.join(outside, "keep.txt"), "survive\n", "utf8");
  await scaffoldDevBundle(bundle, "1.0.0-test");
  await installVersion(bundle, "1.0.0-test", root);
  const versionDir = path.join(root, "1.0.0-test");
  await mkdir(path.join(versionDir, "trap"), { recursive: true });
  await symlink(outside, path.join(versionDir, "trap", "link"), "junction");
  await uninstallBinaries(root);
  assert.equal(
    await readFile(path.join(outside, "keep.txt"), "utf8"),
    "survive\n",
  );
});

test("install-dev scaffolds into LOCALAPPDATA and verifies", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "yamakan-bundle-install-dev-"),
  );
  bases.push(root);
  const manifest = await installDevBundle("install-dev-test", root);
  assert.equal(manifest.version, "install-dev-test");
  await verifyInstalledBinaries(root);
});

test("tampered bundle file fails verification", async () => {
  const bundle = await mkdtemp(path.join(tmpdir(), "yamakan-bundle-tamper-"));
  const root = await mkdtemp(
    path.join(tmpdir(), "yamakan-bundle-tamper-root-"),
  );
  bases.push(bundle, root);
  await scaffoldDevBundle(bundle, "1.0.0-test");
  await installVersion(bundle, "1.0.0-test", root);
  const versionFile = path.join(root, "1.0.0-test", "bundle-version.txt");
  await writeFile(versionFile, "tampered\n", "utf8");
  await assert.rejects(() => verifyInstalledBinaries(root), /hash mismatch/i);
});
