import { invalidInputResponse } from "@/app/lib/api-responses";
import {
  validateBufferInFeet,
  validateDateRange,
} from "@/app/lib/street-route-input";
import {
  appendDateRangeWhere,
  buildIncidentsGeoJsonQuery,
  runIncidentsGeoJsonQuery,
} from "@/app/lib/incidents-geojson";
import { NextRequest } from "next/server";
import { FeatureCollection } from "geojson";

const METERS_PER_FEET = 0.3048;

type Body = {
  route?: unknown;
  bufferInFeet?: unknown;
  startDate?: unknown;
  endDate?: unknown;
};

export async function POST(request: NextRequest) {
  let body: Body;

  try {
    const parsedBody: unknown = await request.json();
    if (
      parsedBody === null ||
      typeof parsedBody !== "object" ||
      Array.isArray(parsedBody)
    ) {
      return invalidInputResponse("a JSON object body is required");
    }
    body = parsedBody as Body;
  } catch {
    return invalidInputResponse("a JSON body is required");
  }

  const { route, bufferInFeet, startDate, endDate } = body;

  if (!route) {
    return invalidInputResponse("route is required");
  }

  const candidateRoute = route as Partial<FeatureCollection>;
  if (
    typeof route !== "object" ||
    Array.isArray(route) ||
    candidateRoute.type !== "FeatureCollection" ||
    !Array.isArray(candidateRoute.features)
  ) {
    return invalidInputResponse("route must be a GeoJSON FeatureCollection");
  }

  const features = candidateRoute.features.filter(
    (feature) => feature?.geometry,
  );

  if (features.length === 0) {
    return invalidInputResponse(
      "route must contain at least one feature with a geometry",
    );
  }

  const validatedBufferInFeet = validateBufferInFeet(bufferInFeet);
  if (validatedBufferInFeet.error) {
    return validatedBufferInFeet.error;
  }

  const dateRange = validateDateRange(startDate, endDate);
  if (dateRange.error) {
    return dateRange.error;
  }

  const bufferInMeters = METERS_PER_FEET * validatedBufferInFeet.value;

  const queryParams: (string | number)[] = [
    JSON.stringify(features.map((feature) => feature.geometry)),
    bufferInMeters,
  ];

  let whereClause = "WHERE ST_Intersects(c.doti_priority_geo, bl.line)";
  ({ whereClause } = appendDateRangeWhere(
    dateRange.value,
    whereClause,
    queryParams,
    queryParams.length + 1,
  ));

  const query = buildIncidentsGeoJsonQuery(`
    WITH buffered_line AS (
        SELECT vision_zero.buffer_route_geometries($1::jsonb, $2) AS line
    )
    SELECT c.*
    FROM vision_zero.vw_crashes c
    JOIN buffered_line bl ON true
    ${whereClause}
  `);

  return runIncidentsGeoJsonQuery(query, queryParams);
}
