import axios from "axios";
import { FeatureCollection, LineString } from "geojson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAnnualRadiusCrashHistory,
  getAnnualRouteCrashHistory,
  getIncidentsWithinBufferedRoute,
} from "./api-client";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

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

const responseData = { type: "FeatureCollection" as const, features: [] };

describe("getIncidentsWithinBufferedRoute", () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.post).mockResolvedValue({
      data: responseData,
    });
  });

  it("requests annual radius history without report dates", async () => {
    const history = [{ year: 2024 }];
    vi.mocked(axios.get).mockResolvedValue({ data: history });

    const result = await getAnnualRadiusCrashHistory({
      lat: 39.74,
      lng: -104.99,
      radiusInFeet: 35,
    });

    expect(axios.get).toHaveBeenCalledWith("/api/incidents/history", {
      params: { lat: 39.74, lng: -104.99, radiusInFeet: 35 },
    });
    expect(result).toBe(history);
  });

  it("requests annual route history without report dates", async () => {
    const history = [{ year: 2024 }];
    vi.mocked(axios.post).mockResolvedValue({ data: history });

    const result = await getAnnualRouteCrashHistory({
      route,
      bufferInFeet: 35,
    });

    expect(axios.post).toHaveBeenCalledWith(
      "/api/incidents/buffered-route/history",
      { route, bufferInFeet: 35 },
    );
    expect(result).toBe(history);
  });

  it("posts the exact shared upload/draw route payload", async () => {
    const result = await getIncidentsWithinBufferedRoute({
      route,
      bufferInFeet: 35,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });

    expect(axios.post).toHaveBeenCalledWith("/api/incidents/buffered-route", {
      route,
      bufferInFeet: 35,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
    expect(result).toBe(responseData);
  });
});
