import dbClient from '@/app/lib/db';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bbox = searchParams.get('bbox');

  let whereClause = "WHERE first_occurrence_date > '2025-12-25'";
  const queryParams: any[] = [];

  if (bbox) {
    const [minX, minY, maxX, maxY] = bbox.split(',').map(Number);
    // Use ST_MakeEnvelope(minX, minY, maxX, maxY, srid)
    // 4326 is standard WGS 84 (lat/lng)
    whereClause += ` AND ST_Intersects(geo, ST_MakeEnvelope($1, $2, $3, $4, 4326))`;
    queryParams.push(minX, minY, maxX, maxY);
  }

  const query = `
        SELECT jsonb_build_object(
                       'type', 'FeatureCollection',
                       'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
               ) AS geojson
        FROM (SELECT jsonb_build_object(
                             'type', 'Feature',
                             'id', object_id,
                             'geometry', ST_AsGeoJSON(geo)::jsonb,
                             'properties', to_jsonb(inputs) - 'gid' -
                                           'geometry'
                     ) AS feature
              FROM (SELECT *
                    FROM vision_zero.incidents_denver
                    ${whereClause}) inputs) features;
    `;

  const results = await dbClient.query(query, queryParams);
  return Response.json(results.rows[0].geojson);
}
