import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OnboardingWizard } from "../../features/onboarding/OnboardingWizard";
import type { SettingsController } from "../../features/settings/useSettingsController";

describe("first-run wizard", () => {
  it("uses local-safe choices, the native picker and completes after validation", async () => {
    const state = {
      draft: { data_dir: "/safe/data", embeddings_provider: "disabled", ocr_provider: "disabled", storage_backend: "local" },
      isApplying: false,
      pickPath: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      setDataMigration: vi.fn(),
      setValue: vi.fn(),
      validate: vi.fn().mockResolvedValue({ errors: [], probes: [], restart_plan: { affected_keys: [], mode: "live", services: [] }, valid: true, warnings: [] }),
    } as unknown as SettingsController;
    const onComplete = vi.fn();
    render(<OnboardingWizard controller={state} onComplete={onComplete} />);

    expect(screen.getByRole("heading", { name: "Prepara tu Bento" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Elegir ruta" }));
    expect(state.pickPath).toHaveBeenCalledWith("data_dir");
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(screen.getByText("Solo este equipo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(screen.getByText("OCR en imágenes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Terminar configuración" }));

    await waitFor(() => expect(state.validate).toHaveBeenCalledWith(true));
    expect(state.save).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
