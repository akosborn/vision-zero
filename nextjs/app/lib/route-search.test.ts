import { FeatureCollection, Geometry, LineString } from "geojson";
import { describe, expect, it } from "vitest";

import { prepareRouteSearch } from "./route-search";

const line: LineString = {
  type: "LineString",
  coordinates: [
    [-104.99, 39.74],
    [-104.98, 39.75],
  ],
};

const drawnRoute: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: {}, geometry: line }],
};

describe("prepareRouteSearch", () => {
  it("gives equivalent drawn and uploaded lines the same request payload", () => {
    const uploadedRoute: FeatureCollection<Geometry | null> = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: line },
        { type: "Feature", properties: {}, geometry: null },
      ],
    };
    const dateRange = { from: "2025-01-01", to: "2025-12-31" };

    const drawn = prepareRouteSearch(drawnRoute, 35, dateRange);
    const uploaded = prepareRouteSearch(uploadedRoute, 35, dateRange);

    expect(drawn?.request).toEqual(uploaded?.request);
    expect(drawn?.request).toEqual({
      route: drawnRoute,
      bufferInFeet: 35,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
    expect(drawn?.searchArea?.features).not.toHaveLength(0);
    expect(
      drawn?.searchArea?.features.every(({ geometry }) =>
        ["Polygon", "MultiPolygon"].includes(geometry.type),
      ),
    ).toBe(true);
  });

  it("rejects empty geometry before constructing a request or buffer", () => {
    expect(
      prepareRouteSearch(
        {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: null }],
        },
        35,
        undefined,
      ),
    ).toBeNull();
  });
});

it("buffers disconnected lines separately without filling the gap", () => {
  const route: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: [
      ...drawnRoute.features,
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [-104.9, 39.8],
            [-104.89, 39.81],
          ],
        },
      },
    ],
  };
  const prepared = prepareRouteSearch(route, 20, undefined);
  expect(prepared?.request.route).toEqual(route);
  expect(prepared?.searchArea?.features).toHaveLength(2);
  const polygons = prepared!.searchArea!.features.map(({ geometry }) => {
    if (geometry.type !== "Polygon")
      throw new Error("Expected separate corridor polygons");
    return geometry.coordinates.flat().map(([longitude]) => longitude);
  });
  expect(Math.max(...polygons[0])).toBeLessThan(-104.97);
  expect(Math.min(...polygons[1])).toBeGreaterThan(-104.91);
});
