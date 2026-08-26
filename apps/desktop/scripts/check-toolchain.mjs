const major = Number.parseInt(process.versions.node.split(".", 1)[0], 10);
if (!Number.isInteger(major) || major < 22 || major >= 26) {
  throw new Error(`Desktop packaging requires Node.js 22, 23, 24, or 25; received ${process.versions.node}`);
}
