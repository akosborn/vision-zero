import dbClient from "@/app/lib/db";
import {
  databaseFailureResponse,
  invalidInputResponse,
} from "@/app/lib/api-responses";
import {
  validateBoundingBox,
  validateCrossStreetPair,
  validateStreetName,
} from "@/app/lib/street-route-input";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fullStreetName = validateStreetName(
    searchParams.get("fullStreetName"),
    "fullStreetName",
  );
  if (fullStreetName.error) {
    return fullStreetName.error;
  }

  const crossStreets = validateCrossStreetPair(
    searchParams.get("crossStreet1"),
    searchParams.get("crossStreet2"),
  );
  if (crossStreets.error) {
    return crossStreets.error;
  }

  if (crossStreets.value && !fullStreetName.value) {
    return invalidInputResponse(
      "fullStreetName is required when cross streets are provided",
    );
  }

  const bbox = validateBoundingBox(searchParams.get("bbox"));
  if (bbox.error) {
    return bbox.error;
  }

  try {
    if (crossStreets.value && fullStreetName.value) {
      const partialStreetQuery = `
        SELECT jsonb_build_object(
                   'type', 'FeatureCollection',
                   'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
               ) AS geojson
        FROM (
          SELECT jsonb_build_object(
                         'type', 'Feature',
                         'id', id,
                         'geometry', ST_AsGeoJSON(geom)::jsonb,
                         'properties', to_jsonb(inputs) - 'gid' - 'geom'
                     ) AS feature
          FROM (
            SELECT *
            FROM get_street_segments_between($1::varchar, $2::varchar, $3::varchar)
          ) inputs
        ) features;
      `;

      const results = await dbClient.query(partialStreetQuery, [
        fullStreetName.value,
        ...crossStreets.value,
      ]);
      return Response.json(results.rows[0].geojson);
    }

    let whereClause = "WHERE 1=1";
    const queryParams: (string | number)[] = [];
    let paramIndex = 1;

    if (bbox.value) {
      whereClause += ` AND ST_Intersects(geom, ST_MakeEnvelope($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 4326))`;
      queryParams.push(...bbox.value);
    }

    if (fullStreetName.value) {
      whereClause += ` AND fullname = $${paramIndex++}`;
      queryParams.push(fullStreetName.value);
    }

    const query = `
          SELECT jsonb_build_object(
                         'type', 'FeatureCollection',
                         'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
                 ) AS geojson
          FROM (SELECT jsonb_build_object(
                               'type', 'Feature',
                               'id', id,
                               'geometry', ST_AsGeoJSON(geom)::jsonb,
                               'properties', to_jsonb(inputs) - 'gid' -
                                             'geom'
                       ) AS feature
                FROM (SELECT *
                      FROM public.denver_street_centerlines
                      ${whereClause}) inputs
                ) features;
      `;

    const results = await dbClient.query(query, queryParams);
    return Response.json(results.rows[0].geojson);
  } catch {
    return databaseFailureResponse();
  }
}
