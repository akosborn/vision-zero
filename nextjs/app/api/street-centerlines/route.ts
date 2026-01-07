import dbClient from "@/app/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bbox = searchParams.get("bbox");
  const streetName = searchParams.get("streetName");

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
