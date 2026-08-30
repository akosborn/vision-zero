import type { FeatureCollection, LineString } from "geojson";
import { describe, expect, it } from "vitest";

import type { QueryDefinitionV1 } from "@/app/lib/query-definition";
import {
  MAX_QUERY_URL_LENGTH,
  createCanonicalQueryPath,
  isCanonicalQueryUrlShareable,
  parseQueryUrl,
  serializeQueryUrl,
} from "@/app/lib/query-url";

const dateRange = { from: "2025-01-01", to: "2025-12-31" };

const drawnRoute: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-104.990312, 39.739245],
          [-104.981235, 39.742346],
        ],
      },
    },
  ],
};

const queries: QueryDefinitionV1[] = [
  {
    version: 1,
    tool: "radius",
    dateRange,
    center: { lat: 39.7392, lng: -104.9903 },
    radiusFeet: 500,
  },
  {
    version: 1,
    tool: "street",
    dateRange,
    street: "E COLFAX AVE",
    bufferFeet: 100,
  },
  {
    version: 1,
    tool: "street",
    dateRange,
    street: "E COLFAX AVE & 100% WAY",
    crossStreets: { from: "N BROADWAY", to: "N LINCOLN ST" },
    bufferFeet: 100,
  },
  {
    version: 1,
    tool: "draw",
    dateRange,
    route: drawnRoute,
    bufferFeet: 100,
  },
];

describe("version-1 query URLs", () => {
  it.each(queries)("round trips a $tool query", (query) => {
    const result = parseQueryUrl(serializeQueryUrl(query));
    expect(result).toEqual({ status: "success", query, legacy: false });
  });

  it("uses a stable parameter order and URLSearchParams escaping", () => {
    const radius = serializeQueryUrl(queries[0]);
    expect(radius.toString()).toBe(
      "v=1&tool=radius&from=2025-01-01&to=2025-12-31&lat=39.7392&lng=-104.9903&radiusFeet=500",
    );

    const street = serializeQueryUrl(queries[2]);
    expect(street.toString()).toBe(
      "v=1&tool=street&from=2025-01-01&to=2025-12-31&street=E+COLFAX+AVE+%26+100%25+WAY&crossFrom=N+BROADWAY&crossTo=N+LINCOLN+ST&bufferFeet=100",
    );
  });

  it("parses incoming parameters without depending on their order", () => {
    const result = parseQueryUrl(
      new URLSearchParams(
        "radiusFeet=500&lng=-104.9903&to=2025-12-31&tool=radius&lat=39.7392&from=2025-01-01&v=1",
      ),
    );
    expect(result).toEqual({
      status: "success",
      query: queries[0],
      legacy: false,
    });
  });

  it("adapts a complete legacy street link including its radius", () => {
    const result = parseQueryUrl(
      new URLSearchParams(
        "tool=Street+Search&fromDate=2025-01-01&toDate=2025-12-31&r=250&street=E+COLFAX+AVE&crossStreet1=N+BROADWAY&crossStreet2=N+LINCOLN+ST",
      ),
    );
    expect(result).toEqual({
      status: "success",
      legacy: true,
      query: {
        version: 1,
        tool: "street",
        dateRange,
        street: "E COLFAX AVE",
        crossStreets: { from: "N BROADWAY", to: "N LINCOLN ST" },
        bufferFeet: 250,
      },
    });
  });

  it.each([
    ["v=2&tool=radius", "unsupported"],
    ["v=1&tool=upload&from=2025-01-01&to=2025-12-31", "invalid"],
    [
      "v=1&tool=radius&from=2025-02-30&to=2025-12-31&lat=39.7&lng=-104.9&radiusFeet=100",
      "invalid",
    ],
    [
      "v=1&tool=radius&from=2025-12-31&to=2025-01-01&lat=39.7&lng=-104.9&radiusFeet=100",
      "invalid",
    ],
    [
      "v=1&tool=radius&from=2025-01-01&to=2025-12-31&lat=91&lng=-104.9&radiusFeet=100",
      "invalid",
    ],
    [
      "v=1&tool=radius&from=2025-01-01&to=2025-12-31&lat=39.7&lng=-181&radiusFeet=100",
      "invalid",
    ],
    [
      "v=1&tool=radius&from=2025-01-01&to=2025-12-31&lat=39.7&lng=-104.9&radiusFeet=5281",
      "invalid",
    ],
    [
      "v=1&tool=street&from=2025-01-01&to=2025-12-31&street=E+COLFAX+AVE&crossFrom=N+BROADWAY&bufferFeet=100",
      "invalid",
    ],
    [
      "v=1&v=1&tool=street&from=2025-01-01&to=2025-12-31&street=E+COLFAX+AVE&bufferFeet=100",
      "invalid",
    ],
    [
      "v=1&tool=draw&from=2025-01-01&to=2025-12-31&bufferFeet=100&precision=5&polyline=abc",
      "invalid",
    ],
    [
      "v=1&tool=draw&from=2025-01-01&to=2025-12-31&bufferFeet=100&precision=6&polyline=%3F",
      "invalid",
    ],
    [
      "tool=Radius+Search&fromDate=2025-01-01&toDate=2025-12-31&r=100",
      "invalid",
    ],
  ])("rejects invalid or unsupported links: %s", (input, kind) => {
    expect(parseQueryUrl(new URLSearchParams(input))).toMatchObject({
      status: "error",
      kind,
    });
  });

  it("honors feature availability", () => {
    expect(
      parseQueryUrl(serializeQueryUrl(queries[3]), {
        enabledTools: ["radius", "street"],
      }),
    ).toMatchObject({ status: "error", kind: "unsupported" });
  });

  it("enforces the final canonical path size policy", () => {
    expect(createCanonicalQueryPath(queries[0])).toBe(
      "/map?v=1&tool=radius&from=2025-01-01&to=2025-12-31&lat=39.7392&lng=-104.9903&radiusFeet=500",
    );
    expect(isCanonicalQueryUrlShareable(queries[0])).toBe(true);
    expect(
      parseQueryUrl(
        new URLSearchParams(
          `v=1&tool=street&padding=${"x".repeat(MAX_QUERY_URL_LENGTH)}`,
        ),
      ),
    ).toMatchObject({ status: "error", kind: "invalid" });
  });
});
