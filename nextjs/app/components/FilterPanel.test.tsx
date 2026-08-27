import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const renderPanel = (filters: Filters, onSearchToolChange = vi.fn()) => {
  const setFilters = vi.fn() as React.Dispatch<React.SetStateAction<Filters>>;

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
        isLoading={false}
        streets={[]}
      />
    </MantineProvider>,
  );

  return onSearchToolChange;
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
    const onSearchToolChange = renderPanel(
      { searchTool: "Radius Search", bufferRadiusInFeet: 20 },
      vi.fn(),
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
});
