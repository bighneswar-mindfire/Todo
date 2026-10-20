import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("sends a signed-out visitor to the login page", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });
});
