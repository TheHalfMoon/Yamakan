import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  UNSIGNED_RC_MARKER,
  assertSafeUnsignedRcInstallRoot,
  installUnsignedRcFromLayout,
  installUnsignedRcFromZip,
  launchVerifyUnsignedRc,
  packUnsignedRc,
  readCurrentVersion,
  rollback,
  uninstallBinaries,
  verifyInstalledBinaries,
} from "../scripts/bundle.ts";

const bases: string[] = [];
after(() =>
  Promise.all(bases.map((b) => rm(b, { recursive: true, force: true }))),
);

test("assertSafeUnsignedRcInstallRoot refuses Program Files", () => {
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  assert.throws(
    () => assertSafeUnsignedRcInstallRoot(path.join(pf, "Yamakan")),
    /protected system path/i,
  );
});

test("packUnsignedRc writes marker and layout (and zip on Windows)", async () => {
  const outBase = await mkdtemp(
    path.join(tmpdir(), "yamakan-unsigned-rc-pack-"),
  );
  bases.push(outBase);
  const artifact = await packUnsignedRc("1.0.0-unsigned-rc", outBase);
  assert.equal(artifact.kind, "unsigned-rc");
  assert.equal(artifact.claims.release, false);
  assert.equal(artifact.claims.signed, false);
  assert.equal(artifact.claims.profileA, false);
  const marker = await readFile(
    path.join(artifact.layoutDir, UNSIGNED_RC_MARKER),
    "utf8",
  );
  assert.match(marker, /NOT a public release/i);
  assert.match(marker, /NOT code-signed/i);
  assert.ok(artifact.manifest.files.some((f) => f.path === UNSIGNED_RC_MARKER));
  if (process.platform === "win32") {
    assert.ok(artifact.zipPath);
    const zipStat = await stat(artifact.zipPath!);
    assert.ok(zipStat.isFile());
    assert.ok(zipStat.size > 0);
  } else {
    assert.equal(artifact.zipPath, null);
  }
});

test("unsigned RC install → launch-verify → update → rollback → uninstall", async () => {
  const outBase = await mkdtemp(
    path.join(tmpdir(), "yamakan-unsigned-rc-life-"),
  );
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-unsigned-rc-root-"));
  bases.push(outBase, root);

  const v1 = await packUnsignedRc(
    "1.0.0-unsigned-rc",
    path.join(outBase, "v1"),
  );
  await installUnsignedRcFromLayout(v1.layoutDir, "1.0.0-unsigned-rc", root);
  assert.equal(await readCurrentVersion(root), "1.0.0-unsigned-rc");
  await launchVerifyUnsignedRc(root);

  const v2 = await packUnsignedRc(
    "1.0.1-unsigned-rc",
    path.join(outBase, "v2"),
  );
  await installUnsignedRcFromLayout(v2.layoutDir, "1.0.1-unsigned-rc", root);
  assert.equal(await readCurrentVersion(root), "1.0.1-unsigned-rc");
  await verifyInstalledBinaries(root);

  const rolled = await rollback(root, true);
  assert.equal(rolled, "1.0.0-unsigned-rc");
  await launchVerifyUnsignedRc(root);

  const removed = await uninstallBinaries(root);
  assert.ok(removed.removed.length >= 2);
  assert.equal(await readCurrentVersion(root), null);
});

test("unsigned RC zip install round-trip (Windows)", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows ZIP pack/extract");
    return;
  }
  const outBase = await mkdtemp(
    path.join(tmpdir(), "yamakan-unsigned-rc-zip-"),
  );
  const root = await mkdtemp(
    path.join(tmpdir(), "yamakan-unsigned-rc-zip-root-"),
  );
  bases.push(outBase, root);
  const artifact = await packUnsignedRc("2.0.0-unsigned-rc", outBase);
  assert.ok(artifact.zipPath);
  await installUnsignedRcFromZip(artifact.zipPath!, "2.0.0-unsigned-rc", root);
  assert.equal(await readCurrentVersion(root), "2.0.0-unsigned-rc");
  await launchVerifyUnsignedRc(root);
  await uninstallBinaries(root);
});

test("installUnsignedRcFromLayout refuses missing marker", async () => {
  const layout = await mkdtemp(
    path.join(tmpdir(), "yamakan-unsigned-rc-nomarker-"),
  );
  const root = await mkdtemp(
    path.join(tmpdir(), "yamakan-unsigned-rc-nomarker-root-"),
  );
  bases.push(layout, root);
  // scaffold without marker via pack then delete marker would work; empty dir is enough
  await assert.rejects(
    () => installUnsignedRcFromLayout(layout, "x-unsigned-rc", root),
    /UNSIGNED-RC\.txt/i,
  );
});
