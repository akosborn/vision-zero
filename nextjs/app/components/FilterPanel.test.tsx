import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Filters } from "@/app/page";

import FilterPanel from "./FilterPanel";

const testHarness = vi.hoisted(() => ({
  isMobile: false,
  replace: vi.fn(),
}));

vi.mock("@mantine/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mantine/hooks")>();
  return {
    ...actual,
    useMediaQuery: () => testHarness.isMobile,
  };
});

vi.mock("next/dist/client/components/navigation", () => ({
  useRouter: () => ({ replace: testHarness.replace }),
  useSearchParams: () => new URLSearchParams(),
}));

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

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const renderPanel = (
  filters: Filters,
  options: {
    onSearchToolChange?: Mock<(searchTool: Filters["searchTool"]) => void>;
    hasAppliedRoute?: boolean;
    isDrawingRoute?: boolean;
    routeDrawingVertexCount?: number;
    canApplyDrawnRoute?: boolean;
    onNewRouteLine?: Mock<() => void>;
    onStartRouteDrawing?: Mock<() => void>;
    onCancelRouteDrawing?: Mock<() => void>;
    onUndoRouteDrawing?: Mock<() => void>;
    onClearRouteDrawing?: Mock<() => void>;
    onApplyDrawnRoute?: Mock<() => void>;
    onClearRoute?: Mock<() => void>;
    onDateRangeChange?: Mock<
      (dateRange: { from?: string; to?: string }) => void
    >;
  } = {},
) => {
  const setFilters = vi.fn() as React.Dispatch<React.SetStateAction<Filters>>;
  const onSearchToolChange = options.onSearchToolChange || vi.fn();
  const onStartRouteDrawing = options.onStartRouteDrawing || vi.fn();
  const onCancelRouteDrawing = options.onCancelRouteDrawing || vi.fn();
  const onUndoRouteDrawing = options.onUndoRouteDrawing || vi.fn();
  const onClearRouteDrawing = options.onClearRouteDrawing || vi.fn();
  const onApplyDrawnRoute = options.onApplyDrawnRoute || vi.fn();
  const onClearRoute = options.onClearRoute || vi.fn();
  const onDateRangeChange = options.onDateRangeChange || vi.fn();

  render(
    <MantineProvider>
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        closeMobileFilters={vi.fn()}
        onApplyStreetSearch={vi.fn()}
        onApplyRadiusSearch={vi.fn()}
        onApplyUploadRoute={vi.fn()}
        onSearchToolChange={onSearchToolChange}
        hasAppliedRoute={options.hasAppliedRoute || false}
        isDrawingRoute={options.isDrawingRoute || false}
        routeDrawingVertexCount={options.routeDrawingVertexCount || 0}
        canApplyDrawnRoute={options.canApplyDrawnRoute || false}
        canStartNewRouteLine={options.canApplyDrawnRoute || false}
        onNewRouteLine={options.onNewRouteLine || vi.fn()}
        onStartRouteDrawing={onStartRouteDrawing}
        onCancelRouteDrawing={onCancelRouteDrawing}
        onUndoRouteDrawing={onUndoRouteDrawing}
        onClearRouteDrawing={onClearRouteDrawing}
        onApplyDrawnRoute={onApplyDrawnRoute}
        onClearRoute={onClearRoute}
        onDateRangeChange={onDateRangeChange}
        isLoading={false}
        streets={[]}
      />
    </MantineProvider>,
  );

  return {
    onSearchToolChange,
    onStartRouteDrawing,
    onCancelRouteDrawing,
    onUndoRouteDrawing,
    onClearRouteDrawing,
    onApplyDrawnRoute,
    onClearRoute,
    onDateRangeChange,
  };
};

