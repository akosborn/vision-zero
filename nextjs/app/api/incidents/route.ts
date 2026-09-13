import { invalidInputResponse } from "@/app/lib/api-responses";
import {
  validateBoundingBox,
  validateDateRange,
  validateRadiusSearch,
} from "@/app/lib/street-route-input";
import {
  buildIncidentsGeoJsonQuery,
  runIncidentsGeoJsonQuery,
} from "@/app/lib/incidents-geojson";
import { NextRequest } from "next/server";

const METERS_PER_FEET = 0.3048;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dateRange = validateDateRange(
    searchParams.get("startDate"),
    searchParams.get("endDate"),
  );
  if (dateRange.error) {
    return dateRange.error;
  }

  const bbox = validateBoundingBox(searchParams.get("bbox"));
  if (bbox.error) {
    return bbox.error;
  }

  const radiusSearch = validateRadiusSearch(
    searchParams.get("lat"),
    searchParams.get("lng"),
    searchParams.get("radiusInFeet"),
  );
  if (radiusSearch.error) {
    return radiusSearch.error;
  }

  if (bbox.value && radiusSearch.value) {
    return invalidInputResponse(
      "bbox cannot be combined with lat, lng, or radiusInFeet",
    );
  }

  let whereClause = "WHERE 1=1";
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (dateRange.value.startDate) {
    whereClause += ` AND doti_first_occurrence_date >= $${paramIndex++}`;
    queryParams.push(dateRange.value.startDate);
  }

  if (dateRange.value.endDate) {
    whereClause += ` AND doti_first_occurrence_date <= $${paramIndex++}`;
    queryParams.push(dateRange.value.endDate);
  }

  if (bbox.value) {
    whereClause += ` AND ST_Intersects(COALESCE(cdot_geo, doti_geo), ST_MakeEnvelope($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 4326))`;
    queryParams.push(...bbox.value);
  } else if (radiusSearch.value) {
    const radiusInMeters = radiusSearch.value.radiusInFeet * METERS_PER_FEET;
    whereClause += ` AND ST_DWithin(COALESCE(cdot_geo, doti_geo), ST_SetSRID(ST_Point($${paramIndex++}, $${paramIndex++}), 4326)::geography, $${paramIndex++})`;
    queryParams.push(
      radiusSearch.value.longitude,
      radiusSearch.value.latitude,
      radiusInMeters,
    );
  }

  const query = buildIncidentsGeoJsonQuery(`
    SELECT c.*
    FROM vision_zero.vw_crashes c
    ${whereClause}
  `);

  return runIncidentsGeoJsonQuery(query, queryParams);
}
