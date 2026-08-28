import { MantineProvider } from "@mantine/core";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Feature, FeatureCollection, LineString, Point } from "geojson";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home, { type Filters, type SearchTool } from "./page";
import type { CrashListFilters } from "./components/LocationReport/CrashList";
import { serializeQueryUrl } from "./lib/query-url";

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
  onApplyStreetSearch: () => Promise<void>;
  onApplyRadiusSearch: () => Promise<void>;
};

type LocationReportProps = {
  crashFeatures: Array<{ id?: string }>;
  crashSummaryHistory: Array<{ year: number }> | null;
  historyAvailable: boolean;
  selectedDateRange?: DateRange;
  crashListFilters: CrashListFilters;
  onCrashListFiltersChange: (filters: CrashListFilters) => void;
  selectedCrashFeature: Feature<Point> | null;
  onCrashSelect: (feature: Feature<Point>) => void;
};

type MapProps = {
  viewport: { latitude: number; longitude: number; zoom: number };
  selectedCrashFeature: Feature<Point> | null;
  selectedCrashCalloutIsOpen: boolean;
  onCrashSelect: (feature: Feature<Point> | null) => void;
  onAddDrawnRouteVertex: (coordinate: number[]) => void;
  onRadiusSearchPoint: (point: { lng: number; lat: number }) => void;
};

type ExportCsvButtonProps = {
  crashFeatures: Array<{ id?: string }>;
};

