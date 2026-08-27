import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("handles user clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Show crashes</Button>);
    await user.click(screen.getByRole("button", { name: "Show crashes" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
