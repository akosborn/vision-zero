import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/app/lib/db", () => ({ default: { query } }));

import { GET as getBufferedStreetIncidents } from "./incidents/buffered-street/route";
import { GET as getBufferedStreetHistory } from "./incidents/buffered-street/history/route";

const request = (path: string) =>
  ({ nextUrl: new URL(`http://localhost${path}`) }) as NextRequest;

const geojson = { type: "FeatureCollection", features: [] };

const successfulGeojsonQuery = () =>
  query.mockResolvedValue({ rows: [{ geojson }] });

const expectSafeQuery = (
  sql: unknown,
  parameters: unknown,
  expectedParameters: unknown[],
) => {
  expect(sql).toBeTypeOf("string");
  expect(sql).not.toContain("DROP TABLE");
  expect(parameters).toEqual(expectedParameters);
};

describe("street SQL routes", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("binds every incident street, buffer, cross-street, and date value", async () => {
    successfulGeojsonQuery();
    const street = "N O'Neil ST'; DROP TABLE streets; --";

    const response = await getBufferedStreetIncidents(
      request(
        `/api/incidents/buffered-street?fullStreetName=${encodeURIComponent(street)}&bufferInFeet=20&crossStreet1=E%201ST%20AVE&crossStreet2=E%202ND%20AVE&startDate=2025-01-01&endDate=2025-12-31`,
      ),
    );

    expect(response.status).toBe(200);
    expectSafeQuery(query.mock.calls[0][0], query.mock.calls[0][1], [
      6.096,
      street,
      "E 1ST AVE",
      "E 2ND AVE",
      "2025-01-01",
      "2025-12-31",
    ]);
  });

  it("binds every annual-history street and buffer value", async () => {
    query.mockResolvedValue({ rows: [] });
    const street = "N O'Neil ST'; DROP TABLE streets; --";

    const response = await getBufferedStreetHistory(
      request(
        `/api/incidents/buffered-street/history?fullStreetName=${encodeURIComponent(street)}&bufferInFeet=20&crossStreet1=E%201ST%20AVE&crossStreet2=E%202ND%20AVE`,
      ),
    );

    expect(response.status).toBe(200);
    expectSafeQuery(query.mock.calls[0][0], query.mock.calls[0][1], [
      6.096,
      street,
      "E 1ST AVE",
      "E 2ND AVE",
    ]);
  });

  it("returns a consistent 400 without querying for invalid route input", async () => {
    const response = await getBufferedStreetIncidents(
      request(
        "/api/incidents/buffered-street?fullStreetName=N%20MAIN%20ST&bufferInFeet=20&startDate=not-a-date",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "startDate must be a valid date in YYYY-MM-DD format",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    [
      getBufferedStreetIncidents,
      "/api/incidents/buffered-street?fullStreetName=N%20MAIN%20ST&bufferInFeet=20",
    ],
    [
      getBufferedStreetHistory,
      "/api/incidents/buffered-street/history?fullStreetName=N%20MAIN%20ST&bufferInFeet=20",
    ],
  ])(
    "returns a safe 500 when a database query fails",
    async (handler, path) => {
      query.mockRejectedValue(new Error("database connection details"));

      const response = await handler(request(path));

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "Database query failed",
      });
    },
  );
});
