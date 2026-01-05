import dbClient from '@/app/lib/db';
import { NextRequest } from 'next/server';

const METERS_PER_FEET = 0.3048;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const streetName = searchParams.get('streetName');
  const bufferInFeet = searchParams.get('bufferInFeet');

  if (!streetName) {
    return Response.json({
      error: 'streetName is required'
    });
  }

  if (!bufferInFeet) {
    return Response.json({
      error: 'bufferInFeet is required'
    });
  }

  const bufferInMeters = parseFloat(bufferInFeet) * METERS_PER_FEET;

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
            'name', '${streetName}',
            'is_buffer', true
          )
        )
      )
    ) AS geojson
    FROM public.denver_street_centerlines
    WHERE CONCAT(name, type) = '${streetName}';
  `;

  const results = await dbClient.query(query);
  return Response.json(results.rows[0].geojson);
}
