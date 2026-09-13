import {
  validateBufferInFeet,
  validateCrossStreetPair,
  validateDateRange,
  validateStreetName,
} from "@/app/lib/street-route-input";
import {
  appendDateRangeWhere,
  buildIncidentsGeoJsonQuery,
  runIncidentsGeoJsonQuery,
} from "@/app/lib/incidents-geojson";
import { NextRequest } from "next/server";

const METERS_PER_FEET = 0.3048;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fullStreetName = validateStreetName(
    searchParams.get("fullStreetName"),
    "fullStreetName",
    true,
  );
  if (fullStreetName.error) {
    return fullStreetName.error;
  }

  const bufferInFeet = validateBufferInFeet(searchParams.get("bufferInFeet"));
  if (bufferInFeet.error) {
    return bufferInFeet.error;
  }

  const crossStreets = validateCrossStreetPair(
    searchParams.get("crossStreet1"),
    searchParams.get("crossStreet2"),
  );
  if (crossStreets.error) {
    return crossStreets.error;
  }

  const dateRange = validateDateRange(
    searchParams.get("startDate"),
    searchParams.get("endDate"),
  );
  if (dateRange.error) {
    return dateRange.error;
  }

  const bufferInMeters = METERS_PER_FEET * bufferInFeet.value;
  const queryParams: (string | number)[] = crossStreets.value
    ? [bufferInMeters, fullStreetName.value, ...crossStreets.value]
    : [bufferInMeters, fullStreetName.value];

  let whereClause = "WHERE ST_Intersects(c.doti_priority_geo, bl.line)";
  ({ whereClause } = appendDateRangeWhere(
    dateRange.value,
    whereClause,
    queryParams,
    queryParams.length + 1,
  ));

  const bufferExpr = crossStreets.value
    ? `vision_zero.buffer_street_segment($2::varchar, $3::varchar, $4::varchar, $1)`
    : `vision_zero.buffer_full_street($2::varchar, $1)`;

  const query = buildIncidentsGeoJsonQuery(`
    WITH buffered_line AS (
        SELECT ${bufferExpr} AS line
    )
    SELECT c.*
    FROM vision_zero.vw_crashes c
    JOIN buffered_line bl ON true
    ${whereClause}
  `);

  return runIncidentsGeoJsonQuery(query, queryParams);
}
