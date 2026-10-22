import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog } from "./dialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog open={open} title="Sure?" onClose={() => setOpen(false)}>
        <button onClick={() => setOpen(false)}>First</button>
        <button>Last</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  });

  it("returns focus to the opener", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
  });

  it("is labelled by its title", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog", { name: "Sure?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("Unit: right placement anchors the panel to the right edge", () => {
    render(
      <Dialog open title="Side" placement="right" onClose={() => undefined}>
        <button>Inside</button>
      </Dialog>,
    );

    const panel = screen.getByRole("dialog");
    expect(panel).toHaveClass("h-full", "overflow-y-auto");
    expect(panel.parentElement).toHaveClass("justify-end");
  });

  it("Unit: default placement stays centred", () => {
    render(
      <Dialog open title="Middle" onClose={() => undefined}>
        <button>Inside</button>
      </Dialog>,
    );

    const panel = screen.getByRole("dialog");
    expect(panel).not.toHaveClass("h-full");
    expect(panel.parentElement).toHaveClass("justify-center");
  });
});
