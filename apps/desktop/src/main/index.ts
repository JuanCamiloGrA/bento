import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, ipcMain, protocol, safeStorage } from "electron";
import { BootstrapStore } from "./bootstrap";
import { registerIpcHandlers } from "./ipc";
import { registerBentoProtocol } from "./protocol";
import { RedactingLog } from "./redaction";
import { SecureSecretStore } from "./secrets";
import { SettingsTransaction } from "./settings-transaction";
import { resolveSidecarCommand, SidecarSupervisor } from "./sidecars";
import { createMainWindow, lockDownSession } from "./window";
import { BENTO_ORIGIN, IPC_CHANNELS, PlatformMetadata } from "../shared/contracts";

protocol.registerSchemesAsPrivileged([{
  scheme: "bento",
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: false },
}]);

const primaryInstance = app.requestSingleInstanceLock();
let mainWindow: BrowserWindow | null = null;
let supervisor: SidecarSupervisor | null = null;
let quitting = false;

if (!primaryInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.on("before-quit", (event) => {
    if (quitting || !supervisor) return;
    event.preventDefault();
    quitting = true;
    void supervisor.stop().finally(() => app.exit(0));
  });

  void app.whenReady().then(startDesktop).catch(async (error) => {
    await showRecovery(error);
  });
}

async function startDesktop(): Promise<void> {
  app.setAppLogsPath();
  const userData = app.getPath("userData");
  const desktopData = path.join(userData, "bento-desktop");
  const logPath = path.join(app.getPath("logs"), "desktop.jsonl");
  await prepareLog(logPath);
  const knownSecrets: string[] = [];
  const log = new RedactingLog((line) => { void appendFile(logPath, `${line}\n`, { encoding: "utf8", mode: 0o600 }); }, () => knownSecrets);
  const bootstrapStore = new BootstrapStore(path.join(desktopData, "bootstrap.json"), path.join(userData, "bento-data"));
  const bootstrap = await bootstrapStore.load();
  const secretStore = new SecureSecretStore(path.join(desktopData, "secrets.json"), safeStorage);
  const secretValues = await secretStore.values();
  knownSecrets.push(...Object.values(secretValues));
  supervisor = new SidecarSupervisor({
    command: resolveSidecarCommand(process.resourcesPath, app.isPackaged, path.resolve(app.getAppPath(), "../api")),
    dataDir: bootstrap.dataDir,
    secretEnvironment: secretValues,
    log,
  });
  supervisor.on("status", (status) => mainWindow?.webContents.send(IPC_CHANNELS.lifecycleChanged, status));
  registerBentoProtocol(protocol, path.join(app.getAppPath(), "dist", "renderer"), supervisor);
  lockDownSession();
  await supervisor.start();
  const transaction = new SettingsTransaction(supervisor, secretStore, bootstrapStore, bootstrap);
  registerIpcHandlers({
    ipcMain,
    window: () => mainWindow,
    lifecycleStatus: () => supervisor!.status,
    platform: async (): Promise<PlatformMetadata> => ({
      desktop: true,
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion(),
      secureStorage: await secretStore.available() ? "available" : "unavailable",
      recoveryMode: supervisor!.status.recoveryMode,
    }),
    applySettings: (request, progress) => transaction.apply(request, progress),
    runProbe: (request) => supervisor!.runProbe(request),
  });
  mainWindow = createMainWindow();
  mainWindow.on("closed", () => { mainWindow = null; });
  if (process.env.BENTO_DESKTOP_SMOKE === "1") {
    mainWindow.webContents.once("did-finish-load", () => setTimeout(() => app.quit(), 250));
  }
}

async function showRecovery(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "Desktop startup failed";
  if (process.env.BENTO_DESKTOP_SMOKE === "1") {
    console.error(`Bento packaged smoke startup failed: ${safeDiagnostic(message)}`);
    app.exit(1);
    return;
  }
  try {
    if (protocol.isProtocolHandled("bento")) protocol.unhandle("bento");
    protocol.handle("bento", () => new Response(recoveryHtml(safeDiagnostic(message)), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    }));
    lockDownSession();
    mainWindow = new BrowserWindow({
      width: 720,
      height: 480,
      title: "Bento — Recuperación",
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true },
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    await mainWindow.loadURL(`${BENTO_ORIGIN}/recovery`);
  } catch {
    app.exit(1);
  }
}

function recoveryHtml(diagnostic: string): string {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Bento — Recuperación</title><style>body{font:16px system-ui;background:#0b0d10;color:#f5f6f7;padding:48px;max-width:700px}p{color:#b8bec7}code{display:block;padding:16px;background:#171a20;border-radius:10px;overflow-wrap:anywhere}</style><h1>Bento no pudo iniciar</h1><p>Tus datos permanecen en el equipo. Revisa el diagnóstico seguro y vuelve a abrir la aplicación.</p><code>${escapeHtml(diagnostic)}</code></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

function safeDiagnostic(message: string): string {
  return message
    .replace(/Bearer\s+\S+/giu, "Bearer [REDACTED]")
    .replace(/([?&](?:token|secret|password)=)[^&\s]+/giu, "$1[REDACTED]")
    .slice(0, 500);
}

async function prepareLog(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  try {
    if ((await stat(filePath)).size > 5 * 1024 * 1024) await rename(filePath, `${filePath}.1`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
