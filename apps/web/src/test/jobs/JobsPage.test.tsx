import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobsPage } from "../../features/jobs/JobsPage";
import type { JobRecord } from "../../api/jobs";

const jobs: JobRecord[] = [
  {
    attempts: 2,
    created_at: "2026-01-01T00:00:00Z",
    error: "OCR timeout",
    id: "failed-1",
    max_attempts: 3,
    priority: 3,
    status: "failed",
    type: "ocr",
    updated_at: "2026-01-01T00:05:00Z",
  },
  {
    attempts: 0,
    created_at: "2026-01-01T00:00:00Z",
    id: "running-1",
    max_attempts: 3,
    priority: 1,
    status: "running",
    type: "thumbnail",
    updated_at: "2026-01-01T00:01:00Z",
  },
];

describe("JobsPage", () => {
  it("renders jobs in a semantic table and retries a failed job", () => {
    const onRetry = vi.fn();

    render(<JobsPage jobs={jobs} onReindex={vi.fn()} onRetry={onRetry} />);

    expect(screen.getByRole("heading", { name: "Trabajos" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Trabajos de fondo recientes" })).toBeInTheDocument();
    expect(screen.getByText("OCR timeout")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar trabajo failed-1" }));

    expect(onRetry).toHaveBeenCalledWith("failed-1");
  });

  it("shows failed job state and retry progress", () => {
    render(<JobsPage jobs={jobs} onReindex={vi.fn()} onRetry={vi.fn()} retryingJobId="failed-1" />);

    expect(screen.getByText("Fallido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar trabajo failed-1" })).toBeDisabled();
    expect(screen.getByText("Reintentando")).toBeInTheDocument();
  });

  it("exposes the admin reindex action", () => {
    const onReindex = vi.fn();

    render(<JobsPage jobs={[]} onReindex={onReindex} onRetry={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reindexar" }));

    expect(onReindex).toHaveBeenCalledOnce();
  });
});
