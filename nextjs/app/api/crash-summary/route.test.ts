import type { FeatureCollection, Point } from "geojson";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Crash } from "@/app/lib/api-client";
import type { QueryDefinitionV1 } from "@/app/lib/query-definition";
import { serializeQueryUrl } from "@/app/lib/query-url";

const {
  getRadiusIncidents,
  getBufferedStreetIncidents,
  getBufferedRouteIncidents,
} = vi.hoisted(() => ({
  getRadiusIncidents: vi.fn(),
  getBufferedStreetIncidents: vi.fn(),
  getBufferedRouteIncidents: vi.fn(),
}));

vi.mock("@/app/api/incidents/route", () => ({ GET: getRadiusIncidents }));
vi.mock("@/app/api/incidents/buffered-street/route", () => ({
  GET: getBufferedStreetIncidents,
}));
vi.mock("@/app/api/incidents/buffered-route/route", () => ({
  POST: getBufferedRouteIncidents,
}));

import { GET as getCrashSummary } from "./route";

const request = (params = "") =>
  ({
    nextUrl: new URL(`http://localhost/map/api/crash-summary?${params}`),
  }) as NextRequest;

const feature = (
  id: string,
  properties: Partial<Crash>,
): FeatureCollection<Point, Crash>["features"][number] => ({
  type: "Feature",
  id,
  geometry: { type: "Point", coordinates: [-104.99, 39.74] },
  properties: {
    doti_incident_id: null,
    doti_fatalities: 0,
    doti_serious_injuries: 0,
    doti_bicycle_involved: false,
    doti_pedestrian_involved: false,
    doti_bicycle_count: 0,
    doti_pedestrian_count: 0,
    cdot_cuid: null,
    cdot_injury_00: null,
    cdot_injury_01: null,
    cdot_injury_02: null,
    cdot_injury_03: null,
    cdot_injury_04: null,
    cdot_tu_1_nm_type: null,
    cdot_tu_2_nm_type: null,
    ...properties,
  } as Crash,
});

const incidents: FeatureCollection<Point, Crash> = {
  type: "FeatureCollection",
  features: [
    feature("cdot-fatal", {
      cdot_cuid: "CDOT-1",
      cdot_injury_04: 1,
      cdot_injury_03: 1,
      cdot_injury_02: 1,
      cdot_injury_01: 1,
      cdot_injury_00: 1,
      cdot_tu_1_nm_type: "Bicycle",
    }),
    feature("doti-serious", {
      doti_incident_id: "DOTI-1",
      doti_serious_injuries: 2,
      doti_pedestrian_count: 2,
    }),
  ],
};

const dateRange = { from: "2025-01-01", to: "2025-12-31" };

const expectSummary = async (
  response: Response,
  expectedQuery: QueryDefinitionV1,
) => {
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({
    schemaVersion: 1,
    query: expectedQuery,
    summary: {
      crashes: 2,
      crashesByHighestSeverity: {
        fatal: 1,
        incapacitatingInjury: 1,
        nonIncapacitatingInjury: 0,
        complaintOfInjury: 0,
        noInjuryPropertyDamage: 0,
      },
      peopleByInjurySeverity: {
        fatalities: 1,
        incapacitatingInjuries: 3,
        nonIncapacitatingInjuries: 1,
        complaintsOfInjury: 1,
        noInjuryPropertyDamage: 1,
      },
      roadUsersInvolved: { bicyclists: 1, pedestrians: 2 },
      estimatedComprehensiveCostUsd: 17_693_100,
    },
  });
};

describe("public crash-summary route", () => {
  beforeEach(() => {
    getRadiusIncidents.mockReset();
    getBufferedStreetIncidents.mockReset();
    getBufferedRouteIncidents.mockReset();
  });

  it("runs a radius URL query and returns the report summary as JSON", async () => {
    const radiusQuery: QueryDefinitionV1 = {
      version: 1,
      tool: "radius",
      dateRange,
      center: { lat: 39.74, lng: -104.99 },
      radiusFeet: 20,
    };
    getRadiusIncidents.mockResolvedValue(Response.json(incidents));

    const response = await getCrashSummary(
      request(serializeQueryUrl(radiusQuery).toString()),
    );

    const downstreamRequest = getRadiusIncidents.mock
      .calls[0][0] as NextRequest;
    expect(downstreamRequest.nextUrl.searchParams.toString()).toBe(
      "startDate=2025-01-01&endDate=2025-12-31&lat=39.74&lng=-104.99&radiusInFeet=20",
    );
    await expectSummary(response, radiusQuery);
  });

  it("adapts a street URL query to the existing street API", async () => {
    const streetQuery: QueryDefinitionV1 = {
      version: 1,
      tool: "street",
      dateRange,
      street: "E COLFAX AVE",
      crossStreets: { from: "N BROADWAY", to: "N LINCOLN ST" },
      bufferFeet: 20,
    };
    getBufferedStreetIncidents.mockResolvedValue(Response.json(incidents));

    const response = await getCrashSummary(
      request(serializeQueryUrl(streetQuery).toString()),
    );

    const downstreamRequest = getBufferedStreetIncidents.mock
      .calls[0][0] as NextRequest;
    expect(downstreamRequest.nextUrl.searchParams.toString()).toBe(
      "fullStreetName=E+COLFAX+AVE&crossStreet1=N+BROADWAY&crossStreet2=N+LINCOLN+ST&bufferInFeet=20&startDate=2025-01-01&endDate=2025-12-31",
    );
    await expectSummary(response, streetQuery);
  });

  it("adapts a drawn-route URL query to the existing route API", async () => {
    const drawQuery: QueryDefinitionV1 = {
      version: 1,
      tool: "draw",
      dateRange,
      route: {
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
      },
      bufferFeet: 20,
    };
    getBufferedRouteIncidents.mockResolvedValue(Response.json(incidents));

    const response = await getCrashSummary(
      request(serializeQueryUrl(drawQuery).toString()),
    );

    const downstreamRequest = getBufferedRouteIncidents.mock
      .calls[0][0] as NextRequest;
    await expect(downstreamRequest.json()).resolves.toEqual({
      route: drawQuery.route,
      bufferInFeet: 20,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
    await expectSummary(response, drawQuery);
  });

  it.each([
    ["", "A crash query is required."],
    [
      "v=1&tool=radius&from=2025-01-01&to=2025-12-31&lat=39.74&lng=-104.99",
      "This query link is invalid: Invalid input: expected number, received NaN.",
    ],
  ])(
    "rejects an invalid query before accessing the database",
    async (params, error) => {
      const response = await getCrashSummary(request(params));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error });
      expect(getRadiusIncidents).not.toHaveBeenCalled();
      expect(getBufferedStreetIncidents).not.toHaveBeenCalled();
      expect(getBufferedRouteIncidents).not.toHaveBeenCalled();
    },
  );

  it("preserves the safe database failure response", async () => {
    getRadiusIncidents.mockResolvedValue(
      Response.json({ error: "Database query failed" }, { status: 500 }),
    );
    const params = serializeQueryUrl({
      version: 1,
      tool: "radius",
      dateRange,
      center: { lat: 39.74, lng: -104.99 },
      radiusFeet: 20,
    }).toString();

    const response = await getCrashSummary(request(params));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Database query failed",
    });
  });
});