const harness = vi.hoisted(() => ({
  filterPanelProps: null as FilterPanelProps | null,
  locationReportProps: null as LocationReportProps | null,
  captureMapProps: vi.fn(),
  exportCsvButtonProps: null as ExportCsvButtonProps | null,
  getStreets: vi.fn(),
  getIncidentsWithinBufferedRoute: vi.fn(),
  getAnnualRouteCrashHistory: vi.fn(),
  getAnnualRadiusCrashHistory: vi.fn(),
  getIncidents: vi.fn(),
  getAnnualCrashHistory: vi.fn(),
  getBufferedStreetCenterlines: vi.fn(),
  getIncidentsWithinBufferedStreet: vi.fn(),
  getStreetCenterlines: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("@/app/lib/api-client", () => ({
  getAnnualCrashHistory: harness.getAnnualCrashHistory,
  getAnnualRadiusCrashHistory: harness.getAnnualRadiusCrashHistory,
  getAnnualRouteCrashHistory: harness.getAnnualRouteCrashHistory,
  getBufferedStreetCenterlines: harness.getBufferedStreetCenterlines,
  getIncidents: harness.getIncidents,
  getIncidentsWithinBufferedRoute: harness.getIncidentsWithinBufferedRoute,
  getIncidentsWithinBufferedStreet: harness.getIncidentsWithinBufferedStreet,
  getStreetCenterlines: harness.getStreetCenterlines,
  getStreets: harness.getStreets,
}));

vi.mock("./components/FilterPanel", () => ({
  ENABLED_SEARCH_TOOLS: [
    "Street Search",
    "Radius Search",
    "Upload Route",
    "Draw Route",
  ],
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
  const MockMap = React.forwardRef((props: MapProps, ref) => {
    harness.captureMapProps(props);
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
  });
  MockMap.displayName = "MockMap";

  return {
    default: MockMap,
    DEFAULT_VIEWPORT: { latitude: 39.74, longitude: -104.9874, zoom: 13 },
  };
});

vi.mock("@/app/components/LocationReport", () => ({
  default: (props: LocationReportProps) => {
    harness.locationReportProps = props;
    return React.createElement(
      "div",
      { "data-testid": "location-report" },
      props.crashFeatures.map(({ id }) => id).join(","),
    );
  },
  ExportCsvButton: (props: ExportCsvButtonProps) => {
    harness.exportCsvButtonProps = props;
    return null;
  },
}));

vi.mock("@/app/utils/map/zoom-to-layer", () => ({ default: vi.fn() }));

vi.mock("next/dist/client/components/navigation", () => ({
  useRouter: () => ({ replace: harness.replace }),
  useSearchParams: () => harness.searchParams,
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
      properties: {
        doti_incident_id: id,
        doti_first_occurrence_date: "2026-08-25T13:34:00-06:00",
        doti_fatalities: 0,
        doti_serious_injuries: 0,
        doti_bicycle_involved: false,
        doti_pedestrian_involved: false,
        doti_bicycle_count: 0,
        doti_pedestrian_count: 0,
        cdot_cuid: null,
      },
      geometry: { type: "Point", coordinates: [-104.985, 39.745] },
    },
  ],
});

const latestFilterPanelProps = (): FilterPanelProps => {
  expect(harness.filterPanelProps).not.toBeNull();
  return harness.filterPanelProps!;
};

const latestMapProps = (): MapProps => {
  const calls = harness.captureMapProps.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls.at(-1)![0];
};

describe("page-owned query execution", () => {
  beforeEach(() => {
    harness.filterPanelProps = null;
    harness.locationReportProps = null;
    harness.captureMapProps.mockReset();
    harness.exportCsvButtonProps = null;
    harness.getStreets.mockReset().mockResolvedValue([]);
    harness.getIncidentsWithinBufferedRoute.mockReset();
    harness.getAnnualRouteCrashHistory
      .mockReset()
      .mockResolvedValue([{ year: 2024 }]);
    harness.getAnnualRadiusCrashHistory
      .mockReset()
      .mockResolvedValue([{ year: 2024 }]);
    harness.getIncidents.mockReset();
    harness.getAnnualCrashHistory
      .mockReset()
      .mockResolvedValue([{ year: 2024 }]);
    harness.getBufferedStreetCenterlines.mockReset();
    harness.getIncidentsWithinBufferedStreet.mockReset();
    harness.getStreetCenterlines.mockReset();
    harness.replace.mockReset();
    harness.searchParams = new URLSearchParams();
  });

  it("defaults radius searches to 1,000 feet", async () => {
    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(latestFilterPanelProps().filters).toMatchObject({
        searchTool: "Radius Search",
        bufferRadiusInFeet: 1000,
      });
    });
  });

  it("runs blank-map radius searches through the page API boundary", async () => {
    harness.getIncidents.mockResolvedValueOnce(crashResults("radius-result"));

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    await waitFor(() => expect(harness.getStreets).toHaveBeenCalledOnce());
    act(() => {
      latestMapProps().onRadiusSearchPoint({ lat: 39.75, lng: -104.96 });
    });

    await waitFor(() => {
      expect(harness.getIncidents).toHaveBeenCalledWith({
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        lat: 39.75,
        lng: -104.96,
        radiusInFeet: 1000,
      });
      expect(harness.getAnnualRadiusCrashHistory).toHaveBeenCalledWith({
        lat: 39.75,
        lng: -104.96,
        radiusInFeet: 1000,
      });
      expect(screen.getByTestId("location-report")).toHaveTextContent(
        "radius-result",
      );
    });
    const replacement = harness.replace.mock.calls.at(-1)?.[0] as string;
    expect(replacement).toContain("v=1&tool=radius");
    expect(replacement).toContain("lat=39.75&lng=-104.96&radiusFeet=1000");
  });

  it("restores and executes a complete radius query once", async () => {
    harness.searchParams = new URLSearchParams(
      "v=1&tool=radius&from=2025-01-01&to=2025-12-31&lat=39.7392&lng=-104.9903&radiusFeet=500",
    );
    harness.getIncidents.mockResolvedValueOnce(crashResults("restored-radius"));

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(latestFilterPanelProps().filters).toMatchObject({
        searchTool: "Radius Search",
        dateRange: { from: "2025-01-01", to: "2025-12-31" },
        bufferRadiusInFeet: 500,
        droppedPin: { lat: 39.7392, lng: -104.9903 },
      });
      expect(harness.getIncidents).toHaveBeenCalledOnce();
      expect(screen.getByTestId("location-report")).toHaveTextContent(
        "restored-radius",
      );
    });
    expect(harness.replace).toHaveBeenCalledOnce();
  });

  it("enables copying after a successful zero-result query", async () => {
    harness.getIncidents.mockResolvedValueOnce({
      type: "FeatureCollection",
      features: [],
    });

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );
    await waitFor(() => expect(harness.getStreets).toHaveBeenCalledOnce());
    act(() => {
      latestMapProps().onRadiusSearchPoint({ lat: 39.75, lng: -104.96 });
    });

    expect(
      await screen.findByRole("button", { name: "Copy query link" }),
    ).toBeEnabled();
    expect(harness.replace).toHaveBeenCalledOnce();
  });

  it("runs an oversized drawn route but disables its link", async () => {
    harness.getIncidentsWithinBufferedRoute.mockResolvedValueOnce({
      type: "FeatureCollection",
      features: [],
    });

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );
    await waitFor(() => expect(harness.getStreets).toHaveBeenCalledOnce());
    act(() => {
      latestFilterPanelProps().onSearchToolChange("Draw Route");
      latestFilterPanelProps().onStartRouteDrawing();
    });
    act(() => {
      for (let index = 0; index < 1001; index += 1) {
        latestMapProps().onAddDrawnRouteVertex([
          -104.99 + index / 1_000_000,
          39.74,
        ]);
      }
    });
    await waitFor(() => {
      expect(latestFilterPanelProps().canApplyDrawnRoute).toBe(true);
    });
    await act(async () => {
      latestFilterPanelProps().onApplyDrawnRoute();
    });

    await waitFor(() => {
      expect(harness.getIncidentsWithinBufferedRoute).toHaveBeenCalledOnce();
      expect(
        screen.getByRole("button", { name: "Copy query link" }),
      ).toBeDisabled();
    });
    expect(
      screen.getByTitle(
        "This route has too many points to fit safely in a link.",
      ),
    ).toBeInTheDocument();
    expect(harness.replace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("restores decoded drawn-route geometry and its original API semantics", async () => {
    const route: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [-104.99, 39.74],
              [-104.98, 39.75],
            ],
          },
        },
      ],
    };
    harness.searchParams = serializeQueryUrl({
      version: 1,
      tool: "draw",
      dateRange: { from: "2025-01-01", to: "2025-12-31" },
      route,
      bufferFeet: 125,
    });
    harness.getIncidentsWithinBufferedRoute.mockResolvedValueOnce(
      crashResults("restored-route"),
    );

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(latestFilterPanelProps().filters).toMatchObject({
        searchTool: "Draw Route",
        dateRange: { from: "2025-01-01", to: "2025-12-31" },
        bufferRadiusInFeet: 125,
      });
      expect(latestFilterPanelProps().hasAppliedRoute).toBe(true);
      expect(screen.getByTestId("location-report")).toHaveTextContent(
        "restored-route",
      );
    });
    expect(harness.getIncidentsWithinBufferedRoute).toHaveBeenCalledWith({
      route,
      bufferInFeet: 125,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
  });

  it("restores a legacy street radius and canonicalizes it after success", async () => {
    harness.searchParams = new URLSearchParams(
      "tool=Street+Search&fromDate=2025-01-01&toDate=2025-12-31&r=250&street=E+COLFAX+AVE&crossStreet1=N+BROADWAY&crossStreet2=N+LINCOLN+ST",
    );
    harness.getStreetCenterlines.mockResolvedValueOnce({
      type: "FeatureCollection",
      features: [],
    });
    harness.getBufferedStreetCenterlines.mockResolvedValueOnce({
      type: "FeatureCollection",
      features: [],
    });
    harness.getIncidentsWithinBufferedStreet.mockResolvedValueOnce(
      crashResults("legacy-street"),
    );

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(latestFilterPanelProps().filters).toMatchObject({
        searchTool: "Street Search",
        bufferRadiusInFeet: 250,
        streetSegment: {
          fullName: "E COLFAX AVE",
          crossStreets: { from: "N BROADWAY", to: "N LINCOLN ST" },
        },
      });
      expect(screen.getByTestId("location-report")).toHaveTextContent(
        "legacy-street",
      );
    });
    expect(harness.replace).toHaveBeenCalledWith(
      expect.stringContaining("?v=1&tool=street"),
      { scroll: false },
    );
  });

  it("rejects an invalid link without issuing a crash request", async () => {
    harness.searchParams = new URLSearchParams(
      "v=1&tool=radius&from=2025-02-30&to=2025-12-31&lat=39.7&lng=-104.9&radiusFeet=100",
    );

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    expect(await screen.findByText(/query link is invalid/i)).toBeVisible();
    expect(harness.getIncidents).not.toHaveBeenCalled();
    expect(harness.getIncidentsWithinBufferedStreet).not.toHaveBeenCalled();
    expect(harness.getIncidentsWithinBufferedRoute).not.toHaveBeenCalled();
    expect(harness.replace).not.toHaveBeenCalled();
    expect(latestFilterPanelProps().filters.searchTool).toBe("Radius Search");
  });

  it("keeps the previous report and URL when a replacement query fails", async () => {
    harness.getIncidents
      .mockResolvedValueOnce(crashResults("stable-result"))
      .mockRejectedValueOnce(new Error("network unavailable"));

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );
    await waitFor(() => expect(harness.getStreets).toHaveBeenCalledOnce());

    act(() => {
      latestMapProps().onRadiusSearchPoint({ lat: 39.75, lng: -104.96 });
    });
    await waitFor(() => {
      expect(screen.getByTestId("location-report")).toHaveTextContent(
        "stable-result",
      );
      expect(harness.replace).toHaveBeenCalledOnce();
    });
    const stableUrl = harness.replace.mock.calls[0][0];

    act(() => {
      latestMapProps().onRadiusSearchPoint({ lat: 39.76, lng: -104.95 });
    });
    expect(
      await screen.findByText(/previous report is unchanged/i),
    ).toBeVisible();
    expect(screen.getByTestId("location-report")).toHaveTextContent(
      "stable-result",
    );
    expect(harness.replace).toHaveBeenCalledOnce();
    expect(harness.replace.mock.calls[0][0]).toBe(stableUrl);
  });

  it("preserves the street API payload behind the shared runner", async () => {
    const centerlines = { type: "FeatureCollection", features: [] };
    const buffer = { type: "FeatureCollection", features: [] };
    harness.getStreetCenterlines.mockResolvedValueOnce(centerlines);
    harness.getBufferedStreetCenterlines.mockResolvedValueOnce(buffer);
    harness.getIncidentsWithinBufferedStreet.mockResolvedValueOnce(
      crashResults("street-result"),
    );

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );
    await waitFor(() => expect(harness.getStreets).toHaveBeenCalledOnce());

    act(() => {
      latestFilterPanelProps().setFilters((previous) => ({
        ...previous,
        searchTool: "Street Search",
        bufferRadiusInFeet: 250,
        dateRange: { from: "2025-01-01", to: "2025-12-31" },
        streetSegment: {
          fullName: "E COLFAX AVE",
          crossStreets: { from: "N BROADWAY", to: "N LINCOLN ST" },
        },
      }));
    });
    await act(async () => {
      await latestFilterPanelProps().onApplyStreetSearch();
    });

    expect(harness.getStreetCenterlines).toHaveBeenCalledWith({
      fullName: "E COLFAX AVE",
      crossStreets: { from: "N BROADWAY", to: "N LINCOLN ST" },
    });
    expect(harness.getIncidentsWithinBufferedStreet).toHaveBeenCalledWith({
      fullName: "E COLFAX AVE",
      fullStreetName: "E COLFAX AVE",
      crossStreets: { from: "N BROADWAY", to: "N LINCOLN ST" },
      bufferInFeet: 250,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
    expect(screen.getByTestId("location-report")).toHaveTextContent(
      "street-result",
    );
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
      expect(harness.locationReportProps?.historyAvailable).toBe(true);
      expect(harness.locationReportProps?.crashSummaryHistory).toEqual([
        { year: 2024 },
      ]);
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
      expect(harness.locationReportProps?.selectedDateRange).toEqual(
        newDateRange,
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

  it("passes only crash-list matches to CSV export", async () => {
    harness.getIncidentsWithinBufferedRoute.mockResolvedValueOnce(
      crashResults("property-damage-vehicle"),
    );

    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    await waitFor(() => expect(harness.getStreets).toHaveBeenCalledOnce());

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
    act(() => latestFilterPanelProps().onApplyDrawnRoute());

    await waitFor(() => {
      expect(harness.exportCsvButtonProps?.crashFeatures).toHaveLength(1);
    });

    act(() => {
      harness.locationReportProps?.onCrashListFiltersChange({
        severity: "K",
        roadUser: "bicycle",
      });
    });

    await waitFor(() => {
      expect(harness.exportCsvButtonProps?.crashFeatures).toEqual([]);
      expect(harness.locationReportProps?.crashFeatures).toHaveLength(1);
      expect(harness.locationReportProps?.crashListFilters).toEqual({
        severity: "K",
        roadUser: "bicycle",
      });
    });
  });

  it("centers the map and shares the crash selected by the list", async () => {
    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    await waitFor(() => expect(harness.getStreets).toHaveBeenCalledOnce());

    const selectedCrash = crashResults("selected-crash").features[0];
    act(() => {
      harness.locationReportProps?.onCrashSelect(selectedCrash);
    });

    await waitFor(() => {
      expect(latestMapProps().selectedCrashFeature).toBe(selectedCrash);
      expect(latestMapProps().selectedCrashCalloutIsOpen).toBe(false);
      expect(latestMapProps().viewport).toEqual({
        latitude: 39.745,
        longitude: -104.985,
        zoom: 13,
      });
    });
  });

  it("shows, dismisses, and reopens a callout for map selections", async () => {
    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    await waitFor(() => expect(harness.getStreets).toHaveBeenCalledOnce());

    const selectedCrash = crashResults("selected-crash").features[0];
    act(() => latestMapProps().onCrashSelect(selectedCrash));

    await waitFor(() => {
      expect(latestMapProps().selectedCrashFeature).toBe(selectedCrash);
      expect(latestMapProps().selectedCrashCalloutIsOpen).toBe(true);
    });

    act(() => latestMapProps().onCrashSelect(null));
    await waitFor(() => {
      expect(latestMapProps().selectedCrashFeature).toBeNull();
      expect(latestMapProps().selectedCrashCalloutIsOpen).toBe(false);
    });

    act(() => latestMapProps().onCrashSelect(selectedCrash));
    await waitFor(() => {
      expect(latestMapProps().selectedCrashFeature).toBe(selectedCrash);
      expect(latestMapProps().selectedCrashCalloutIsOpen).toBe(true);
    });
  });
});
