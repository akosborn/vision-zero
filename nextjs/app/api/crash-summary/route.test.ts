import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AreaCrashSummary } from "@/app/components/LocationReport/utils/area-crash-summary";
import type { QueryDefinitionV1 } from "@/app/lib/query-definition";
import { serializeQueryUrl } from "@/app/lib/query-url";

import { GET as getCrashSummary } from "./route";

const fetchMock = vi.fn();

const request = (params = "") =>
  ({
    nextUrl: new URL(`http://localhost/api/crash-summary?${params}`),
  }) as NextRequest;

// What vz-backend returns for one fatal CDOT crash and one serious DOTI crash.
const areaSummary: AreaCrashSummary = {
  crashes: 2,
  maxKabcoSeverityCounts: { K: 1, A: 1, B: 0, C: 0, O: 0 },
  kabcoSeverityCounts: { K: 1, A: 3, B: 1, C: 1, O: 1 },
  bicyclesInvolved: 1,
  pedestriansInvolved: 2,
  comprehensiveCosts: 17_693_100,
};

const searchResponse = () =>
  Response.json({
    crashes: { type: "FeatureCollection", features: [] },
    summary: areaSummary,
  });

const backendRequest = () => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string) };
};

const dateRange = { from: "2025-01-01", to: "2025-12-31" };

const radiusQuery: QueryDefinitionV1 = {
  version: 1,
  tool: "radius",
  dateRange,
  center: { lat: 39.74, lng: -104.99 },
  radiusFeet: 20,
};

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
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VZ_BACKEND_URL", "http://backend.test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("proxies a radius URL query to the backend search and returns the public summary", async () => {
    fetchMock.mockResolvedValue(searchResponse());

    const response = await getCrashSummary(
      request(serializeQueryUrl(radiusQuery).toString()),
    );

    const { url, init, body } = backendRequest();
    expect(url).toBe("http://backend.test/api/v1/crashes/search");
    expect(init.method).toBe("POST");
    expect(body).toEqual({
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      area: { type: "radius", lat: 39.74, lng: -104.99, radiusInFeet: 20 },
    });
    await expectSummary(response, radiusQuery);
  });

  it("adapts a street URL query to a backend street search", async () => {
    const streetQuery: QueryDefinitionV1 = {
      version: 1,
      tool: "street",
      dateRange,
      street: "E COLFAX AVE",
      crossStreets: { from: "N BROADWAY", to: "N LINCOLN ST" },
      bufferFeet: 20,
    };
    fetchMock.mockResolvedValue(searchResponse());

    const response = await getCrashSummary(
      request(serializeQueryUrl(streetQuery).toString()),
    );

    expect(backendRequest().body).toEqual({
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      area: {
        type: "street",
        fullStreetName: "E COLFAX AVE",
        crossStreets: ["N BROADWAY", "N LINCOLN ST"],
        bufferInFeet: 20,
      },
    });
    await expectSummary(response, streetQuery);
  });

  it("adapts a drawn-route URL query to a backend route search", async () => {
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
    fetchMock.mockResolvedValue(searchResponse());

    const response = await getCrashSummary(
      request(serializeQueryUrl(drawQuery).toString()),
    );

    expect(backendRequest().body).toEqual({
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      area: { type: "route", route: drawQuery.route, bufferInFeet: 20 },
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
    "rejects an invalid query before calling the backend",
    async (params, error) => {
      const response = await getCrashSummary(request(params));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("flattens backend validation errors into the existing error shape", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          statusCode: 400,
          error: "Bad Request",
          message: [
            { path: "area.radiusInFeet", message: "Too big" },
            { path: "", message: "Bad dates" },
          ],
        },
        { status: 400 },
      ),
    );

    const response = await getCrashSummary(
      request(serializeQueryUrl(radiusQuery).toString()),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "area.radiusInFeet: Too big; Bad dates",
    });
  });

  it.each([
    [
      "a backend failure",
      () =>
        fetchMock.mockResolvedValue(
          Response.json({ message: "stack trace" }, { status: 500 }),
        ),
    ],
    [
      "an unreachable backend",
      () => fetchMock.mockRejectedValue(new TypeError("fetch failed")),
    ],
  ])("preserves the safe failure response for %s", async (_case, setup) => {
    setup();

    const response = await getCrashSummary(
      request(serializeQueryUrl(radiusQuery).toString()),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Database query failed",
    });
  });
});
