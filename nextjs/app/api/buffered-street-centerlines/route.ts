import dbClient from "@/app/lib/db";
import { NextRequest } from "next/server";

const METERS_PER_FEET = 0.3048;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fullStreetName = searchParams.get("fullStreetName");
  const bufferInFeet = searchParams.get("bufferInFeet");

  const crossStreet1 = searchParams.get("crossStreet1");
  const crossStreet2 = searchParams.get("crossStreet2");

  if (!fullStreetName) {
    return Response.json({
      error: "streetName is required",
    });
  }

  if (!bufferInFeet) {
    return Response.json({
      error: "bufferInFeet is required",
    });
  }

  const bufferInMeters = parseFloat(bufferInFeet) * METERS_PER_FEET;

  if (crossStreet1 && crossStreet2) {
    const partialStreetQuery = `
      SELECT jsonb_build_object(
               'type', 'FeatureCollection',
               'features', jsonb_build_array(
                 jsonb_build_object(
                   'type', 'Feature',
                   'geometry', ST_AsGeoJSON(
                     ST_Buffer(
                       ST_Union(geom)::geography,
                       ${bufferInMeters}
                     )::geometry
                               )::jsonb,
                   'properties', jsonb_build_object(
                     'name', '${fullStreetName}',
                     'is_buffer', true
                                 )
                 )
                           )
             ) AS geojson
      FROM ( select * from get_street_segments_between('${fullStreetName}', '${crossStreet1}', '${crossStreet2}') ) features;
    `;

    const results = await dbClient.query(partialStreetQuery);
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
              ${bufferInMeters}
            )::geometry
          )::jsonb,
          'properties', jsonb_build_object(
            'name', '${fullStreetName}',
            'is_buffer', true
          )
        )
      )
    ) AS geojson
    FROM public.denver_street_centerlines
    WHERE fullname = '${fullStreetName}';
  `;

  const results = await dbClient.query(query);
  return Response.json(results.rows[0].geojson);
}
