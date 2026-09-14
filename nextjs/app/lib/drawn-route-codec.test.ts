import type { FeatureCollection, LineString } from "geojson";
import { describe, expect, it } from "vitest";

import {
  DRAWN_ROUTE_PRECISION,
  MAX_DRAWN_ROUTE_VERTICES,
  MAX_ENCODED_POLYLINE_LENGTH,
  decodeDrawnRoute,
  decodeDrawnRouteLines,
  encodeDrawnRouteLines,
  encodeDrawnRoute,
} from "@/app/lib/drawn-route-codec";

const route = (coordinates: number[][]): FeatureCollection<LineString> => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    },
  ],
});

describe("drawn-route polyline codec", () => {
  it("matches Google's published coordinate vector at precision 6", () => {
    const source = route([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);

    expect(DRAWN_ROUTE_PRECISION).toBe(6);
    expect(encodeDrawnRoute(source)).toBe("_izlhA~rlgdF_{geC~ywl@_kwzCn`{nI");
    expect(decodeDrawnRoute(encodeDrawnRoute(source))).toEqual(source);
  });

  it("swaps GeoJSON longitude/latitude and stays within precision-6 error", () => {
    const source = route([
      [-104.99031249, 39.73924549],
      [-104.98123451, 39.74234551],
    ]);

    const restored = decodeDrawnRoute(encodeDrawnRoute(source));
    const restoredCoordinates = restored.features[0].geometry.coordinates;
    expect(restoredCoordinates[0]).toEqual([-104.990312, 39.739245]);
    expect(restoredCoordinates[1]).toEqual([-104.981235, 39.742346]);
    restoredCoordinates.forEach((coordinate, index) => {
      coordinate.forEach((value, axis) => {
        expect(
          Math.abs(
            value - source.features[0].geometry.coordinates[index][axis],
          ),
        ).toBeLessThanOrEqual(0.0000005);
      });
    });
  });

  it.each([
    [route([]), "at least two coordinates"],
    [route([[-104.99, 39.74]]), "at least two coordinates"],
    [
      route([
        [-104.99, 39.74],
        [-104.99, 39.74],
      ]),
      "distinct coordinates",
    ],
    [
      route([
        [-181, 39.74],
        [-104.98, 39.75],
      ]),
      "invalid longitude",
    ],
    [
      route([
        [-104.99, 91],
        [-104.98, 39.75],
      ]),
      "invalid latitude",
    ],
  ])("rejects invalid route geometry", (source, message) => {
    expect(() => encodeDrawnRoute(source)).toThrow(message);
  });

  it("rejects empty, malformed, oversized, and excessive decoded routes", () => {
    expect(() => decodeDrawnRoute("")).toThrow("must not be empty");
    expect(() => decodeDrawnRoute("?")).toThrow();
    expect(() =>
      decodeDrawnRoute("a".repeat(MAX_ENCODED_POLYLINE_LENGTH + 1)),
    ).toThrow("cannot exceed");

    const excessiveCoordinates = Array.from(
      { length: MAX_DRAWN_ROUTE_VERTICES + 1 },
      (_, index) => [-104.99 + index / 1_000_000, 39.74],
    );
    expect(() => encodeDrawnRoute(route(excessiveCoordinates))).toThrow(
      "cannot exceed",
    );
  });
});

describe("multiple drawn-route polylines", () => {
  it("round trips each disconnected line independently", () => {
    const source: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: [
        ...route([
          [-104.99, 39.74],
          [-104.98, 39.75],
        ]).features,
        ...route([
          [-104.9, 39.8],
          [-104.89, 39.81],
        ]).features,
      ],
    };
    const encoded = encodeDrawnRouteLines(source);
    expect(encoded).toHaveLength(2);
    expect(decodeDrawnRouteLines(encoded)).toEqual(source);
  });

  it.each([null, [], "polyline", [1], [""], ["?"]])(
    "rejects malformed line collections: %j",
    (value) => {
      expect(() => decodeDrawnRouteLines(value)).toThrow();
    },
  );

  it("enforces the vertex limit across all lines", () => {
    const line = route(
      Array.from({ length: 501 }, (_, index) => [
        -104.99 + index / 1_000_000,
        39.74,
      ]),
    );
    const source: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: [...line.features, ...line.features],
    };
    expect(() => encodeDrawnRouteLines(source)).toThrow("cannot exceed");
    expect(() =>
      decodeDrawnRouteLines([encodeDrawnRoute(line), encodeDrawnRoute(line)]),
    ).toThrow("cannot exceed");
  });
});
