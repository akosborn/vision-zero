import dbClient from "@/app/lib/db";
import { databaseFailureResponse } from "@/app/lib/api-responses";
import {
  validateBufferInFeet,
  validateCrossStreetPair,
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

  const bufferInMeters = bufferInFeet.value * METERS_PER_FEET;

  try {
    if (crossStreets.value) {
      const partialStreetQuery = `
        SELECT jsonb_build_object(
                 'type', 'FeatureCollection',
                 'features', jsonb_build_array(
                   jsonb_build_object(
                     'type', 'Feature',
                     'geometry', ST_AsGeoJSON(
                       ST_Buffer(
                         ST_Union(geom)::geography,
                         $1
                       )::geometry
                                 )::jsonb,
                     'properties', jsonb_build_object(
                       'name', $2::text,
                       'is_buffer', true
                                   )
                   )
                             )
               ) AS geojson
        FROM (
          SELECT *
          FROM get_street_segments_between($2::varchar, $3::varchar, $4::varchar)
        ) features;
      `;

      const results = await dbClient.query(partialStreetQuery, [
        bufferInMeters,
        fullStreetName.value,
        ...crossStreets.value,
      ]);
      return Response.json(results.rows[0].geojson);
    }

    const query = `
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_build_array(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(
              ST_Buffer(
                ST_Union(geom)::geography,
                $1
              )::geometry
            )::jsonb,
            'properties', jsonb_build_object(
              'name', $2::text,
              'is_buffer', true
            )
          )
        )
      ) AS geojson
      FROM public.denver_street_centerlines
      WHERE fullname = $2;
    `;

    const results = await dbClient.query(query, [
      bufferInMeters,
      fullStreetName.value,
    ]);
    return Response.json(results.rows[0].geojson);
  } catch {
    return databaseFailureResponse();
  }
}
