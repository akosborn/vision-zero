import { act, render, screen } from "@testing-library/react";
import { GeoJSONFeature } from "mapbox-gl";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Crash } from "@/app/lib/api-client";
import { Filters } from "@/app/page";

import Map, { DEFAULT_VIEWPORT } from "./Map";

const mapHarness = vi.hoisted(() => ({
  interactiveLayerIds: [] as string[],
  onClick: undefined as ((event: unknown) => void) | undefined,
}));

vi.mock("react-map-gl/mapbox-legacy", async () => {
  const React = await import("react");
  const MockMap = React.forwardRef(
    (
      {
        children,
        interactiveLayerIds,
        onClick,
      }: {
        children: React.ReactNode;
        interactiveLayerIds: string[];
        onClick: (event: unknown) => void;
      },
      _ref,
    ) => {
      mapHarness.interactiveLayerIds = interactiveLayerIds;
      mapHarness.onClick = onClick;
      return React.createElement("div", { "data-testid": "map" }, children);
    },
  );
  MockMap.displayName = "MockMap";

  return {
    Layer: () => null,
    Map: MockMap,
    Popup: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "popup" }, children),
    Source: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
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

const renderMap = () => {
  const filters: Filters = {
    searchTool: "Radius Search",
    bufferRadiusInFeet: 20,
  };

  return render(
    <Map
      filters={filters}
      setFilters={vi.fn()}
      setIncidentGeoJson={vi.fn()}
      setAreaOfInterestIncidentGeoJson={vi.fn()}
      viewport={DEFAULT_VIEWPORT}
      setViewport={vi.fn()}
      isLoading={false}
      setIsLoading={vi.fn()}
      setStreetCenterlines={vi.fn()}
      setBufferedStreet={vi.fn()}
      onRadiusResultsChange={vi.fn()}
    />,
  );
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
  });

  it("links an exact DOTI object ID and makes both crash layers interactive", () => {
    renderMap();

    expect(mapHarness.interactiveLayerIds).toEqual([
      "incident-layer",
      "area-of-interest-incident-layer",
    ]);

    selectFeature(feature({}, 304214148));

    const sourceLink = screen.getByRole("link", {
      name: "View DOTI source record for DP2026473926 (opens in a new tab)",
    });
    expect(sourceLink).toHaveAttribute(
      "href",
      "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325/304214148",
    );
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

  it("uses the official incident query when the selected feature has no object ID", () => {
    renderMap();
    selectFeature(feature({ doti_incident_id: "2018323" }));

    const sourceLink = screen.getByRole("link", {
      name: "View DOTI source record for 2018323 (opens in a new tab)",
    });
    const url = new URL(sourceLink.getAttribute("href")!);

    expect(
      url.pathname.endsWith(
        "/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325/query",
      ),
    ).toBe(true);
    expect(url.searchParams.get("where")).toBe("incident_id = '2018323'");
    expect(url.searchParams.get("f")).toBe("pjson");
  });

  it.each([
    { doti_incident_id: null },
    {
      sourceLinks: { dotiRecordUrl: "data:text/html,unsafe" },
    },
  ] as Partial<Crash>[])(
    "omits the DOTI action when the source link is missing or unsafe",
    (properties) => {
      renderMap();
      selectFeature(feature(properties));

      expect(
        screen.queryByRole("link", { name: /View DOTI source record/ }),
      ).not.toBeInTheDocument();
    },
  );
});
