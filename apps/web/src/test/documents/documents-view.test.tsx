import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SearchApi, SearchRequest } from "../../api/search";
import { DocumentsView } from "../../features/documents";

describe("DocumentsView", () => {
  it("applies a document search filter by default", async () => {
    window.history.pushState({}, "", "/documents");
    const calls: SearchRequest[] = [];

    render(<DocumentsView client={makeClient(calls)} />);

    await waitFor(() => expect(calls[0]).toEqual(expect.objectContaining({ type: "document" })));
    expect(await screen.findByRole("heading", { name: "Documentos" })).toBeInTheDocument();
  });

  it("can switch the filtered document view to PDF pages", async () => {
    window.history.pushState({}, "", "/documents?type=document");
    const calls: SearchRequest[] = [];

    render(<DocumentsView client={makeClient(calls)} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "pdf_page" } });

    await waitFor(() => expect(calls).toContainEqual(expect.objectContaining({ type: "pdf_page" })));
    expect(window.location.search).toContain("type=pdf_page");
  });
});

function makeClient(calls: SearchRequest[]): SearchApi {
  return {
    search: vi.fn(async (request: SearchRequest) => {
      calls.push(request);

      return {
        facets: [],
        items: [],
        next_cursor: null,
      };
    }),
  };
}
