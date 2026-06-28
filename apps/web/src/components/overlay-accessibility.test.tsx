import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Menu } from "./Menu";

describe("overlay accessibility", () => {
  it("opens the menu, focuses the first item, and returns focus on escape", () => {
    const onSelect = vi.fn();

    render(
      <Menu
        items={[{ id: "rename", label: "Renombrar", onSelect }]}
        label="Acciones"
        trigger={<span>Acciones</span>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Acciones" });
    fireEvent.click(trigger);

    const item = screen.getByRole("menuitem", { name: "Renombrar" });
    expect(item).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps dialog focus and closes with escape", () => {
    function DialogHarness() {
      const [open, setOpen] = useState(false);

      return (
        <div>
          <Button onClick={() => setOpen(true)}>Abrir</Button>
          <Dialog
            actions={<Button>Confirmar</Button>}
            onOpenChange={setOpen}
            open={open}
            title="Confirmacion"
          >
            Contenido del dialogo
          </Dialog>
        </div>
      );
    }

    render(<DialogHarness />);

    const opener = screen.getByRole("button", { name: "Abrir" });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole("dialog", { name: "Confirmacion" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
