import dbClient from "@/app/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bbox = searchParams.get("bbox");
  const streetName = searchParams.get("streetName");

  const crossStreet1 = searchParams.get("crossStreet1");
  const crossStreet2 = searchParams.get("crossStreet2");

  let whereClause = "WHERE 1=1";
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (bbox) {
    const [minX, minY, maxX, maxY] = bbox.split(",").map(Number);
    whereClause += ` AND ST_Intersects(geom, ST_MakeEnvelope($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 4326))`;
    queryParams.push(minX, minY, maxX, maxY);
  }

  if (streetName) {
    whereClause += ` AND CONCAT(name, type) = '${streetName}'`;
  }

  if (crossStreet1 && crossStreet2) {
    const partialStreetQuery = `
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
          FROM (
                 WITH RECURSIVE path AS (
                   -- Start with segments that connect to either intersection
                   SELECT *,
                          1 as level,
                          ARRAY[id] as path_ids
                   FROM public.denver_street_centerlines
                   WHERE CONCAT(name, type) = '${streetName}'
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
                   WHERE CONCAT(s.name, s.type) = '${streetName}'
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
                 ${whereClause}
                 ORDER BY v.path_ids, ord
               ) inputs
         ) features;
  `;

    const results = await dbClient.query(partialStreetQuery, queryParams);
    return Response.json(results.rows[0].geojson);
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
}
