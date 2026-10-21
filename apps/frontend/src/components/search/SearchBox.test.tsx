import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "./SearchBox";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

describe("SearchBox live mode", () => {
  it("shows the URL value in a search landmark", () => {
    render(<SearchBox value="budget" onQuery={() => {}} />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByLabelText("Search notes")).toHaveValue("budget");
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  });

  it("reports the trimmed text after 300 ms", async () => {
    const user = setup();
    const onQuery = vi.fn();
    render(<SearchBox value="" onQuery={onQuery} />);

    await user.type(screen.getByLabelText("Search notes"), " bud ");
    expect(onQuery).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);

    expect(onQuery).toHaveBeenCalledExactlyOnceWith("bud");
  });

  it("Enter reports at once", async () => {
    const user = setup();
    const onQuery = vi.fn();
    render(<SearchBox value="" onQuery={onQuery} />);

    await user.type(screen.getByLabelText("Search notes"), "bud{Enter}");

    expect(onQuery).toHaveBeenCalledExactlyOnceWith("bud");
    await vi.advanceTimersByTimeAsync(1000);
    expect(onQuery).toHaveBeenCalledTimes(1);
  });

  it("follows an outside change of the value", () => {
    const { rerender } = render(<SearchBox value="one" onQuery={() => {}} />);
    rerender(<SearchBox value="two" onQuery={() => {}} />);
    expect(screen.getByLabelText("Search notes")).toHaveValue("two");
  });

  it("keeps trailing spaces the user is typing", async () => {
    const user = setup();
    const { rerender } = render(<SearchBox value="" onQuery={() => {}} />);

    await user.type(screen.getByLabelText("Search notes"), "red ");
    rerender(<SearchBox value="red" onQuery={() => {}} />);

    expect(screen.getByLabelText("Search notes")).toHaveValue("red ");
  });
});

describe("SearchBox submit mode", () => {
  it("submits trimmed text with the button", async () => {
    const user = setup();
    const onSubmit = vi.fn();
    render(<SearchBox onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Search notes"), "  budget ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("budget");
  });

  it("submits with Enter", async () => {
    const user = setup();
    const onSubmit = vi.fn();
    render(<SearchBox onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Search notes"), "budget{Enter}");

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("budget");
  });

  it("ignores blank text and typing alone", async () => {
    const user = setup();
    const onSubmit = vi.fn();
    render(<SearchBox onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Search notes"), "   ");
    await vi.advanceTimersByTimeAsync(1000);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
