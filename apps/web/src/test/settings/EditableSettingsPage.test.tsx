import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditableSettingsPage } from "../../features/settings/EditableSettingsPage";
import type { SettingsController } from "../../features/settings/useSettingsController";
import type { SettingDefinition } from "../../api/settings";

const storageField: SettingDefinition = {
  apply_mode: "restart_services", availability: "both", constraints: { choices: ["local", "telegram"], maximum: null, minimum: null }, default: "local", editable: true,
  env_aliases: ["STORAGE_BACKEND"], group: "storage", help_key: "settings.storage_backend.help", key: "storage_backend", label_key: "settings.storage_backend.label", locked: false, probe: "storage", secret: false, source: "saved", type: "choice",
};
const secretField: SettingDefinition = {
  apply_mode: "restart_services", availability: "both", constraints: { choices: [], maximum: null, minimum: null }, default: null, editable: true,
  env_aliases: ["TELEGRAM_BOT_TOKEN"], group: "telegram", help_key: "settings.telegram_bot_token.help", key: "telegram_bot_token", label_key: "settings.telegram_bot_token.label", locked: false, probe: null, secret: true, source: "saved", type: "secret",
};

function controller(overrides: Partial<SettingsController> = {}): SettingsController {
  return {
    applyOutcome: null, applyProgress: [], conflict: false, dataMigration: null, desktop: null, dirty: false, discard: vi.fn(), dismissImport: vi.fn(), draft: { storage_backend: "local" }, error: null,
    exportSafe: vi.fn(), fieldErrors: {}, importPreview: null, importPreviewFromFile: vi.fn(), importValues: vi.fn(), isApplying: false, isLoading: false,
    isReclaiming: false, isValidating: false, pickPath: vi.fn(), probe: vi.fn(), publicSettings: { embeddings_state: "disabled", ocr_state: "ready", storage_backend: "local", telegram_configured: false, worker_status: "running" },
    reclaim: vi.fn(), reclaimError: null, reclaimResult: null, refresh: vi.fn(), resetGroup: vi.fn(), save: vi.fn(), schema: { fields: [storageField, secretField], revision: 2 },
    secretEdits: {}, setDataMigration: vi.fn(), setSecret: vi.fn(), setValue: vi.fn(), validate: vi.fn(), validation: null,
    values: { revision: 2, values: { storage_backend: { apply_mode: "restart_services", locked: false, source: "saved", value: "local" }, telegram_bot_token: { apply_mode: "restart_services", configured: true, locked: false, source: "saved" } } },
    ...overrides,
  };
}

describe("editable settings experience", () => {
  it("is searchable, keyboard reachable and explains the browser fallback", () => {
    const state = controller();
    render(<EditableSettingsPage controller={state} />);
    expect(screen.getByRole("heading", { name: "Ajustes" })).toBeInTheDocument();
    expect(screen.getByText("Modo navegador o servidor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Almacenamiento" }));
    const control = screen.getByRole("combobox", { name: "Destino de archivos" });
    fireEvent.change(control, { target: { value: "telegram" } });
    expect(state.setValue).toHaveBeenCalledWith("storage_backend", "telegram");
    expect(screen.getByText("Reinicia servicios")).toBeInTheDocument();
  });

  it("never redisplays a configured secret and offers protected desktop mutation", () => {
    const state = controller({ desktop: { arch: "x64", desktop: true, platform: "linux", recoveryMode: false, secureStorage: "available", version: "0.1.0" } });
    Object.defineProperty(window, "localStorage", { configurable: true, value: { getItem: () => "1", setItem: vi.fn() } });
    window.localStorage.setItem("bento:onboarding-complete", "1");
    render(<EditableSettingsPage controller={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Telegram" }));
    expect(screen.getByText("Guardado de forma segura")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/token/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar secreto" }));
    expect(state.setSecret).toHaveBeenCalledWith("telegram_bot_token", { operation: "set", value: "" });
    fireEvent.click(screen.getByRole("button", { name: "Eliminar secreto" }));
    expect(state.setSecret).toHaveBeenCalledWith("telegram_bot_token", { operation: "clear" });
  });

  it("announces validation, restart progress and rollback while keeping discard available", () => {
    const state = controller({
      applyOutcome: { restartPlan: { affected_keys: ["storage_backend"], mode: "restart_services", services: ["api"] }, rolledBack: true },
      applyProgress: [{ phase: "validating", status: "ok" }, { phase: "rolling-back", status: "started" }],
      dirty: true,
      validation: { errors: [], probes: [], restart_plan: { affected_keys: ["storage_backend"], mode: "restart_services", services: ["api"] }, valid: true, warnings: [] },
    });
    render(<EditableSettingsPage controller={state} />);
    expect(screen.getByRole("region", { name: "Acciones para cambios sin guardar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(state.discard).toHaveBeenCalledOnce();
    expect(screen.getByText("Restaurando la última configuración válida")).toBeInTheDocument();
    expect(screen.getByText("Se restauró la configuración anterior")).toBeInTheDocument();
  });

  it("recovers explicitly from a revision conflict and localizes server field errors", () => {
    const state = controller({
      conflict: true,
      fieldErrors: { storage_backend: [{ code: "telegram_not_configured", key: "storage_backend", message: "must not be displayed" }] },
      validation: { errors: [{ code: "telegram_not_configured", key: "storage_backend", message: "must not be displayed" }], probes: [], restart_plan: { affected_keys: [], mode: "live", services: [] }, valid: false, warnings: [] },
    });
    render(<EditableSettingsPage controller={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Recargar ajustes" }));
    expect(state.refresh).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Almacenamiento" }));
    expect(screen.getByText("Completa los secretos de Telegram antes de activar este almacenamiento.")).toBeInTheDocument();
    expect(screen.queryByText("must not be displayed")).not.toBeInTheDocument();
  });
});
