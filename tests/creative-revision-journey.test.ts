// SS-004: a model-free command integration journey, not a browser journey.
// Real media goes through story assembly, rendering, an agent's bounded take
// revision and durable replay. Pixel expectations are independent of the plan.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { closeWorkers, mediaTools } from "../core/process/workers.ts";
import { preview } from "../core/render/preview.ts";
import { IDENTITY_TRANSFORM } from "../core/effects/registry.ts";
import type { Project } from "../core/project.ts";
import type { StoryDocument } from "../core/story.ts";
import type { TakeProposal } from "../core/takes.ts";
import {
  audioOnset,
  decodeFrames,
  decodeStill,
  meanColour,
  probe,
  ssim,
  PALETTE,
  type Frame,
} from "./fixtures/golden.ts";

const F = 23_520_000;
const W = 640,
  H = 360;
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const browserPrincipal = { id: "browser-ui" as const, scopes: new Set(Scopes) };
const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );
const denied = (code: string) => (error: unknown) =>
  toCommandError(error).code === code;

function colour(frame: Frame, expected: keyof typeof PALETTE, border = false) {
  const actual = meanColour(frame, {
    x: border ? 5 : 280,
    y: border ? 5 : 40,
    w: 40,
    h: 25,
  });
  for (let c = 0; c < 3; c++)
    assert.ok(
      Math.abs(actual[c] - PALETTE[expected][c]) < 24,
      `${expected} channel ${c}: ${actual[c]}`,
    );
}

