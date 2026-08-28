import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFinalRoute,
  INITIAL_ROUTE_DRAWING_STATE,
  routeDrawingReducer,
} from "@/app/lib/route-drawing";
import { parseRouteText } from "@/app/lib/route-file";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/app/lib/db", () => ({ default: { query } }));

import { POST as postBufferedRoute } from "./incidents/buffered-route/route";
import { POST as postBufferedRouteHistory } from "./incidents/buffered-route/history/route";
import { GET as getRadiusHistory } from "./incidents/history/route";
import { GET as getIncidents } from "./incidents/route";
import { GET as getStreets } from "./streets/route";

const getRequest = (path: string) =>
  ({ nextUrl: new URL(`http://localhost${path}`) }) as NextRequest;

const postRequest = (body: unknown) =>
  ({ json: vi.fn().mockResolvedValue(body) }) as unknown as NextRequest;

const invalidJsonRequest = () =>
  ({
    json: vi.fn().mockRejectedValue(new SyntaxError("invalid JSON")),
  }) as unknown as NextRequest;

const geojson = { type: "FeatureCollection", features: [] };
const route = {
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

const equivalentCoordinates = [
  [-104.99, 39.74],
  [-104.98, 39.75],
];

const equivalentGpx = `
  <gpx version="1.1" creator="Vision Zero" xmlns="http://www.topografix.com/GPX/1/1">
    <trk>
      <trkseg>
        <trkpt lat="39.74" lon="-104.99" />
        <trkpt lat="39.75" lon="-104.98" />
      </trkseg>
    </trk>
  </gpx>
`;

const equivalentKml = `
  <kml xmlns="http://www.opengis.net/kml/2.2">
    <Placemark>
      <LineString>
        <coordinates>-104.99,39.74 -104.98,39.75</coordinates>
      </LineString>
    </Placemark>
  </kml>
`;

const equivalentDrawnRoute = () => {
  let state = routeDrawingReducer(INITIAL_ROUTE_DRAWING_STATE, {
    type: "start",
  });

  for (const coordinate of equivalentCoordinates) {
    state = routeDrawingReducer(state, {
      type: "add-vertex",
      coordinate,
    });
  }

  return createFinalRoute(state)!;
};

const successfulGeojsonQuery = () =>
  query.mockResolvedValue({ rows: [{ geojson }] });

const annualRows = [
  {
    year: "2024",
    crashes: "7",
    fatalities: "1",
    seriousInjuries: "2",
    bicycleInvolvedCrashes: "3",
    pedestrianInvolvedCrashes: "4",
    maxSpeedMph: "42.5",
    crashesOverSpeedLimit: "1",
    crashesWithSpeedData: "5",
  },
];

const annualSummaries = [
  {
    year: 2024,
    crashes: 7,
    fatalities: 1,
    seriousInjuries: 2,
    bicycleInvolvedCrashes: 3,
    pedestrianInvolvedCrashes: 4,
    maxSpeedMph: 42.5,
    crashesOverSpeedLimit: 1,
    crashesWithSpeedData: 5,
  },
];

const expectError = async (
  response: Response,
  status: number,
  error: string,
) => {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error });
};

