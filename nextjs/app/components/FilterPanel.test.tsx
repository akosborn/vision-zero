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
    onStartRouteDrawing?: Mock<() => void>;
    onClearRoute?: Mock<() => void>;
  } = {},
) => {
  const setFilters = vi.fn() as React.Dispatch<React.SetStateAction<Filters>>;
  const onSearchToolChange = options.onSearchToolChange || vi.fn();
  const onStartRouteDrawing = options.onStartRouteDrawing || vi.fn();
  const onClearRoute = options.onClearRoute || vi.fn();

  render(
    <MantineProvider>
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        closeMobileFilters={vi.fn()}
        setAreaOfInterestIncidentGeoJson={vi.fn()}
        incidentGeoJson={null}
        setIncidentGeoJson={vi.fn()}
        onApplyStreetSearch={vi.fn()}
        onApplyRadiusSearch={vi.fn()}
        onApplyUploadRoute={vi.fn()}
        onSearchToolChange={onSearchToolChange}
        hasAppliedRoute={options.hasAppliedRoute || false}
        onStartRouteDrawing={onStartRouteDrawing}
        onClearRoute={onClearRoute}
        isLoading={false}
        streets={[]}
      />
    </MantineProvider>,
  );

  return { onSearchToolChange, onStartRouteDrawing, onClearRoute };
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

  it("routes mode changes through the parent cleanup boundary", async () => {
    const user = userEvent.setup();
    const { onSearchToolChange } = renderPanel(
      { searchTool: "Radius Search", bufferRadiusInFeet: 20 },
      { onSearchToolChange: vi.fn() },
    );

    await user.click(screen.getByText("Draw Route"));

    expect(onSearchToolChange).toHaveBeenCalledWith("Draw Route");
    expect(testHarness.replace).toHaveBeenCalledWith("?tool=Draw+Route", {
      scroll: false,
    });
  });

  it("labels route distance as a buffer and leaves Apply to map controls", () => {
    renderPanel({ searchTool: "Draw Route", bufferRadiusInFeet: 20 });

    expect(screen.getByLabelText("Buffer (ft)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it.each([
    ["desktop", false],
    ["mobile", true],
  ])(
    "shows Start Drawing, then Clear Route after Apply on %s",
    async (_label, isMobile) => {
      testHarness.isMobile = isMobile;
      const user = userEvent.setup();
      const startDrawing = vi.fn();
      const clearRoute = vi.fn();

      renderPanel(
        { searchTool: "Draw Route", bufferRadiusInFeet: 20 },
        { onStartRouteDrawing: startDrawing, onClearRoute: clearRoute },
      );

      await user.click(screen.getByRole("button", { name: "Start Drawing" }));
      expect(startDrawing).toHaveBeenCalledOnce();
      expect(screen.queryByRole("button", { name: "Clear Route" })).toBeNull();

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
      await user.click(screen.getByRole("button", { name: "Clear Route" }));
      expect(clearRoute).toHaveBeenCalledOnce();
    },
  );
});
