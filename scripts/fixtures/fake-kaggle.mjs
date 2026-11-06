// Stands in for the Kaggle CLI, for the real page against the real service. No network and
// no model: it says what a scene tells it to, from a file, and remembers each push.
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const SCENE = process.env.KAGGLE_FAKE_SCENE;
const scene = () => JSON.parse(readFileSync(SCENE, "utf8"));
const change = (patch) =>
  writeFileSync(SCENE, JSON.stringify({ ...scene(), ...patch }));
const args = process.argv.slice(2);
appendFileSync(`${SCENE}.log`, `${args.slice(0, 2).join(" ")}\n`);
const say = (words) => process.stdout.write(`${words}\n`);
const refuse = (words, code = 1) => {
  process.stderr.write(`${words}\n`);
  process.exit(code);
};
const now = scene();

const command = args[1];
if (command === "list") {
  say(now.pushes.length ? `ref,title\n${now.remote},t` : "Not found");
} else if (command === "status") {
  if (now.pushes.length === 0)
    refuse(`Cannot access kernel (Permission 'kernels.get' was denied).`);
  say(`has status "KernelWorkerStatus.${now.state}"`);
} else if (command === "pull") {
  writeFileSync(
    join(args[args.indexOf("-p") + 1], "kernel-metadata.json"),
    JSON.stringify({ is_private: true }),
  );
} else if (command === "push") {
  const folder = args[args.indexOf("-p") + 1];
  const script = readFileSync(join(folder, "run.py"), "utf8");
  const brief = JSON.parse(
    Buffer.from(/b64decode\("([^"]+)"\)/.exec(script)[1], "base64").toString(),
  );
  if (now.push === "quota") {
    // As real Kaggle answered: on stdout, with a clean exit.
    say(
      "Warning: Looks like you're using an outdated `kaggle` version (installed: 2.2.4), please consider upgrading to the latest version (2.2.5)",
    );
    say("Kernel push error: Maximum weekly GPU quota of 30.00 hours reached.");
    process.exit(0);
  }
  // Never arrived: the answer is lost, and Kaggle has nothing of it.
  if (now.push === "lost-before") refuse("Remote end closed connection", 1);
  // Never arrived: the answer is lost, and Kaggle has nothing of it.
  if (now.push === "lost-before") refuse("Remote end closed connection", 1);
  change({ pushes: [...now.pushes, brief] });
  if (now.push === "lost") refuse("Remote end closed connection", 1);
  say("Kernel version 1 successfully pushed.");
} else if (command === "output") {
  const folder = args[args.indexOf("-p") + 1];
  mkdirSync(folder, { recursive: true });
  const last = now.pushes.at(-1);
  const { sha256, frames, file, output } = now.video;
  copyFileSync(file, join(folder, output));
  writeFileSync(
    join(folder, "receipt.json"),
    JSON.stringify(
      now.state === "ERROR"
        ? { runId: last.runId, stage: "generating", error: null }
        : {
            format: "yamakan.generation-receipt/v1",
            runId: last.runId,
            stage: "done",
            verified: true,
            frames,
            sha256,
            prompt: last.prompt,
            seed: last.seed,
            steps: 30,
            model: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
            revision: "stand-in",
          },
    ),
  );
} else refuse(`Not something this stands in for: ${args.join(" ")}`, 2);
