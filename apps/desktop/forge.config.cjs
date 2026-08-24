const path = require("node:path");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

const sidecarBundle = path.join(__dirname, "resources", "sidecars", `${process.platform}-${process.arch}`);

module.exports = {
  outDir: path.resolve(__dirname, "../../dist/desktop"),
  packagerConfig: {
    asar: true,
    executableName: "bento",
    appBundleId: "app.bento.desktop",
    appCategoryType: "public.app-category.productivity",
    extraResource: [path.join(sidecarBundle, "bento-sidecar")],
    ignore: [
      /^\/src($|\/)/,
      /^\/tests($|\/)/,
      /^\/scripts($|\/)/,
      /^\/resources($|\/)/,
      /^\/node_modules\/\.cache($|\/)/,
    ],
  },
  makers: [
    { name: "@electron-forge/maker-squirrel", config: { name: "bento" } },
    { name: "@electron-forge/maker-dmg", platforms: ["darwin"], config: { format: "ULFO" } },
    { name: "@electron-forge/maker-zip", platforms: ["darwin", "linux"] },
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      config: { options: { maintainer: "Bento", homepage: "https://github.com/", categories: ["Utility"] } },
    },
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
