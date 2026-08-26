import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const desktopRoot = path.resolve(import.meta.dirname, "..");
const releaseRoot = path.resolve(process.argv[2] ?? path.join(desktopRoot, "../../dist/desktop"));
const outputName = process.argv[3] ?? "SHA256SUMS";
const files = (await walk(releaseRoot))
  .filter((filename) => !path.basename(filename).startsWith("SHA256SUMS"))
  .sort();
if (files.length === 0) throw new Error(`No release artifacts found under ${releaseRoot}`);

const lines = [];
for (const filename of files) {
  const digest = await sha256(filename);
  lines.push(`${digest}  ${path.relative(releaseRoot, filename).split(path.sep).join("/")}`);
}
await mkdir(releaseRoot, { recursive: true });
await writeFile(path.join(releaseRoot, outputName), `${lines.join("\n")}\n`, "utf8");

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(target));
    else if (entry.isFile()) result.push(target);
  }
  return result;
}

async function sha256(filename) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
}
