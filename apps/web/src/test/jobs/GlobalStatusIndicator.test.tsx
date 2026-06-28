import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GlobalJobStatusIndicator, summarizeJobStatus } from "../../app/status";
import type { JobRecord } from "../../api/jobs";

const baseJob = {
  attempts: 0,
  created_at: "2026-01-01T00:00:00Z",
  max_attempts: 3,
  priority: 1,
  type: "thumbnail",
  updated_at: "2026-01-01T00:00:00Z",
} satisfies Omit<JobRecord, "id" | "status">;

describe("GlobalJobStatusIndicator", () => {
  it("prioritizes failed jobs in the summary", () => {
    const summary = summarizeJobStatus([
      { ...baseJob, id: "queued", status: "queued" },
      { ...baseJob, id: "failed", status: "failed" },
      { ...baseJob, id: "running", status: "running" },
    ]);

    expect(summary).toMatchObject({
      active: 1,
      failed: 1,
      pending: 1,
      tone: "danger",
    });
  });

  it("renders a polite status region for screen readers", () => {
    render(<GlobalJobStatusIndicator jobs={[{ ...baseJob, id: "queued", status: "queued" }]} />);

    expect(screen.getByRole("status")).toHaveTextContent("1 trabajos pendientes");
    expect(screen.getByRole("status")).toHaveTextContent("Pendientes: 1");
  });
});
