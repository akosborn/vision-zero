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
  onNewLine: vi.fn(),
  onUndo: vi.fn(),
  onClear: vi.fn(),
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
          canStartNewLine={false}
          isLoading={false}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole("button", { name: "New line" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.queryByText(/click or tap the map/i)).toBeNull();
    expect(
      Array.from(
        screen.getByRole("group", { name: /Route drawing controls/ }).children,
      ).map((element) => element.textContent),
    ).toEqual([
      "Click on map to plot route",
      "New line",
      "Undo",
      "Clear",
      "Apply",
    ]);

    rerender(
      <MantineProvider>
        <RouteDrawingControls
          {...handlers}
          vertexCount={2}
          canApply
          canStartNewLine
          isLoading={false}
        />
      </MantineProvider>,
    );

    await user.click(screen.getByRole("button", { name: "New line" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(handlers.onNewLine).toHaveBeenCalledOnce();
    expect(handlers.onUndo).toHaveBeenCalledOnce();
    expect(handlers.onClear).toHaveBeenCalledOnce();
    expect(handlers.onApply).toHaveBeenCalledOnce();
  });
});
