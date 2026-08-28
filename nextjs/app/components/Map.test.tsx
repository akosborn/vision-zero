import { act, render, screen } from "@testing-library/react";
import { Feature, FeatureCollection, Point } from "geojson";
import { GeoJSONFeature } from "mapbox-gl";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Crash } from "@/app/lib/api-client";
import { Filters } from "@/app/page";

import Map, { DEFAULT_VIEWPORT } from "./Map";

const mapHarness = vi.hoisted(() => ({
  interactiveLayerIds: [] as string[],
  onClick: undefined as ((event: unknown) => void) | undefined,
  doubleClickZoom: undefined as boolean | undefined,
  sourceData: {} as Record<string, unknown>,
  layers: {} as Record<string, unknown>,
  popupOnClose: undefined as (() => void) | undefined,
  popupCloseOnClick: undefined as boolean | undefined,
}));

vi.mock("react-map-gl/mapbox-legacy", async () => {
  const React = await import("react");
  const MockMap = React.forwardRef(
    (
      {
        children,
        doubleClickZoom,
        interactiveLayerIds,
        onClick,
      }: {
        children: React.ReactNode;
        doubleClickZoom: boolean;
        interactiveLayerIds: string[];
        onClick: (event: unknown) => void;
      },
      _ref,
    ) => {
      mapHarness.interactiveLayerIds = interactiveLayerIds;
      mapHarness.onClick = onClick;
      mapHarness.doubleClickZoom = doubleClickZoom;
      return React.createElement("div", { "data-testid": "map" }, children);
    },
  );
  MockMap.displayName = "MockMap";

  return {
    Layer: ({ id, ...props }: { id: string }) => {
      mapHarness.layers[id] = props;
      return null;
    },
    Map: MockMap,
    Popup: ({
      children,
      closeOnClick,
      onClose,
    }: {
      children: React.ReactNode;
      closeOnClick: boolean;
      onClose: () => void;
    }) => {
      mapHarness.popupOnClose = onClose;
      mapHarness.popupCloseOnClick = closeOnClick;
      return React.createElement("div", { "data-testid": "popup" }, children);
    },
    Source: ({
      children,
      data,
      id,
    }: {
      children: React.ReactNode;
      data: unknown;
      id?: string;
    }) => {
      if (id) {
        mapHarness.sourceData[id] = data;
      }
      return React.createElement(React.Fragment, null, children);
    },
  };
});

const feature = (
  properties: Partial<Crash>,
  id?: string | number,
): GeoJSONFeature =>
  ({
    type: "Feature",
    id,
    geometry: {
      type: "Point",
      coordinates: [-104.83836086, 39.78558161],
    },
    properties: {
      doti_incident_id: "DP2026473926",
      cdot_cuid: null,
      ...properties,
    },
  }) as unknown as GeoJSONFeature;

const renderMap = (
  overrides: Partial<React.ComponentProps<typeof Map>> = {},
) => {
  const filters: Filters = {
    searchTool: "Radius Search",
    bufferRadiusInFeet: 20,
  };

  const props: React.ComponentProps<typeof Map> = {
    filters,
    setFilters: vi.fn(),
    viewport: DEFAULT_VIEWPORT,
    setViewport: vi.fn(),
    isLoading: false,
    onRadiusSearchPoint: vi.fn(),
    isDrawingRoute: false,
    onAddDrawnRouteVertex: vi.fn(),
    selectedCrashFeature: null,
    selectedCrashCalloutIsOpen: false,
    onCrashSelect: vi.fn(),
    ...overrides,
  };

  const rendered = render(<Map {...props} />);

  return { ...rendered, props };
};

const selectFeature = (selectedFeature: GeoJSONFeature) => {
  act(() => {
    mapHarness.onClick?.({ features: [selectedFeature] });
  });
};