describe("incidents route", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("binds validated dates and radius-search values", async () => {
    successfulGeojsonQuery();

    const response = await getIncidents(
      getRequest(
        "/api/incidents?startDate=2025-01-01&endDate=2025-12-31&lat=39.74&lng=-104.99&radiusInFeet=20",
      ),
    );

    expect(response.status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual([
      "2025-01-01",
      "2025-12-31",
      -104.99,
      39.74,
      6.096,
    ]);
  });

  it("binds validated bounding-box values", async () => {
    successfulGeojsonQuery();

    const response = await getIncidents(
      getRequest("/api/incidents?bbox=-105%2C39%2C-104%2C40"),
    );

    expect(response.status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual([-105, 39, -104, 40]);
  });

  it.each([
    [
      "/api/incidents?startDate=not-a-date",
      "startDate must be a valid date in YYYY-MM-DD format",
    ],
    [
      "/api/incidents?startDate=2025-02-01&endDate=2025-01-01",
      "startDate must be on or before endDate",
    ],
    [
      "/api/incidents?bbox=-105%2C39%2C-104",
      "bbox must contain minLongitude,minLatitude,maxLongitude,maxLatitude",
    ],
    [
      "/api/incidents?lat=39.74&lng=-104.99",
      "lat, lng, and radiusInFeet must be provided together",
    ],
    [
      "/api/incidents?lat=91&lng=-104.99&radiusInFeet=20",
      "lat must be a number between -90 and 90",
    ],
    [
      "/api/incidents?lat=39.74&lng=-181&radiusInFeet=20",
      "lng must be a number between -180 and 180",
    ],
    [
      "/api/incidents?lat=39.74&lng=-104.99&radiusInFeet=5281",
      "radiusInFeet must be a number between 0 and 5280",
    ],
    [
      "/api/incidents?bbox=-105%2C39%2C-104%2C40&lat=39.74&lng=-104.99&radiusInFeet=20",
      "bbox cannot be combined with lat, lng, or radiusInFeet",
    ],
  ])("returns a 400 before querying for invalid input", async (path, error) => {
    const response = await getIncidents(getRequest(path));

    await expectError(response, 400, error);
    expect(query).not.toHaveBeenCalled();
  });

  it("returns a safe 500 when the database query fails", async () => {
    query.mockRejectedValue(new Error("connection details"));

    const response = await getIncidents(getRequest("/api/incidents"));

    await expectError(response, 500, "Database query failed");
  });
});

describe("radius annual-history route", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("binds the radius search without applying the report date range", async () => {
    query.mockResolvedValue({ rows: annualRows });

    const response = await getRadiusHistory(
      getRequest(
        "/api/incidents/history?lat=39.74&lng=-104.99&radiusInFeet=20",
      ),
    );

    expect(response.status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual([-104.99, 39.74, 6.096]);
    expect(query.mock.calls[0][0]).not.toContain("startDate");
    await expect(response.json()).resolves.toEqual(annualSummaries);
  });

  it.each([
    [
      "/api/incidents/history",
      "lat, lng, and radiusInFeet are required",
    ],
    [
      "/api/incidents/history?lat=39.74&lng=-104.99",
      "lat, lng, and radiusInFeet must be provided together",
    ],
  ])("rejects incomplete radius history input", async (path, error) => {
    const response = await getRadiusHistory(getRequest(path));

    await expectError(response, 400, error);
    expect(query).not.toHaveBeenCalled();
  });

  it("returns a safe 500 when the database query fails", async () => {
    query.mockRejectedValue(new Error("connection details"));

    const response = await getRadiusHistory(
      getRequest(
        "/api/incidents/history?lat=39.74&lng=-104.99&radiusInFeet=20",
      ),
    );

    await expectError(response, 500, "Database query failed");
  });
});

describe("buffered-route incidents route", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("binds route geometry, a strict buffer, and validated dates", async () => {
    successfulGeojsonQuery();

    const response = await postBufferedRoute(
      postRequest({
        route,
        bufferInFeet: "20",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      }),
    );

    expect(response.status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual([
      JSON.stringify(route.features.map((feature) => feature.geometry)),
      6.096,
      "2025-01-01",
      "2025-12-31",
    ]);
  });

  it("binds equivalent drawn, GPX, and KML routes identically", async () => {
    successfulGeojsonQuery();

    const routes = [
      equivalentDrawnRoute(),
      parseRouteText("equivalent.gpx", equivalentGpx),
      parseRouteText("equivalent.kml", equivalentKml),
    ];

    const responses = await Promise.all(
      routes.map((equivalentRoute) =>
        postBufferedRoute(
          postRequest({
            route: equivalentRoute,
            bufferInFeet: 20,
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          }),
        ),
      ),
    );

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.map((call) => call[1])).toEqual(
      Array(3).fill([
        JSON.stringify([route.features[0].geometry]),
        6.096,
        "2025-01-01",
        "2025-12-31",
      ]),
    );
    await Promise.all(
      responses.map((response) =>
        expect(response.json()).resolves.toEqual(geojson),
      ),
    );
  });

  it("preserves the invalid-JSON response", async () => {
    const response = await postBufferedRoute(invalidJsonRequest());

    await expectError(response, 400, "a JSON body is required");
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    [null, "a JSON object body is required"],
    [{ bufferInFeet: 20 }, "route is required"],
    [
      { route: { type: "Point", features: [] }, bufferInFeet: 20 },
      "route must be a GeoJSON FeatureCollection",
    ],
    [
      { route: { type: "FeatureCollection", features: [] }, bufferInFeet: 20 },
      "route must contain at least one feature with a geometry",
    ],
    [
      {
        route: {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: null }],
        },
        bufferInFeet: 20,
      },
      "route must contain at least one feature with a geometry",
    ],
    [{ route }, "bufferInFeet is required"],
    [
      { route, bufferInFeet: "20 feet" },
      "bufferInFeet must be a number between 0 and 5280",
    ],
    [
      { route, bufferInFeet: 5281 },
      "bufferInFeet must be a number between 0 and 5280",
    ],
    [
      { route, bufferInFeet: 20, startDate: 20250101 },
      "startDate must be a valid date in YYYY-MM-DD format",
    ],
    [
      {
        route,
        bufferInFeet: 20,
        startDate: "2025-02-01",
        endDate: "2025-01-01",
      },
      "startDate must be on or before endDate",
    ],
  ])("returns a 400 before querying for invalid input", async (body, error) => {
    const response = await postBufferedRoute(postRequest(body));

    await expectError(response, 400, error);
    expect(query).not.toHaveBeenCalled();
  });

  it("returns a safe 500 when the database query fails", async () => {
    query.mockRejectedValue(new Error("connection details"));

    const response = await postBufferedRoute(
      postRequest({ route, bufferInFeet: 20 }),
    );

    await expectError(response, 500, "Database query failed");
  });
});

