import axios from "axios";
import { FeatureCollection, LineString } from "geojson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getIncidentsWithinBufferedRoute } from "./api-client";

vi.mock("axios", () => ({
  default: {
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
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.post).mockResolvedValue({
      data: responseData,
    });
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
