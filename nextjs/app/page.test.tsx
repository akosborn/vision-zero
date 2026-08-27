import { MantineProvider } from "@mantine/core";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { FeatureCollection, Point } from "geojson";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home, { type Filters, type SearchTool } from "./page";

type DateRange = { from?: string; to?: string };

type FilterPanelProps = {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  hasAppliedRoute: boolean;
  isDrawingRoute: boolean;
  canApplyDrawnRoute: boolean;
  onSearchToolChange: (searchTool: SearchTool) => void;
  onStartRouteDrawing: () => void;
  onApplyDrawnRoute: () => void;
  onDateRangeChange: (range: DateRange) => void;
};

const harness = vi.hoisted(() => ({
  filterPanelProps: null as FilterPanelProps | null,
  getStreets: vi.fn(),
  getIncidentsWithinBufferedRoute: vi.fn(),
}));

vi.mock("@/app/lib/api-client", () => ({
  getAnnualCrashHistory: vi.fn(),
  getBufferedStreetCenterlines: vi.fn(),
  getIncidents: vi.fn(),
  getIncidentsWithinBufferedRoute: harness.getIncidentsWithinBufferedRoute,
  getIncidentsWithinBufferedStreet: vi.fn(),
  getStreetCenterlines: vi.fn(),
  getStreets: harness.getStreets,
}));

vi.mock("./components/FilterPanel", () => ({
  default: (props: FilterPanelProps) => {
    harness.filterPanelProps = props;
    return React.createElement("div", { "data-testid": "filter-panel" });
  },
  isEnabledSearchTool: (value: string) =>
    ["Radius Search", "Street Search", "Upload Route", "Draw Route"].includes(
      value,
    ),
}));

vi.mock("./components/Map", async () => {
  const React = await import("react");
  const MockMap = React.forwardRef(
    (props: { onAddDrawnRouteVertex: (coordinate: number[]) => void }, ref) => {
      React.useImperativeHandle(ref, () => ({ getMap: () => ({}) }));
      return React.createElement(
        "div",
        { "data-testid": "map" },
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () => props.onAddDrawnRouteVertex([-104.99, 39.74]),
          },
          "Add first vertex",
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () => props.onAddDrawnRouteVertex([-104.98, 39.75]),
          },
          "Add second vertex",
        ),
      );
    },
  );
  MockMap.displayName = "MockMap";

  return {
    default: MockMap,
    DEFAULT_VIEWPORT: { latitude: 39.74, longitude: -104.9874, zoom: 13 },
  };
});

vi.mock("@/app/components/LocationReport", () => ({
  default: ({ crashFeatures }: { crashFeatures: Array<{ id?: string }> }) =>
    React.createElement(
      "div",
      { "data-testid": "location-report" },
      crashFeatures.map(({ id }) => id).join(","),
    ),
  ExportCsvButton: () => null,
}));

vi.mock("@/app/utils/map/zoom-to-layer", () => ({ default: vi.fn() }));

vi.mock("next/dist/client/components/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@mantine/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mantine/hooks")>();
  return { ...actual, useMediaQuery: () => false };
});

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

const crashResults = (id: string): FeatureCollection<Point> => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id,
      properties: {},
      geometry: { type: "Point", coordinates: [-104.985, 39.745] },
    },
  ],
});

const latestFilterPanelProps = (): FilterPanelProps => {
  expect(harness.filterPanelProps).not.toBeNull();
  return harness.filterPanelProps!;
};

describe("applied drawn-route date changes", () => {
  beforeEach(() => {
    harness.filterPanelProps = null;
    harness.getStreets.mockReset().mockResolvedValue([]);
    harness.getIncidentsWithinBufferedRoute.mockReset();
  });

  it("reruns the same route and replaces results for the new dates", async () => {
    harness.getIncidentsWithinBufferedRoute
      .mockResolvedValueOnce(crashResults("old-result"))
      .mockResolvedValueOnce(crashResults("new-result"));

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(latestFilterPanelProps().filters.searchTool).toBe("Radius Search");
      expect(harness.getStreets).toHaveBeenCalledOnce();
    });

    act(() => {
      latestFilterPanelProps().onSearchToolChange("Draw Route");
    });
    act(() => {
      latestFilterPanelProps().onStartRouteDrawing();
    });
    fireEvent.click(screen.getByRole("button", { name: "Add first vertex" }));
    fireEvent.click(screen.getByRole("button", { name: "Add second vertex" }));

    await waitFor(() => {
      expect(latestFilterPanelProps().canApplyDrawnRoute).toBe(true);
    });
    act(() => {
      latestFilterPanelProps().onApplyDrawnRoute();
    });

    await waitFor(() => {
      expect(harness.getIncidentsWithinBufferedRoute).toHaveBeenCalledOnce();
      expect(latestFilterPanelProps().hasAppliedRoute).toBe(true);
      expect(screen.getByTestId("location-report")).toHaveTextContent(
        "old-result",
      );
    });

    const firstRequest =
      harness.getIncidentsWithinBufferedRoute.mock.calls[0][0];
    const newDateRange = { from: "2024-01-01", to: "2024-12-31" };

    act(() => {
      latestFilterPanelProps().onDateRangeChange(newDateRange);
    });

    await waitFor(() => {
      expect(harness.getIncidentsWithinBufferedRoute).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("location-report")).toHaveTextContent(
        "new-result",
      );
    });

    const secondRequest =
      harness.getIncidentsWithinBufferedRoute.mock.calls[1][0];
    expect(secondRequest).toEqual({
      ...firstRequest,
      startDate: newDateRange.from,
      endDate: newDateRange.to,
    });
    expect(secondRequest.route).toEqual(firstRequest.route);
    expect(secondRequest.bufferInFeet).toBe(firstRequest.bufferInFeet);
    expect(screen.getByTestId("location-report")).not.toHaveTextContent(
      "old-result",
    );
  });
});
