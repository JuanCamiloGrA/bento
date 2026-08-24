import { readFile } from "node:fs/promises";
import path from "node:path";

const desktopRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(path.join(desktopRoot, "package.json"), "utf8"));
const supplied = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!supplied) throw new Error("A release tag is required");
const expected = `v${packageJson.version}`;
if (supplied !== expected) {
  throw new Error(`Release tag ${supplied} does not match apps/desktop package version ${packageJson.version}; expected ${expected}`);
}
console.log(`Validated desktop release ${expected}`);
