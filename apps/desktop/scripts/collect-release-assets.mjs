import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

const source = path.resolve(process.argv[2] ?? "release-artifacts");
const destination = path.resolve(process.argv[3] ?? "release-assets");
await mkdir(destination, { recursive: true });
if ((await readdir(destination)).length !== 0) throw new Error(`Release asset destination must be empty: ${destination}`);

const files = await walk(source);
if (files.length === 0) throw new Error(`No release assets found below ${source}`);
const basenames = new Map();
for (const filename of files) {
  const basename = path.basename(filename);
  const collisionKey = basename.toLocaleLowerCase("en-US");
  const previous = basenames.get(collisionKey);
  if (previous) throw new Error(`Release asset basename collision: ${previous} and ${filename}`);
  basenames.set(collisionKey, filename);
  await copyFile(filename, path.join(destination, basename));
}

console.log(`Collected ${files.length} unique release assets in ${destination}`);

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic-link release asset: ${filename}`);
    if (entry.isDirectory()) output.push(...await walk(filename));
    else if (entry.isFile() && (await stat(filename)).size > 0) output.push(filename);
    else throw new Error(`Release asset is empty or unsupported: ${filename}`);
  }
  return output.sort();
}
