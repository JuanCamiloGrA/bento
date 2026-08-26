import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const output = resolve(import.meta.dirname, `../resources/sidecars/${process.platform}-${process.arch}`);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const child = spawn("uv", [
  "run", "--project", resolve(import.meta.dirname, "../../api"), "--extra", "desktop",
  "python", resolve(import.meta.dirname, "../../api/scripts/build_desktop_sidecar.py"), "--output", output,
], { stdio: "inherit" });
const exitCode = await new Promise((resolveExit, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolveExit(code ?? 1));
});
if (exitCode !== 0) process.exit(exitCode);
await rm(resolve(output, ".pyinstaller-work"), { recursive: true, force: true });
