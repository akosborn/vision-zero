import dbClient from "@/app/lib/db";
import { databaseFailureResponse } from "@/app/lib/api-responses";

const PROPS_TO_STRIP = [
  "doti_object_id",
  "doti_geo",
  "cdot_geo",
  "doti_priority_geo",
];

/**
 * Extends a WHERE clause + params array with optional startDate/endDate
 * bounds. Returns the updated clause and the next free param index.
 */
export const appendDateRangeWhere = (
  dateRange: { startDate?: string | null; endDate?: string | null },
  whereClause: string,
  queryParams: (string | number)[],
  paramIndex: number,
): { whereClause: string; paramIndex: number } => {
  let updatedClause = whereClause;
  let updatedParamIndex = paramIndex;

  if (dateRange.startDate) {
    updatedClause += ` AND doti_first_occurrence_date >= $${updatedParamIndex++}`;
    queryParams.push(dateRange.startDate);
  }

  if (dateRange.endDate) {
    updatedClause += ` AND doti_first_occurrence_date <= $${updatedParamIndex++}`;
    queryParams.push(dateRange.endDate);
  }

  return { whereClause: updatedClause, paramIndex: updatedParamIndex };
};

/**
 * Builds the outer FeatureCollection-wrapping query around a caller-supplied
 * inner query. `innerQuery` must select from
 * vision_zero.incidents_with_crash_data (aliased `v`) — optionally via a CTE
 * — and must respect `whereClause`.
 */
export const buildIncidentsGeoJsonQuery = (innerQuery: string): string => {
  return `
    SELECT jsonb_build_object(
                   'type', 'FeatureCollection',
                   'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
           ) AS geojson
    FROM (SELECT jsonb_build_object(
                         'type', 'Feature',
                         'id', doti_object_id,
                         'geometry', ST_AsGeoJSON(COALESCE(cdot_geo, doti_geo))::jsonb,
                         'properties', to_jsonb(inputs) - ${PROPS_TO_STRIP.map((p) => `'${p}'`).join(" - ")}
                 ) AS feature
          FROM (${innerQuery}) inputs) features;
  `;
};

export const runIncidentsGeoJsonQuery = async (
  query: string,
  params: (string | number)[],
) => {
  try {
    const results = await dbClient.query(query, params);
    return Response.json(results.rows[0].geojson);
  } catch (e) {
    console.error(e);
    return databaseFailureResponse();
  }
};
