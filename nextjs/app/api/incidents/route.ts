import dbClient from '@/app/lib/db';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bbox = searchParams.get('bbox');
  const year = searchParams.get('year');

  let whereClause = "WHERE 1=1";
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (year) {
    whereClause += ` AND EXTRACT(YEAR FROM first_occurrence_date) = $${paramIndex++}`;
    queryParams.push(parseInt(year));
  } else {
    // Default fallback if no year is selected
    whereClause += " AND first_occurrence_date > '2025-12-25'";
  }

  if (bbox) {
    const [minX, minY, maxX, maxY] = bbox.split(',').map(Number);
    whereClause += ` AND ST_Intersects(geo, ST_MakeEnvelope($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 4326))`;
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
