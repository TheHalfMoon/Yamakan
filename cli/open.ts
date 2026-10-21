import { writeLaunchLink } from "../core/launch.ts";
import path from "node:path";

const env = (key: string) =>
  process.env[`YAMAKAN_${key}`] || process.env[`DARZAIN_${key}`];
const root = path.resolve(env("WORKSPACE") || ".yamakan");
const port = Number(env("PORT") || 4318);
const origin = `http://127.0.0.1:${port}`;
const record = await writeLaunchLink(root, origin);
console.log(record.url);