test(
  "a three-shot creator journey renders only the agent's revised middle take and survives undo, stale writes and reopen",
  { timeout: 180_000 },
  async (t) => {
    const base = await mkdtemp(
      path.join(tmpdir(), "yamakan-creative-journey-"),
    );
    const root = path.join(base, "workspace");
    let store = new ProjectStore(root);
    let queue = new JobSupervisor(store);
    try {
      await store.initialize();
      await queue.start();
      const context = () => ({ store, queue, principal: browserPrincipal });
      const created = (
        await execute(context(), "yamakan.project.create", {
          name: "Three-shot revision",
        })
      ).result as Project;
      const projectId = created.id;
      const head = () => store.load(projectId);
      const run = async <T>(name: string, args: object = {}) =>
        (await execute(context(), name, { projectId, ...args })).result as T;
      const mutate = async (name: string, args: object) =>
        run<Project>(name, {
          expectedRevision: (await head()).revision,
          ...args,
        });
      await execute(context(), "yamakan.project.save", {
        project: { ...created, width: W, height: H },
        expectedRevision: created.revision,
      });

      const files = {
        footage: [
          "footage.mp4",
          [
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=640x360:r=30:d=3",
            "-vf",
            "drawbox=x=0:y=0:w=iw:h=ih:color=blue:t=fill:enable='gte(n,60)'",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
          ],
        ],
        still: [
          "still.png",
          ["-f", "lavfi", "-i", "color=c=green:s=640x360", "-frames:v", "1"],
        ],
        audio: [
          "sound.wav",
          [
            "-f",
            "lavfi",
            "-i",
            "aevalsrc='if(between(t,0.5,2.5),0.8*sin(2*PI*440*t),0)':s=48000:d=3",
          ],
        ],
      } as const;
      const assets = {} as Record<
        keyof typeof files,
        Project["assets"][number]
      >;
      for (const key of Object.keys(files) as (keyof typeof files)[]) {
        const [name, args] = files[key];
        const file = path.join(base, name);
        ffmpeg([...args, file]);
        const bytes = await readFile(file);
        assets[key] = (await store.importAsset(projectId, name, bytes)).asset;
        assert.equal(assets[key].hash, hash(bytes));
      }
      const take = (assetId: string, sourceStartTicks = 0) => ({
        id: randomUUID(),
        assetId,
        sourceStartTicks,
      });
      const first = take(assets.footage.id);
      const original = take(assets.still.id);
      const alternate = take(assets.footage.id, 60 * F);
      const shot = (
        name: string,
        takes: (typeof first)[],
        selectedTakeId: string | null,
      ) => ({
        id: randomUUID(),
        name,
        notes: "",
        durationTicks: 30 * F,
        referencePacks: [],
        takes,
        selectedTakeId,
      });
      const shots = [
        shot("Arrival", [first], first.id),
        shot("Reaction", [original, alternate], original.id),
        shot("The end", [], null),
      ];
      const story: StoryDocument = {
        format: "yamakan.story",
        formatVersion: 1,
        title: "A small revision",
        scenes: [{ id: randomUUID(), name: "One scene", shots }],
      };
      const documentId = randomUUID();
      await mutate("yamakan.story.save", {
        documentId,
        expectedContentHash: null,
        story,
      });
      await mutate("yamakan.story.assemble", {
        documentId,
        trackId: (await head()).tracks.find((x) => x.kind === "video")!.id,
      });
      const assembled = await head();
      const clipIds = assembled.scenes[0].shots!.map((s) => s.clipIds[0]);
      assert.deepEqual(
        clipIds.map((id) => {
          const c = assembled.clips.find((c) => c.id === id)!;
          return [c.startFrame, c.durationFrames, c.assetId, c.title];
        }),
        [
          [0, 30, assets.footage.id, null],
          [30, 30, assets.still.id, null],
          [60, 30, null, "The end"],
        ],
      );
      await mutate("yamakan.project.applyBatch", {
        operations: [
          {
            type: "clip.add",
            clipId: randomUUID(),
            trackId: assembled.tracks.find((x) => x.kind === "audio")!.id,
            assetId: assets.audio.id,
            title: null,
            startTicks: 0,
            durationTicks: 90 * F,
            sourceStartTicks: 0,
          },
        ],
      });
      await mutate("yamakan.captions.import", {
        documentId: randomUUID(),
        expectedContentHash: null,
        name: "Arrival caption",
        language: "en",
        format: "srt",
        text: "1\n00:00:00,200 --> 00:00:00,800\nArrival\n",
        burnIn: true,
      });
      await mutate("yamakan.clip.setEffects", {
        clipId: clipIds[1],
        effects: [{ ...IDENTITY_TRANSFORM, scale: 800 }],
      });
      const before = await head();
      const beforeHistory = await store.history(projectId);
      const exportCurrent = async (key: string) => {
        const submitted = await run<{ id: string }>("yamakan.export.video", {
          idempotencyKey: key,
        });
        let status = queue.status(submitted.id);
        const deadline = Date.now() + 60_000;
        while (
          !["COMPLETED", "FAILED", "CANCELLED"].includes(status.state) &&
          Date.now() < deadline
        ) {
          await new Promise((r) => setTimeout(r, 25));
          status = queue.status(submitted.id);
        }
        assert.equal(
          status.state,
          "COMPLETED",
          status.error ?? "export timed out",
        );
        const file = await store.file(projectId, status.artifact!);
        const metadata = probe(file);
        const video = metadata.streams.find(
          (s: { codec_type: string }) => s.codec_type === "video",
        );
        assert.equal(video.codec_name, "h264");
        assert.equal(video.width, W);
        assert.equal(video.height, H);
        assert.equal(video.avg_frame_rate, "30/1");
        assert.equal(Number(video.nb_frames), 90);
        assert.equal(
          metadata.streams.find(
            (s: { codec_type: string }) => s.codec_type === "audio",
          ).codec_name,
          "aac",
        );
        assert.ok(Math.abs(Number(metadata.format.duration) - 3) < 1 / 30);
        const onset = audioOnset(file);
        assert.ok(
          onset !== null && Math.abs(onset - 0.5) < 0.02,
          `audio onset ${onset}`,
        );
        const indices = [0, 5, 6, 23, 24, 29, 30, 45, 59, 60, 75, 89];
        const frames = decodeFrames(file, indices, W, H);
        assert.equal(frames.size, indices.length);
        for (const n of [0, 29]) colour(frames.get(n)!, "red");
        for (const n of [60, 75, 89]) colour(frames.get(n)!, "black");
        for (const n of [30, 45, 59]) colour(frames.get(n)!, "black", true);
        // Text must appear on the actual pixels, on exact cue boundaries.
        const band = { x: 50, y: 250, w: 540, h: 100 };
        assert.ok(ssim(frames.get(0)!, frames.get(5)!, band) > 0.99);
        assert.ok(ssim(frames.get(0)!, frames.get(6)!, band) < 0.99);
        assert.ok(ssim(frames.get(0)!, frames.get(23)!, band) < 0.99);
        assert.ok(ssim(frames.get(0)!, frames.get(24)!, band) > 0.99);
        // Titles are bottom-centred. Count bright glyph pixels instead of
        // diluting a short title into the mean of a large black region.
        const titleFrame = frames.get(75)!;
        let titleInk = 0;
        for (let y = 250; y < 350; y++)
          for (let x = 100; x < 540; x++) {
            const offset = (y * W + x) * 3;
            if (
              titleFrame.rgb[offset] > 180 &&
              titleFrame.rgb[offset + 1] > 180 &&
              titleFrame.rgb[offset + 2] > 180
            )
              titleInk++;
          }
        assert.ok(
          titleInk > 50,
          `title card contains visible text: ${titleInk}`,
        );
        return {
          file,
          frames,
          revision: status.revision,
          hash: hash(await readFile(file)),
          planHash: status.planHash,
        };
      };
      const baseline = await exportCurrent("original");
      for (const n of [30, 45, 59]) colour(baseline.frames.get(n)!, "green");
      const oldPreview = await preview(
        store,
        projectId,
        before.revision,
        "frame",
        45,
      );
      colour(decodeStill(oldPreview.file, W, H), "green");
      assert.ok(
        ssim(decodeStill(oldPreview.file, W, H), baseline.frames.get(45)!) >
          0.98,
      );

      const { token } = (
        await execute(context(), "yamakan.agent.create", {
          scopes: ["project:read", "project:write"],
        })
      ).result as { token: string };
      const agent = () => ({
        store,
        queue,
        principal: store.principalForAgentToken(token)!,
      });
      assert.ok(agent().principal);
      const proposal = (
        await execute(agent(), "yamakan.take.proposeReplace", {
          projectId,
          documentId,
          shotId: shots[1].id,
          takeId: alternate.id,
        })
      ).result as TakeProposal;
      const request = {
        projectId,
        expectedRevision: before.revision,
        proposal,
      };
      const requestId = "middle-take-lost-response";
      const revised = (
        await execute({ ...agent(), requestId }, "yamakan.take.apply", request)
      ).result as Project;
      assert.equal(revised.revision, before.revision + 1);
      const untouched = (p: Project) => ({
        ...p,
        revision: 0,
        clips: p.clips.filter((c) => c.id !== clipIds[1]),
      });
      assert.deepEqual(untouched(revised), untouched(before));
      const changed = revised.clips.find((c) => c.id === clipIds[1])!;
      assert.equal(changed.assetId, assets.footage.id);
      assert.equal(changed.sourceFrame, 60);
      assert.deepEqual(
        changed.effects,
        before.clips.find((c) => c.id === clipIds[1])!.effects,
      );
      const historyAfter = await store.history(projectId);
      assert.deepEqual(
        historyAfter.snapshots.slice(1),
        beforeHistory.snapshots,
      );
      await assert.rejects(
        execute(agent(), "yamakan.take.apply", request),
        denied("REVISION_CONFLICT"),
      );
      assert.equal(agent().principal.scopes.has("director:approve"), false);
      await assert.rejects(
        execute(agent(), "yamakan.director.approve", {
          runId: randomUUID(),
          stage: "final",
          outputHash: "a".repeat(64),
          ttlMs: 60_000,
          expectedVersion: 1,
        }),
        (error: unknown) =>
          denied("SCOPE_DENIED")(error) &&
          /requires the browser session/.test(toCommandError(error).message),
      );
      assert.deepEqual(await head(), revised);
      assert.deepEqual(await store.history(projectId), historyAfter);

      const final = await exportCurrent("revised");
      for (const n of [30, 45, 59]) colour(final.frames.get(n)!, "blue");
      // Negative control: an old export cannot satisfy the revised intent.
      assert.throws(() => colour(baseline.frames.get(45)!, "blue"));
      assert.notEqual(final.hash, baseline.hash);
      // Whole-frame SSIM dilutes small text, so captions and titles are also
      // compared in their own band.
      const textBand = { x: 50, y: 250, w: 540, h: 100 };
      for (const n of [0, 5, 6, 23, 24, 29, 60, 75, 89]) {
        const before = baseline.frames.get(n)!;
        const after = final.frames.get(n)!;
        assert.ok(ssim(before, after) > 0.99, `unrelated frame ${n}`);
        assert.ok(ssim(before, after, textBand) > 0.99, `text band ${n}`);
      }
      // Positive control: the same measure does see the revised shot.
      assert.ok(ssim(baseline.frames.get(45)!, final.frames.get(45)!) < 0.99);
      const revisedPreview = await preview(
        store,
        projectId,
        revised.revision,
        "frame",
        45,
      );
      assert.notEqual(revisedPreview.planHash, oldPreview.planHash);
      assert.equal(revisedPreview.planHash, final.planHash);
      assert.ok(
        ssim(decodeStill(revisedPreview.file, W, H), final.frames.get(45)!) >
          0.98,
      );

      const undone = (
        await execute(agent(), "yamakan.project.undo", {
          projectId,
          expectedRevision: revised.revision,
        })
      ).result as Project;
      assert.deepEqual({ ...undone, revision: 0 }, { ...before, revision: 0 });
      colour(
        decodeStill(
          (await preview(store, projectId, undone.revision, "frame", 45)).file,
          W,
          H,
        ),
        "green",
      );
      const redone = (
        await execute(agent(), "yamakan.project.redo", {
          projectId,
          expectedRevision: undone.revision,
        })
      ).result as Project;
      assert.deepEqual({ ...redone, revision: 0 }, { ...revised, revision: 0 });
      const savedHistory = await store.history(projectId);
      await queue.close();
      store.close();
      closeWorkers();
      store = new ProjectStore(root);
      queue = new JobSupervisor(store);
      await store.initialize();
      await queue.start();
      assert.deepEqual(await head(), redone);
      assert.deepEqual(await store.history(projectId), savedHistory);
      assert.deepEqual(
        JSON.parse(
          store.getDocument(projectId, documentId).bytes.toString("utf8"),
        ),
        story,
      );
      // Simulate a lost acknowledgement by retrying the exact original command
      // after a graceful restart. Its receipt must not add another history row.
      const replay = (
        await execute({ ...agent(), requestId }, "yamakan.take.apply", request)
      ).result as Project;
      assert.deepEqual(replay, revised);
      assert.deepEqual(await head(), redone);
      assert.deepEqual(await store.history(projectId), savedHistory);
      const reopened = await exportCurrent("reopened");
      for (const [n, frame] of final.frames)
        assert.deepEqual(
          reopened.frames.get(n)!.rgb,
          frame.rgb,
          `reopened frame ${n}`,
        );
      t.diagnostic(
        JSON.stringify({
          baseline: { revision: baseline.revision, sha256: baseline.hash },
          revised: { revision: final.revision, sha256: final.hash },
          reopened: { revision: reopened.revision, sha256: reopened.hash },
          comparedFrames: [...final.frames.keys()],
          historyRows: savedHistory.snapshots.length,
        }),
      );
    } finally {
      await queue.close();
      store.close();
      closeWorkers();
      await rm(base, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    }
  },
);
