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
    FROM (
                 WITH RECURSIVE path AS (
                   -- Start with segments that connect to either intersection
                   SELECT *,
                          1 as level,
                          ARRAY[id] as path_ids
                   FROM public.denver_street_centerlines
                   WHERE fullname = '${fullStreetName}'
                     AND (fromname = '${crossStreet1}' OR toname = '${crossStreet1}')

                   UNION ALL

                   -- Recursively find connecting segments
                   SELECT s.*,
                          p.level + 1,
                          p.path_ids || s.id
                   FROM public.denver_street_centerlines s
                          JOIN path p ON
                     (s.fromname = p.toname OR s.fromname = p.fromname OR
                      s.toname = p.toname OR s.toname = p.fromname)
                   WHERE s.fullname = '${fullStreetName}'
                     AND s.id <> ALL(p.path_ids)  -- Avoid cycles
                     AND p.level < 10  -- Limit recursion depth
                 ),
                valid_paths AS (
                  SELECT DISTINCT path_ids
                  FROM path p
                  WHERE EXISTS (
                    SELECT 1
                    FROM public.denver_street_centerlines x
                    WHERE x.id = ANY(p.path_ids)
                      AND (x.fromname = '${crossStreet2}' OR x.toname = '${crossStreet2}')
                  )
                )
                 SELECT
                   dc.*,
                   row_number() OVER (PARTITION BY v.path_ids ORDER BY ord) as segment_number
                 FROM valid_paths v,
                      unnest(v.path_ids) WITH ORDINALITY AS u(id, ord)
                        JOIN public.denver_street_centerlines dc ON dc.id = u.id
                 where dc.fullname = '${fullStreetName}'
                 ORDER BY v.path_ids, ord
         ) features;
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