describe("buffered-route annual-history route", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("binds route geometry and buffer without applying report dates", async () => {
    query.mockResolvedValue({ rows: annualRows });

    const response = await postBufferedRouteHistory(
      postRequest({ route, bufferInFeet: 20 }),
    );

    expect(response.status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual([
      JSON.stringify(route.features.map((feature) => feature.geometry)),
      6.096,
    ]);
    await expect(response.json()).resolves.toEqual(annualSummaries);
  });

  it.each([
    [null, "a JSON object body is required"],
    [{ bufferInFeet: 20 }, "route is required"],
    [
      { route: { type: "FeatureCollection", features: [] }, bufferInFeet: 20 },
      "route must contain at least one feature with a geometry",
    ],
    [{ route }, "bufferInFeet is required"],
  ])("rejects invalid route history input", async (body, error) => {
    const response = await postBufferedRouteHistory(postRequest(body));

    await expectError(response, 400, error);
    expect(query).not.toHaveBeenCalled();
  });

  it("preserves the invalid-JSON response", async () => {
    const response = await postBufferedRouteHistory(invalidJsonRequest());

    await expectError(response, 400, "a JSON body is required");
    expect(query).not.toHaveBeenCalled();
  });

  it("returns a safe 500 when the database query fails", async () => {
    query.mockRejectedValue(new Error("connection details"));

    const response = await postBufferedRouteHistory(
      postRequest({ route, bufferInFeet: 20 }),
    );

    await expectError(response, 500, "Database query failed");
  });
});

describe("streets route", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("returns database rows", async () => {
    const streets = [{ fullName: "N MAIN ST", crossingStreets: [] }];
    query.mockResolvedValue({ rows: streets });

    const response = await getStreets();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(streets);
  });

  it("returns a safe 500 when the database query fails", async () => {
    query.mockRejectedValue(new Error("connection details"));

    const response = await getStreets();

    await expectError(response, 500, "Database query failed");
  });
});
