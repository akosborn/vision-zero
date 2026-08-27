import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import RouteDrawingControls from "./RouteDrawingControls";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const callbacks = () => ({
  onUndo: vi.fn(),
  onClear: vi.fn(),
  onCancel: vi.fn(),
  onApply: vi.fn(),
});

describe("RouteDrawingControls", () => {
  it("exposes editing actions and disables invalid operations", async () => {
    const handlers = callbacks();
    const user = userEvent.setup();
    const { rerender } = render(
      <MantineProvider>
        <RouteDrawingControls
          {...handlers}
          vertexCount={0}
          canApply={false}
          isLoading={false}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();

    rerender(
      <MantineProvider>
        <RouteDrawingControls
          {...handlers}
          vertexCount={2}
          canApply
          isLoading={false}
        />
      </MantineProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(handlers.onUndo).toHaveBeenCalledOnce();
    expect(handlers.onClear).toHaveBeenCalledOnce();
    expect(handlers.onCancel).toHaveBeenCalledOnce();
    expect(handlers.onApply).toHaveBeenCalledOnce();
  });
});
