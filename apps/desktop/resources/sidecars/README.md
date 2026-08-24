# Native sidecars

`npm run build:sidecar` creates a platform/architecture-specific PyInstaller one-folder bundle here. Generated binaries are ignored and its `bento-sidecar` directory is copied outside `app.asar` as a read-only Electron `extraResource`.
