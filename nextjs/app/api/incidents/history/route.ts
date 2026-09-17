import dbClient from "@/app/lib/db";
import {
  databaseFailureResponse,
  invalidInputResponse,
} from "@/app/lib/api-responses";
import {
  buildAnnualCrashHistoryQuery,
  mapAnnualCrashSummaryRows,
} from "@/app/lib/annual-crash-history";
import { validateRadiusSearch } from "@/app/lib/street-route-input";
import { NextRequest } from "next/server";

const METERS_PER_FEET = 0.3048;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const radiusSearch = validateRadiusSearch(
    searchParams.get("lat"),
    searchParams.get("lng"),
    searchParams.get("radiusInFeet"),
  );
  if (radiusSearch.error) {
    return radiusSearch.error;
  }
  if (!radiusSearch.value) {
    return invalidInputResponse("lat, lng, and radiusInFeet are required");
  }

  const query = buildAnnualCrashHistoryQuery({
    spatialClause: `
      WHERE ST_DWithin(
        doti.priority_geo,
        ST_SetSRID(ST_Point($1, $2), 4326)::geography,
        $3
      )
    `,
  });
  const queryParams = [
    radiusSearch.value.longitude,
    radiusSearch.value.latitude,
    radiusSearch.value.radiusInFeet * METERS_PER_FEET,
  ];

  try {
    const results = await dbClient.query(query, queryParams);
    return Response.json(mapAnnualCrashSummaryRows(results.rows));
  } catch {
    return databaseFailureResponse();
  }
}
