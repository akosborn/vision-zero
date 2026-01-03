import dbClient from '@/app/lib/db';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bbox = searchParams.get('bbox');
  const year = searchParams.get('year');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius'); // in meters

  let whereClause = "WHERE 1=1";
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (year) {
    whereClause += ` AND EXTRACT(YEAR FROM first_occurrence_date) = $${paramIndex++}`;
    queryParams.push(parseInt(year));
  } else {
    // Default fallback if no year is selected
    whereClause += " AND first_occurrence_date > '2025-06-25'";
  }

  if (bbox) {
    const [minX, minY, maxX, maxY] = bbox.split(',').map(Number);
    whereClause += ` AND ST_Intersects(geo, ST_MakeEnvelope($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 4326))`;
      queryParams.push(minX, minY, maxX, maxY);
    } else if (lat && lng && radius) {
      whereClause += ` AND ST_DWithin(geo, ST_SetSRID(ST_Point($${paramIndex++}, $${paramIndex++}), 4326)::geography, $${paramIndex++})`;
      queryParams.push(parseFloat(lng), parseFloat(lat), parseFloat(radius));
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
                             'properties', to_jsonb(inputs) - 'object_id' -
                                           'geo'
                     ) AS feature
              FROM (SELECT
                        incident_id,
                        first_occurrence_date,
                        upper(trim(incident_address)) AS address,
                        case 
                            when geo_lat is not null and geo_lon is not null
                                then concat('https://www.google.com/maps?q=', geo_lat, ',', geo_lon)
                        end as google_maps_url,

                        neighborhood_id,
                        upper(trim(top_traffic_accident_offense)) AS top_traffic_accident_offense,

                        case
                            when seriously_injured > 0
                                then seriously_injured
                            when upper(top_traffic_accident_offense) like '%SBI%'
                                then 1
                            else
                                0
                        end AS serious_injuries,
                        case
                            when fatalities > 0
                                then fatalities
                            when upper(top_traffic_accident_offense) like '%FATAL%'
                                then 1
                            else
                                0
                        end AS fatalities,
                        bicycle_ind > 0 AS bicycle_involved,
                        pedestrian_ind > 0 AS pedestrian_involved,
                        
                        COALESCE(bicycle_ind, 0) as bicycle_count,
                        COALESCE(pedestrian_ind, 0) as pedestrian_count,

                        upper(trim(tu1_vehicle_movement)) AS tu1_vehicle_movement,
                        upper(trim(tu1_driver_action)) AS tu1_driver_action,
                        upper(trim(tu1_driver_humancontribfactor)) AS tu1_driver_humancontribfactor,
                        upper(trim(tu1_pedestrian_action)) AS tu1_pedestrian_action,
                        upper(trim(tu1_vehicle_type)) AS tu1_vehicle_type,
                        upper(trim(tu1_travel_direction)) AS tu1_travel_direction,

                        upper(trim(harmful_event_seq_1)) AS harmful_event_seq_1,
                        upper(trim(harmful_event_seq_2)) AS harmful_event_seq_2,
                        upper(trim(harmful_event_seq_3)) AS harmful_event_seq_3,


                        object_id,
                        offense_id,
                        offense_code,
                        offense_code_extension,
                        reported_date,
                        geo,
                        geo_x,
                        geo_y,
                        geo_lon,
                        geo_lat,
                        district_id,
                        precinct_id,

                        upper(trim(road_location)) AS road_location,
                        upper(trim(road_description)) AS road_description,
                        upper(trim(road_contour)) AS road_contour,
                        upper(trim(road_condition)) AS road_condition,
                        upper(trim(light_condition)) AS light_condition,


                        upper(trim(tu2_vehicle_type)) AS tu2_vehicle_type,
                        upper(trim(tu2_travel_direction)) AS tu2_travel_direction,
                        upper(trim(tu2_vehicle_movement)) AS tu2_vehicle_movement,
                        upper(trim(tu2_driver_action)) AS tu2_driver_action,
                        upper(trim(tu2_driver_humancontribfactor)) AS tu2_driver_humancontribfactor,
                        upper(trim(tu2_pedestrian_action)) AS tu2_pedestrian_action,

                        upper(trim(fatality_mode_1)) AS fatality_mode_1,
                        upper(trim(fatality_mode_2)) AS fatality_mode_2,
                        upper(trim(seriously_injured_mode_1)) AS seriously_injured_mode_1,
                        upper(trim(seriously_injured_mode_2)) AS seriously_injured_mode_2,
                        data_notes
                    FROM vision_zero.incidents_denver
                    ${whereClause}) inputs) features;
    `;

  const results = await dbClient.query(query, queryParams);
  return Response.json(results.rows[0].geojson);
}
