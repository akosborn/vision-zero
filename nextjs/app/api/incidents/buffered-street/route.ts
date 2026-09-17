import dbClient from "@/app/lib/db";
import { databaseFailureResponse } from "@/app/lib/api-responses";
import {
  validateBufferInFeet,
  validateCrossStreetPair,
  validateDateRange,
  validateStreetName,
} from "@/app/lib/street-route-input";
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
  let paramIndex = queryParams.length + 1;
  let whereClause = "WHERE 1=1";

  if (dateRange.value.startDate) {
    whereClause += ` AND doti_first_occurrence_date >= $${paramIndex++}`;
    queryParams.push(dateRange.value.startDate);
  }

  if (dateRange.value.endDate) {
    whereClause += ` AND doti_first_occurrence_date <= $${paramIndex++}`;
    queryParams.push(dateRange.value.endDate);
  }

  try {
    if (crossStreets.value) {
      const query = `
        SELECT jsonb_build_object(
                       'type', 'FeatureCollection',
                       'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
               ) AS geojson
        FROM (SELECT jsonb_build_object(
                             'type', 'Feature',
                             'id', doti_object_id,
                             'geometry', ST_AsGeoJSON(priority_geo)::jsonb,
                             'properties', to_jsonb(inputs) - 'doti_object_id' - 'doti_geo' - 'cdot_geo'
                     ) AS feature
              FROM (
                 with buffered_line as (
                     SELECT ST_Buffer(
                                 ST_Union(geom)::geography, 
                                 $1
                             )::geometry AS line
                     FROM (
                       SELECT *
                       FROM get_street_segments_between($2::varchar, $3::varchar, $4::varchar)
                     ) inputs
                 )
                 SELECT *
                 FROM vision_zero.vw_crashes vc
                    JOIN buffered_line bl ON ST_Intersects(vc.priority_geo, bl.line)
                 ${whereClause}
              ) inputs) features;
    `;

      const results = await dbClient.query(query, queryParams);
      return Response.json(results.rows[0].geojson);
    }

    const entireStreetQuery = `
        SELECT jsonb_build_object(
                       'type', 'FeatureCollection',
                       'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
               ) AS geojson
        FROM (SELECT jsonb_build_object(
                             'type', 'Feature',
                             'id', doti_object_id,
                             'geometry', ST_AsGeoJSON(priority_geo)::jsonb,
                             'properties', to_jsonb(inputs) - 'doti_object_id' - 'doti_geo' - 'cdot_geo'
                     ) AS feature
               FROM (
                WITH buffered_line as (
                    SELECT ST_Buffer(
                       ST_Union(geom)::geography, 
                       $1
                    )::geometry AS line
                    FROM public.denver_street_centerlines
                    WHERE fullname = $2
                )
                SELECT *
                FROM vision_zero.vw_crashes vc
                    JOIN buffered_line bl ON ST_Intersects(vc.priority_geo, bl.line)
                ${whereClause}) inputs) features;
    `;

    const results = await dbClient.query(entireStreetQuery, queryParams);
    return Response.json(results.rows[0].geojson);
  } catch {
    return databaseFailureResponse();
  }
}