describe("FilterPanel route modes", () => {
  afterEach(() => {
    cleanup();
    testHarness.isMobile = false;
    testHarness.replace.mockReset();
  });

  it("offers the same enabled tools on desktop and mobile", () => {
    renderPanel({ searchTool: "Radius Search", bufferRadiusInFeet: 20 });
    const desktopTools = screen
      .getAllByRole("radio")
      .map((element) => element.getAttribute("value"));

    cleanup();
    testHarness.isMobile = true;
    renderPanel({ searchTool: "Radius Search", bufferRadiusInFeet: 20 });
    const mobileTools = screen
      .getAllByRole("radio")
      .map((element) => element.getAttribute("value"));

    expect(mobileTools).toEqual(desktopTools);
    expect(mobileTools).toContain("Draw Route");
  });

  it.each([
    ["desktop", false],
    ["mobile", true],
  ])("accepts the 1,000-foot radius default on %s", (_label, isMobile) => {
    testHarness.isMobile = isMobile;
    renderPanel({ searchTool: "Radius Search", bufferRadiusInFeet: 1000 });

    expect(screen.getByLabelText("Radius (ft)")).toHaveValue("1000");
  });

  it("routes draft mode changes through the parent without changing the URL", async () => {
    const user = userEvent.setup();
    const { onSearchToolChange } = renderPanel(
      { searchTool: "Radius Search", bufferRadiusInFeet: 20 },
      { onSearchToolChange: vi.fn() },
    );

    await user.click(screen.getByText("Draw Route"));

    expect(onSearchToolChange).toHaveBeenCalledWith("Draw Route");
    expect(testHarness.replace).not.toHaveBeenCalled();
  });

  it("labels route distance as a buffer and leaves Apply to map controls", () => {
    renderPanel({ searchTool: "Draw Route", bufferRadiusInFeet: 20 });

    expect(screen.getByLabelText("Buffer (ft)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.queryByText(/start drawing, then/i)).toBeNull();
  });

  it.each([
    ["desktop", false],
    ["mobile", true],
  ])(
    "moves through Start, Cancel, and Clear Route states on %s",
    async (_label, isMobile) => {
      testHarness.isMobile = isMobile;
      const user = userEvent.setup();
      const startDrawing = vi.fn();
      const cancelDrawing = vi.fn();
      const undoDrawing = vi.fn();
      const newLine = vi.fn();
      const clearDrawing = vi.fn();
      const applyDrawing = vi.fn();
      const clearRoute = vi.fn();

      renderPanel(
        { searchTool: "Draw Route", bufferRadiusInFeet: 20 },
        { onStartRouteDrawing: startDrawing, onClearRoute: clearRoute },
      );

      await user.click(screen.getByRole("button", { name: "Start Drawing" }));
      expect(startDrawing).toHaveBeenCalledOnce();
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Clear Route" })).toBeNull();

      cleanup();
      renderPanel(
        { searchTool: "Draw Route", bufferRadiusInFeet: 20 },
        {
          isDrawingRoute: true,
          routeDrawingVertexCount: 2,
          canApplyDrawnRoute: true,
          onCancelRouteDrawing: cancelDrawing,
          onUndoRouteDrawing: undoDrawing,
          onNewRouteLine: newLine,
          onClearRouteDrawing: clearDrawing,
          onApplyDrawnRoute: applyDrawing,
        },
      );

      expect(
        screen.queryByRole("button", { name: "Start Drawing" }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Clear Route" })).toBeNull();
      expect(screen.queryByText(/start drawing, then/i)).toBeNull();
      expect(screen.queryByText(/click or tap the map/i)).toBeNull();
      expect(
        screen.getByText("Click on map to plot route"),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "New line" }));
      expect(newLine).toHaveBeenCalledOnce();
      await user.click(screen.getByRole("button", { name: "Undo" }));
      await user.click(screen.getByRole("button", { name: "Clear" }));
      await user.click(screen.getByRole("button", { name: "Apply" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(undoDrawing).toHaveBeenCalledOnce();
      expect(clearDrawing).toHaveBeenCalledOnce();
      expect(applyDrawing).toHaveBeenCalledOnce();
      expect(cancelDrawing).toHaveBeenCalledOnce();

      cleanup();
      renderPanel(
        { searchTool: "Draw Route", bufferRadiusInFeet: 20 },
        {
          hasAppliedRoute: true,
          onStartRouteDrawing: startDrawing,
          onClearRoute: clearRoute,
        },
      );

      expect(
        screen.queryByRole("button", { name: "Start Drawing" }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
      await user.click(screen.getByRole("button", { name: "Clear Route" }));
      expect(clearRoute).toHaveBeenCalledOnce();
    },
  );
});
