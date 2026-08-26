import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const kind = process.argv[2];
if (!new Set(["major", "minor", "patch"]).has(kind)) throw new Error("Version bump must be major, minor, or patch");
const repositoryRoot = path.resolve(process.argv[3] ?? path.resolve(import.meta.dirname, "../../.."));
const paths = {
  desktopPackage: path.join(repositoryRoot, "apps/desktop/package.json"),
  desktopLock: path.join(repositoryRoot, "apps/desktop/package-lock.json"),
  apiProject: path.join(repositoryRoot, "apps/api/pyproject.toml"),
  apiLock: path.join(repositoryRoot, "apps/api/uv.lock"),
  apiPackage: path.join(repositoryRoot, "apps/api/src/bento/__init__.py"),
  apiSettings: path.join(repositoryRoot, "apps/api/src/bento/infrastructure/settings.py"),
  settingsRegistry: path.join(repositoryRoot, "apps/api/src/bento/domain/settings_registry.py"),
};

const packageJson = JSON.parse(await readFile(paths.desktopPackage, "utf8"));
const packageLock = JSON.parse(await readFile(paths.desktopLock, "utf8"));
const textFiles = Object.fromEntries(await Promise.all(
  Object.entries(paths).filter(([key]) => !key.startsWith("desktop")).map(async ([key, filename]) => [key, await readFile(filename, "utf8")]),
));
const current = strictVersion(packageJson.version, "desktop package");
const discovered = [
  strictVersion(packageLock.version, "desktop lock"),
  strictVersion(packageLock.packages?.[""]?.version, "desktop lock root"),
  capture(textFiles.apiProject, /^version = "([^"]+)"$/mu, "API project"),
  capture(textFiles.apiLock, /\[\[package\]\]\nname = "bento-api"\nversion = "([^"]+)"/u, "API lock"),
  capture(textFiles.apiPackage, /^__version__ = "([^"]+)"$/mu, "API package"),
  capture(textFiles.apiSettings, /^    app_version: str = "([^"]+)"$/mu, "API settings"),
  capture(textFiles.settingsRegistry, /_field\("app_version", \("APP_VERSION",\), "advanced", Type\.STRING, "([^"]+)"/u, "settings registry"),
];
if (discovered.some((version) => version !== current)) {
  throw new Error(`Application version metadata is inconsistent: expected every source to be ${current}`);
}

let [major, minor, patch] = current.split(".").map(Number);
if (kind === "major") [major, minor, patch] = [major + 1, 0, 0];
if (kind === "minor") [minor, patch] = [minor + 1, 0];
if (kind === "patch") patch += 1;
const version = `${major}.${minor}.${patch}`;
packageJson.version = version;
packageLock.version = version;
packageLock.packages[""].version = version;

const updatedText = {
  apiProject: replaceOne(textFiles.apiProject, /^version = "[^"]+"$/mu, `version = "${version}"`, "API project"),
  apiLock: replaceOne(textFiles.apiLock, /(\[\[package\]\]\nname = "bento-api"\nversion = ")[^"]+("\n)/u, `$1${version}$2`, "API lock"),
  apiPackage: replaceOne(textFiles.apiPackage, /^__version__ = "[^"]+"$/mu, `__version__ = "${version}"`, "API package"),
  apiSettings: replaceOne(textFiles.apiSettings, /^    app_version: str = "[^"]+"$/mu, `    app_version: str = "${version}"`, "API settings"),
  settingsRegistry: replaceOne(textFiles.settingsRegistry, /(_field\("app_version", \("APP_VERSION",\), "advanced", Type\.STRING, ")[^"]+(".*)/u, `$1${version}$2`, "settings registry"),
};

await Promise.all([
  writeFile(paths.desktopPackage, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8"),
  writeFile(paths.desktopLock, `${JSON.stringify(packageLock, null, 2)}\n`, "utf8"),
  ...Object.entries(updatedText).map(([key, value]) => writeFile(paths[key], value, "utf8")),
]);
console.log(version);

function strictVersion(value, label) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value)) {
    throw new Error(`${label} is not stable SemVer`);
  }
  return value;
}

function capture(source, pattern, label) {
  const match = pattern.exec(source);
  if (!match) throw new Error(`${label} version metadata is missing`);
  return strictVersion(match[1], label);
}

function replaceOne(source, pattern, replacement, label) {
  const matches = source.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`));
  if (matches?.length !== 1) throw new Error(`${label} must contain exactly one version field`);
  return source.replace(pattern, replacement);
}
