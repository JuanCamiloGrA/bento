import { access, readdir, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots = [resolve(import.meta.dirname, "../out"), resolve(import.meta.dirname, "../../../dist/desktop")];
let executable;
for (const root of roots) {
  try {
    const directories = await readdir(root, { withFileTypes: true });
    const packaged = directories.find((entry) => entry.isDirectory() && entry.name.includes(`${process.platform}-${process.arch}`));
    if (!packaged) continue;
    executable = process.platform === "darwin"
      ? join(root, packaged.name, "Bento.app", "Contents", "MacOS", "Bento")
      : process.platform === "win32"
        ? join(root, packaged.name, "bento.exe")
        : join(root, packaged.name, "bento");
    await access(executable, constants.X_OK);
    break;
  } catch {}
}
if (!executable) throw new Error("No native packaged Bento executable was found; run npm run package first");

const profile = join(tmpdir(), `bento-desktop-smoke-${process.pid}`);
const command = process.platform === "linux" && process.env.DISPLAY === undefined ? "xvfb-run" : executable;
const args = command === executable ? [] : ["-a", executable];
const child = spawn(command, args, {
  env: { ...process.env, BENTO_DESKTOP_SMOKE: "1", XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: join(profile, "cache") },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => { output += String(chunk); });
child.stderr.on("data", (chunk) => { output += String(chunk); });
const exitCode = await new Promise((resolveExit, reject) => {
  const timeout = setTimeout(() => {
    child.kill("SIGKILL");
    reject(new Error(`Packaged smoke timed out: ${output.slice(-4000)}`));
  }, 45_000);
  child.once("error", (error) => { clearTimeout(timeout); reject(error); });
  child.once("exit", (code) => { clearTimeout(timeout); resolveExit(code ?? 1); });
});
await rm(profile, { recursive: true, force: true });
if (exitCode !== 0) throw new Error(`Packaged Bento exited with ${exitCode}: ${output.slice(-2000)}`);
if (/electron\/default_app|localhost:5173|ERR_FILE_NOT_FOUND/u.test(output)) throw new Error(`Packaged smoke found a development/runtime leak: ${output.slice(-2000)}`);
