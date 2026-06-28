import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsPage } from "../../features/settings/SettingsPage";

describe("SettingsPage", () => {
  it("renders storage, Telegram, provider, model, and worker status", () => {
    render(
      <SettingsPage
        settings={{
          data_paths: {
            cache: "D:\\secret\\cache",
            uploads: "D:\\secret\\uploads",
          },
          embeddings_state: "pending",
          model_available: false,
          ocr_state: "ready",
          storage_backend: "telegram",
          telegram_configured: true,
          worker_concurrency: 1,
          worker_status: "running",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Ajustes" })).toBeInTheDocument();
    expect(screen.getAllByText("Telegram").length).toBeGreaterThan(0);
    expect(screen.getByText("Configurado")).toBeInTheDocument();
    expect(screen.getByText("Listo")).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
    expect(screen.getByText("En ejecucion")).toBeInTheDocument();
    expect(screen.getByText("cache, uploads")).toBeInTheDocument();
    expect(screen.queryByText("D:\\secret\\cache")).not.toBeInTheDocument();
  });

  it("renders foundation settings shape without optional fields", () => {
    render(
      <SettingsPage
        settings={{
          storage_backend: "local",
          telegram_enabled: false,
          worker_concurrency: 1,
        }}
      />,
    );

    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("No configurado")).toBeInTheDocument();
    expect(screen.getAllByText("Deshabilitado").length).toBeGreaterThan(0);
    expect(screen.getByText("Concurrencia: 1")).toBeInTheDocument();
  });
});