describe("Map crash popup source action", () => {
  beforeEach(() => {
    mapHarness.interactiveLayerIds = [];
    mapHarness.onClick = undefined;
    mapHarness.doubleClickZoom = undefined;
    mapHarness.sourceData = {};
    mapHarness.layers = {};
    mapHarness.popupOnClose = undefined;
    mapHarness.popupCloseOnClick = undefined;
  });

  it("links by semantic DOTI incident ID and makes both crash layers interactive", () => {
    const selectedCrashFeature = feature({}, 304214148) as unknown as Feature<
      Point,
      Crash
    >;
    renderMap({ selectedCrashFeature, selectedCrashCalloutIsOpen: true });

    expect(mapHarness.interactiveLayerIds).toEqual([
      "incident-layer",
      "area-of-interest-incident-layer",
    ]);

    const sourceLink = screen.getByRole("link", {
      name: "View DOTI source record for DP2026473926 (opens in a new tab)",
    });
    const sourceUrl = new URL(sourceLink.getAttribute("href")!);
    expect(`${sourceUrl.origin}${sourceUrl.pathname}`).toBe(
      "https://opendata-geospatialdenver.hub.arcgis.com/datasets/db00bd99ea534d8987e0913a191ebe19_325/explore",
    );
    expect(JSON.parse(atob(sourceUrl.searchParams.get("filters")!))).toEqual({
      incident_id: ["DP2026473926"],
    });
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
    const rawJson = screen.getByTestId("popup").querySelector("pre");
    expect(
      Boolean(
        sourceLink.compareDocumentPosition(rawJson!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it("renders a dedicated highlight and popup for a selected crash", () => {
    const selectedCrashFeature = feature(
      { doti_incident_id: "DP2026462495" },
      302740735,
    ) as unknown as Feature<Point, Crash>;

    renderMap({ selectedCrashFeature, selectedCrashCalloutIsOpen: true });

    expect(mapHarness.sourceData["selected-crash-source"]).toBe(
      selectedCrashFeature,
    );
    expect(mapHarness.layers["selected-crash-layer"]).toMatchObject({
      type: "circle",
      paint: {
        "circle-radius": 12,
        "circle-stroke-width": 3,
        "circle-stroke-color": "#1d4ed8",
      },
    });
    expect(screen.getByTestId("popup")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Crash details" })).toHaveStyle({
      maxHeight: "min(35dvh, 20rem)",
      overflowY: "auto",
      overscrollBehavior: "contain",
    });
    expect(mapHarness.popupCloseOnClick).toBe(false);
  });

  it("highlights a list-selected crash without showing its popup", () => {
    const selectedCrashFeature = feature({}, 304214148) as unknown as Feature<
      Point,
      Crash
    >;

    renderMap({ selectedCrashFeature, selectedCrashCalloutIsOpen: false });

    expect(mapHarness.sourceData["selected-crash-source"]).toBe(
      selectedCrashFeature,
    );
    expect(mapHarness.layers["selected-crash-layer"]).toBeDefined();
    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
  });

  it("reports a map-selected crash to the shared selection owner", () => {
    const onCrashSelect = vi.fn();
    renderMap({ onCrashSelect });

    selectFeature(feature({}, 304214148));

    expect(onCrashSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 304214148,
        geometry: expect.objectContaining({ type: "Point" }),
        properties: expect.objectContaining({
          doti_incident_id: "DP2026473926",
        }),
      }),
    );
  });

  it("can dismiss and reopen the callout by tapping the crash again", () => {
    const onCrashSelect = vi.fn();
    const selectedCrashFeature = feature({}, 304214148) as unknown as Feature<
      Point,
      Crash
    >;
    const { props, rerender } = renderMap({
      selectedCrashFeature,
      selectedCrashCalloutIsOpen: true,
      onCrashSelect,
    });

    expect(screen.getByTestId("popup")).toBeInTheDocument();

    act(() => mapHarness.popupOnClose?.());
    expect(onCrashSelect).toHaveBeenLastCalledWith(null);

    rerender(
      <Map
        {...props}
        selectedCrashFeature={null}
        selectedCrashCalloutIsOpen={false}
      />,
    );
    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();

    selectFeature(feature({}, 304214148));
    const reopenedFeature = onCrashSelect.mock.calls.at(-1)?.[0];
    expect(reopenedFeature).toMatchObject({ id: 304214148 });

    rerender(
      <Map
        {...props}
        selectedCrashFeature={reopenedFeature}
        selectedCrashCalloutIsOpen
      />,
    );
    expect(screen.getByTestId("popup")).toBeInTheDocument();
  });

  it("does not use a stale selected feature object ID", () => {
    const selectedCrashFeature = feature(
      { doti_incident_id: "DP2026462495" },
      302740735,
    ) as unknown as Feature<Point, Crash>;
    renderMap({ selectedCrashFeature, selectedCrashCalloutIsOpen: true });

    const sourceLink = screen.getByRole("link", {
      name: "View DOTI source record for DP2026462495 (opens in a new tab)",
    });
    const url = new URL(sourceLink.getAttribute("href")!);

    expect(url.href).not.toContain("302740735");
    expect(JSON.parse(atob(url.searchParams.get("filters")!))).toEqual({
      incident_id: ["DP2026462495"],
    });
  });

  it.each([
    { doti_incident_id: null },
    {
      sourceLinks: { dotiRecordUrl: "data:text/html,unsafe" },
    },
  ] as Partial<Crash>[])(
    "omits the DOTI action when the source link is missing or unsafe",
    (properties) => {
      const selectedCrashFeature = feature(properties) as unknown as Feature<
        Point,
        Crash
      >;
      renderMap({ selectedCrashFeature, selectedCrashCalloutIsOpen: true });

      expect(
        screen.queryByRole("link", { name: /View DOTI source record/ }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("Map drawn route interaction", () => {
  beforeEach(() => {
    mapHarness.interactiveLayerIds = [];
    mapHarness.onClick = undefined;
    mapHarness.doubleClickZoom = undefined;
    mapHarness.sourceData = {};
    mapHarness.layers = {};
    mapHarness.popupOnClose = undefined;
    mapHarness.popupCloseOnClick = undefined;
  });

  it.each([
    { target: "blank map", features: [] },
    { target: "crash feature", features: [feature({}, 304214148)] },
  ])(
    "adds a vertex over the $target without starting a radius search",
    ({ features }) => {
      const { props } = renderMap({ isDrawingRoute: true });

      act(() => {
        mapHarness.onClick?.({
          features,
          lngLat: { lng: -104.99, lat: 39.74 },
        });
      });

      expect(props.onAddDrawnRouteVertex).toHaveBeenCalledWith([
        -104.99, 39.74,
      ]);
      expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
      expect(props.setFilters).not.toHaveBeenCalled();
      expect(props.onRadiusSearchPoint).not.toHaveBeenCalled();
    },
  );

  it("does nothing on a blank click in idle Draw Route mode", () => {
    const { props } = renderMap({
      filters: {
        searchTool: "Draw Route" as Filters["searchTool"],
        bufferRadiusInFeet: 20,
      },
    });

    act(() => {
      mapHarness.onClick?.({
        features: [],
        lngLat: { lng: -104.99, lat: 39.74 },
      });
    });

    expect(props.onAddDrawnRouteVertex).not.toHaveBeenCalled();
    expect(props.setFilters).not.toHaveBeenCalled();
    expect(props.onRadiusSearchPoint).not.toHaveBeenCalled();
  });

  it("reports a blank-map radius point to the page-owned query runner", () => {
    const dateRange = { from: "2024-03-01", to: "2025-02-28" };
    const { props } = renderMap({
      filters: {
        searchTool: "Radius Search",
        bufferRadiusInFeet: 35,
        dateRange,
      },
    });

    act(() => {
      mapHarness.onClick?.({
        features: [],
        lngLat: { lng: -104.99, lat: 39.74 },
      });
    });

    expect(props.onRadiusSearchPoint).toHaveBeenCalledWith({
      lat: 39.74,
      lng: -104.99,
    });
  });

  it("still requests a crash popup in idle Draw Route mode", () => {
    const { props } = renderMap({
      filters: {
        searchTool: "Draw Route" as Filters["searchTool"],
        bufferRadiusInFeet: 20,
      },
    });

    selectFeature(feature({}, 304214148));

    expect(props.onCrashSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 304214148 }),
    );
    expect(props.onRadiusSearchPoint).not.toHaveBeenCalled();
  });

  it("renders preview, applied route, and search-area data with stable IDs", () => {
    const drawnRoutePreview = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [-104.99, 39.74] },
        },
      ],
    } as FeatureCollection;
    const routeGeometry = {
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
    } as FeatureCollection;
    const routeSearchArea = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-105, 39.73],
                [-104.97, 39.73],
                [-104.97, 39.76],
                [-105, 39.73],
              ],
            ],
          },
        },
      ],
    } as FeatureCollection;

    renderMap({ drawnRoutePreview, routeGeometry, routeSearchArea });

    expect(mapHarness.sourceData["drawn-route-preview-source"]).toBe(
      drawnRoutePreview,
    );
    expect(mapHarness.sourceData["drawn-route-source"]).toBe(routeGeometry);
    expect(mapHarness.sourceData["drawn-route-search-area-source"]).toBe(
      routeSearchArea,
    );
    expect(Object.keys(mapHarness.layers)).toEqual(
      expect.arrayContaining([
        "drawn-route-preview-line",
        "drawn-route-preview-vertices",
        "drawn-route-line",
        "drawn-route-search-area-fill",
        "drawn-route-search-area-outline",
      ]),
    );
  });

  it.each([
    { isDrawingRoute: true, expected: false },
    { isDrawingRoute: false, expected: true },
  ])(
    "sets double-click zoom to $expected when drawing is $isDrawingRoute",
    ({ isDrawingRoute, expected }) => {
      renderMap({ isDrawingRoute });

      expect(mapHarness.doubleClickZoom).toBe(expected);
    },
  );
});
