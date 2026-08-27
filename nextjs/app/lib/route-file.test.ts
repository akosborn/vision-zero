import { FeatureCollection, Geometry, LineString } from "geojson";
import { describe, expect, it, vi } from "vitest";

import {
  createFinalRoute,
  INITIAL_ROUTE_DRAWING_STATE,
  routeDrawingReducer,
} from "./route-drawing";
import { parseRouteFile, parseRouteText } from "./route-file";

const coordinates = [
  [-104.99, 39.74],
  [-104.98, 39.75],
];

const minimalGpx = `
  <gpx version="1.1" creator="Vision Zero" xmlns="http://www.topografix.com/GPX/1/1">
    <trk>
      <name>Equivalent route</name>
      <trkseg>
        <trkpt lat="39.74" lon="-104.99" />
        <trkpt lat="39.75" lon="-104.98" />
      </trkseg>
    </trk>
  </gpx>
`;

const minimalKml = `
  <kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
      <Placemark>
        <name>Equivalent route</name>
        <LineString>
          <coordinates>-104.99,39.74 -104.98,39.75</coordinates>
        </LineString>
      </Placemark>
    </Document>
  </kml>
`;

const lineCoordinates = (
  route: FeatureCollection<Geometry | null>,
): LineString["coordinates"] => {
  const geometry = route.features[0]?.geometry;

  expect(geometry?.type).toBe("LineString");
  return (geometry as LineString).coordinates;
};

const drawnRoute = () => {
  let state = routeDrawingReducer(INITIAL_ROUTE_DRAWING_STATE, {
    type: "start",
  });

  for (const coordinate of coordinates) {
    state = routeDrawingReducer(state, {
      type: "add-vertex",
      coordinate,
    });
  }

  return createFinalRoute(state)!;
};

describe("route file parsing", () => {
  it("parses equivalent GPX and KML into the drawn LineString coordinates", () => {
    const expectedCoordinates = lineCoordinates(drawnRoute());
    const gpxCoordinates = lineCoordinates(
      parseRouteText("equivalent.gpx", minimalGpx),
    );
    const kmlCoordinates = lineCoordinates(
      parseRouteText("equivalent.kml", minimalKml),
    );

    expect(gpxCoordinates).toEqual(expectedCoordinates);
    expect(kmlCoordinates).toEqual(expectedCoordinates);
  });

  it.each([
    ["ROUTE.GPX", minimalGpx],
    ["Route.KmL", minimalKml],
  ])("handles the extension in %s case-insensitively", async (name, text) => {
    const route = await parseRouteFile({
      name,
      text: vi.fn().mockResolvedValue(text),
    });

    expect(lineCoordinates(route)).toEqual(coordinates);
  });

  it("rejects unsupported extensions before reading the file", async () => {
    const text = vi.fn().mockResolvedValue(minimalGpx);

    await expect(
      parseRouteFile({ name: "route.geojson", text }),
    ).rejects.toThrow("Unsupported route file: expected a .gpx or .kml file");
    expect(text).not.toHaveBeenCalled();
  });
});
