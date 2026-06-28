import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the shell with navigation and global search", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: "Bento" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegacion principal" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Busqueda global" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fotos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Drive" })).toBeInTheDocument();
  });
});