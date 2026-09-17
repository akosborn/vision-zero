import dbClient from "@/app/lib/db";
import {
  databaseFailureResponse,
  invalidInputResponse,
} from "@/app/lib/api-responses";
import {
  buildAnnualCrashHistoryQuery,
  mapAnnualCrashSummaryRows,
} from "@/app/lib/annual-crash-history";
import { validateBufferInFeet } from "@/app/lib/street-route-input";
import { NextRequest } from "next/server";
import { FeatureCollection } from "geojson";

const METERS_PER_FEET = 0.3048;

type Body = {
  route?: unknown;
  bufferInFeet?: unknown;
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

  const { route, bufferInFeet } = body;
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

  const query = buildAnnualCrashHistoryQuery({
    searchAreaCte: `
      WITH buffered_line AS (
        SELECT ST_Buffer(
          ST_Union(
            ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON(route_geometry)), 4326)
          )::geography,
          $2
        )::geometry AS line
        FROM jsonb_array_elements($1::jsonb) AS route_geometry
      )
    `,
    spatialClause:
      "JOIN buffered_line bl ON ST_Intersects(COALESCE(cdot.geo, doti.geo), bl.line)",
  });
  const queryParams = [
    JSON.stringify(features.map((feature) => feature.geometry)),
    validatedBufferInFeet.value * METERS_PER_FEET,
  ];

  try {
    const results = await dbClient.query(query, queryParams);
    return Response.json(mapAnnualCrashSummaryRows(results.rows));
  } catch {
    return databaseFailureResponse();
  }
}
