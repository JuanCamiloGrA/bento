import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const desktopRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.resolve(process.argv[2] ?? path.join(desktopRoot, "../../dist/desktop"));
const outputRoot = path.resolve(process.argv[3] ?? path.join(desktopRoot, "../../dist/release"));
const makerRoot = path.join(sourceRoot, "make");
const candidates = [
  ...await walk(makerRoot),
  ...(await readdir(sourceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".cdx.json"))
    .map((entry) => path.join(sourceRoot, entry.name)),
];
if (candidates.length === 0) throw new Error(`No release artifacts found under ${sourceRoot}`);

const byBasename = new Map();
for (const filename of candidates) {
  const basename = path.basename(filename);
  const collisionKey = basename.toLocaleLowerCase("en-US");
  const previous = byBasename.get(collisionKey);
  if (previous) throw new Error(`Artifact basename collision: ${previous} and ${filename}`);
  byBasename.set(collisionKey, filename);
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const filename of byBasename.values()) await copyFile(filename, path.join(outputRoot, path.basename(filename)));

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(target));
    else if (entry.isFile()) result.push(target);
  }
  return result;
}
