import dbClient from "@/app/lib/db";
import { NextRequest } from "next/server";

const METERS_PER_FEET = 0.3048;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const streetName = searchParams.get("streetName");
  const bufferInFeet = searchParams.get("bufferInFeet");

  if (!streetName) {
    return Response.json({
      error: "streetName is required",
    });
  }

  if (!bufferInFeet) {
    return Response.json({
      error: "bufferInFeet is required",
    });
  }

  let whereClause = "WHERE 1=1";
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (startDate) {
    whereClause += ` AND first_occurrence_date >= $${paramIndex++}`;
    queryParams.push(startDate);
  }

  if (endDate) {
    whereClause += ` AND first_occurrence_date <= $${paramIndex++}`;
    queryParams.push(endDate);
  }

  const bufferInMeters = METERS_PER_FEET * parseInt(bufferInFeet);

  const entireStreetQuery = `
        SELECT jsonb_build_object(
                       'type', 'FeatureCollection',
                       'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
               ) AS geojson
        FROM (SELECT jsonb_build_object(
                             'type', 'Feature',
                             'id', doti_object_id,
                             'geometry', ST_AsGeoJSON(COALESCE(cdot_geo, doti_geo))::jsonb,
                             'properties', to_jsonb(inputs) - 'doti_object_id' - 'doti_geo' - 'cdot_geo'
                     ) AS feature
              FROM (
                 with buffered_line as (
                     SELECT ST_Buffer(
                                 ST_Union(geom)::geography, 
                                 ${bufferInMeters}
                             )::geometry AS line
                      FROM public.denver_street_centerlines
                      WHERE CONCAT(name, type) = '${streetName}'
                )
                      SELECT
                        doti.incident_id as doti_incident_id,
                        doti.object_id as doti_object_id,
                        doti.first_occurrence_date as doti_first_occurrence_date,
                        upper(trim(doti.incident_address)) AS doti_address,
                        case 
                            when doti.geo_lat is not null and doti.geo_lon is not null
                                then concat('https://www.google.com/maps?q=', doti.geo_lat, ',', doti.geo_lon)
                        end as doti_google_maps_url,

                        doti.neighborhood_id as doti_neighborhood_id,
                        upper(trim(doti.top_traffic_accident_offense)) AS doti_top_traffic_accident_offense,

                        case
                            when doti.seriously_injured > 0
                                then doti.seriously_injured
                            when upper(doti.top_traffic_accident_offense) like '%SBI%'
                                then 1
                            else
                                0
                        end AS doti_serious_injuries,
                        case
                            when doti.fatalities > 0
                                then doti.fatalities
                            when upper(doti.top_traffic_accident_offense) like '%FATAL%'
                                then 1
                            else
                                0
                        end AS doti_fatalities,
                        doti.bicycle_ind > 0 AS doti_bicycle_involved,
                        doti.pedestrian_ind > 0 AS doti_pedestrian_involved,
                        
                        COALESCE(doti.bicycle_ind, 0) as doti_bicycle_count,
                        COALESCE(doti.pedestrian_ind, 0) as doti_pedestrian_count,

                        upper(trim(doti.tu1_vehicle_movement)) AS doti_tu1_vehicle_movement,
                        upper(trim(doti.tu1_driver_action)) AS doti_tu1_driver_action,
                        upper(trim(doti.tu1_driver_humancontribfactor)) AS doti_tu1_driver_humancontribfactor,
                        upper(trim(doti.tu1_pedestrian_action)) AS doti_tu1_pedestrian_action,
                        upper(trim(doti.tu1_vehicle_type)) AS doti_tu1_vehicle_type,
                        upper(trim(doti.tu1_travel_direction)) AS doti_tu1_travel_direction,

                        upper(trim(doti.harmful_event_seq_1)) AS doti_harmful_event_seq_1,
                        upper(trim(doti.harmful_event_seq_2)) AS doti_harmful_event_seq_2,
                        upper(trim(doti.harmful_event_seq_3)) AS doti_harmful_event_seq_3,
                        
                        doti.geo as doti_geo,

                        upper(trim(doti.road_location)) AS doti_road_location,
                        upper(trim(doti.road_description)) AS doti_road_description,
                        upper(trim(doti.road_contour)) AS doti_road_contour,
                        upper(trim(doti.road_condition)) AS doti_road_condition,
                        upper(trim(doti.light_condition)) AS doti_light_condition,


                        upper(trim(doti.tu2_vehicle_type)) AS doti_tu2_vehicle_type,
                        upper(trim(doti.tu2_travel_direction)) AS doti_tu2_travel_direction,
                        upper(trim(doti.tu2_vehicle_movement)) AS doti_tu2_vehicle_movement,
                        upper(trim(doti.tu2_driver_action)) AS doti_tu2_driver_action,
                        upper(trim(doti.tu2_driver_humancontribfactor)) AS doti_tu2_driver_humancontribfactor,
                        upper(trim(doti.tu2_pedestrian_action)) AS doti_tu2_pedestrian_action,

                        upper(trim(doti.fatality_mode_1)) AS doti_fatality_mode_1,
                        upper(trim(doti.fatality_mode_2)) AS doti_fatality_mode_2,
                        upper(trim(doti.seriously_injured_mode_1)) AS doti_seriously_injured_mode_1,
                        upper(trim(doti.seriously_injured_mode_2)) AS doti_seriously_injured_mode_2,
                        doti.data_notes,
                        
                        -- CDOT Data
                        cdot.cuid as cdot_cuid,
                        cdot.geo as cdot_geo,
                        cdot.mhe as cdot_mhe,
                        cdot.number_killed as cdot_number_killed,
                        cdot.number_injured as cdot_number_injured,
                        cdot.injury_00 as cdot_injury_00,
                        cdot.injury_01 as cdot_injury_01,
                        cdot.injury_02 as cdot_injury_02,
                        cdot.injury_03 as cdot_injury_03,
                        cdot.injury_04 as cdot_injury_04,
                        
                        cdot.total_vehicles as cdot_total_vehicles,
                        cdot.construction_zone as cdot_construction_zone,
                        cdot.school_zone as cdot_school_zone,
                        
                        cdot.tu_1_speed_limit as cdot_tu_1_speed_limit,
                        cdot.tu_1_estimated_speed as cdot_tu_1_estimated_speed,
                        cdot.tu_1_speed as cdot_tu_1_speed,
                        cdot.tu_1_age as cdot_tu_age,
                        cdot.tu_1_sex as cdot_tu_sex,

                        cdot.tu_2_speed_limit as cdot_tu_2_speed_limit,
                        cdot.tu_2_estimated_speed as cdot_tu_2_estimated_speed,
                        cdot.tu_2_speed as cdot_tu_2_speed,
                        cdot.tu_2_age as cdot_tu_age,
                        cdot.tu_2_sex as cdot_tu_sex,

                        cdot.tu_1_nm_facility_available as cdot_tu_1_nm_facility_available,
                        cdot.tu_1_nm_safety_helmet as cdot_tu_1_nm_safety_helmet,
                        cdot.tu_1_nm_location as cdot_tu_1_nm_location,
                        cdot.tu_1_nm_type as cdot_tu_1_nm_type,
                        cdot.tu_1_nm_age as cdot_tu_1_age,
                        cdot.tu_1_nm_sex as cdot_tu_1_sex,

                        cdot.tu_2_nm_facility_available as cdot_tu_2_nm_facility_available,
                        cdot.tu_2_nm_safety_helmet as cdot_tu_2_nm_safety_helmet,
                        cdot.tu_2_nm_location as cdot_tu_2_nm_location,
                        cdot.tu_2_nm_type as cdot_tu_2_nm_type,
                        cdot.tu_2_nm_age as cdot_tu_2_age,
                        cdot.tu_2_nm_sex as cdot_tu_2_sex
                    FROM vision_zero.incidents_denver doti
                         left join vision_zero.cdot_crashes cdot ON
                            ST_DWithin(
                              cdot.geo,
                              doti.geo,
                              200 -- Meters. This is somewhat arbitrary but should fine since the dates and times have to match.
                            )
                        and doti.first_occurrence_date = (crash_date + crash_time) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver'
                        and cdot.suspected_duplicate = false
                    join buffered_line bl on st_dwithin(COALESCE(cdot.geo, doti.geo)::geography, bl.line::geography, 0)
                    ${whereClause}) inputs) features;
    `;

  const results = await dbClient.query(entireStreetQuery, queryParams);
  return Response.json(results.rows[0].geojson);
}
