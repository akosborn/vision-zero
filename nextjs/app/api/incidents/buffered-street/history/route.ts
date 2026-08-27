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

  const bufferInMeters = METERS_PER_FEET * bufferInFeet.value;

  try {
    if (crossStreets.value) {
      const query = `
      with buffered_line as (SELECT ST_Buffer(
                                      ST_Union(geom)::geography,
                                      $1
                              )::geometry AS line
                       FROM (
                         SELECT *
                         FROM get_street_segments_between($2::varchar, $3::varchar, $4::varchar)
                       ) inputs)
      SELECT
          date_part('year', first_occurrence_date)           as year,
          count(*)                                           as crashes,
          sum(
                  case
                      when cdot.cuid is not null then cdot.number_killed
                      when fatalities > 0 then fatalities
                      when upper(doti.top_traffic_accident_offense) like '%FATAL%' then 1
                      else 0
                      end
          )                                                  as fatalities,
          sum(
                  case
                      when cdot.cuid is not null then cdot.injury_03
                      when seriously_injured > 0 then seriously_injured
                      when upper(doti.top_traffic_accident_offense) like '%SBI%' then 1
                      else 0
                      end
          )                                                  as "seriousInjuries",
          sum(
                  case
                      when doti.bicycle_ind > 0 then doti.bicycle_ind
                      when lower(cdot.tu_1_nm_type) like '%bicycle%' then 1
                      when lower(cdot.tu_1_nm_type) like '%cyclist%' then 1
                      when lower(cdot.tu_1_nm_type) like '%non-motorist%' then 1
                      when lower(cdot.tu_1_nm_type) like '%scooter%' then 1
                      when lower(cdot.tu_2_nm_type) like '%bicycle%' then 1
                      when lower(cdot.tu_2_nm_type) like '%cyclist%' then 1
                      when lower(cdot.tu_2_nm_type) like '%non-motorist%' then 1
                      when lower(cdot.tu_2_nm_type) like '%scooter%' then 1
                      else 0
                      end
          )                                                  as "bicycleInvolvedCrashes",
          sum(
                  case
                      when doti.pedestrian_ind > 0 then doti.pedestrian_ind
                      when lower(cdot.tu_1_nm_type) like '%pedestrian%' then 1
                      when lower(cdot.tu_1_nm_type) like '%personal conveyance%' then 1
                      when lower(cdot.tu_1_nm_type) like '%wheelchair%' then 1
                      when lower(cdot.tu_2_nm_type) like '%pedestrian%' then 1
                      when lower(cdot.tu_2_nm_type) like '%personal conveyance%' then 1
                      when lower(cdot.tu_2_nm_type) like '%wheelchair%' then 1
                      else 0
                      end
          )                                                  as "pedestrianInvolvedCrashes",
          max(greatest(cdot.tu_1_estimated_speed, cdot.tu_2_estimated_speed)) as "maxSpeedMph",
          count(*) filter ( where cdot.tu_1_estimated_speed > cdot.tu_1_speed_limit or cdot.tu_2_estimated_speed > cdot.tu_2_speed_limit ) as "crashesOverSpeedLimit",
          count(*) filter ( where cdot.tu_1_estimated_speed > 0 or cdot.tu_2_estimated_speed > 0 ) as "crashesWithSpeedData"
      FROM vision_zero.incidents_denver doti
          join buffered_line bl on ST_Intersects(doti.priority_geo, bl.line)
          -- 200 meters. This is somewhat arbitrary but, but it should fine since the dates and times have to match.
          left join vision_zero.cdot_crashes cdot ON ST_DWithin(cdot.geo,doti.geo,200)
                                                  and doti.first_occurrence_date = cdot.vz_date
                                                  and cdot.suspected_duplicate = false
      GROUP BY date_part('year', first_occurrence_date)
      ORDER BY year
    `;

      const results = await dbClient.query(query, [
        bufferInMeters,
        fullStreetName.value,
        ...crossStreets.value,
      ]);
      return Response.json(results.rows.map(mapRow));
    }

    const entireStreetQuery = `
    with buffered_line as (
        SELECT ST_Buffer(
                ST_Union(geom)::geography,
                $1
                )::geometry AS line
        FROM public.denver_street_centerlines
        WHERE fullname = $2
    )
    SELECT
      date_part('year', first_occurrence_date)           as year,
      count(*)                                           as crashes,
      sum(
        case
          when cdot.cuid is not null then cdot.number_killed
          when fatalities > 0 then fatalities
          when upper(doti.top_traffic_accident_offense) like '%FATAL%' then 1
          else 0
          end
      )                                                  as fatalities,
      sum(
        case
          when cdot.cuid is not null then cdot.injury_03
          when seriously_injured > 0 then seriously_injured
          when upper(doti.top_traffic_accident_offense) like '%SBI%' then 1
          else 0
          end
      )                                                  as "seriousInjuries",
      sum(
        case
          when doti.bicycle_ind > 0 then doti.bicycle_ind
          when lower(cdot.tu_1_nm_type) like '%bicycle%' then 1
          when lower(cdot.tu_1_nm_type) like '%cyclist%' then 1
          when lower(cdot.tu_1_nm_type) like '%non-motorist%' then 1
          when lower(cdot.tu_1_nm_type) like '%scooter%' then 1
          when lower(cdot.tu_2_nm_type) like '%bicycle%' then 1
          when lower(cdot.tu_2_nm_type) like '%cyclist%' then 1
          when lower(cdot.tu_2_nm_type) like '%non-motorist%' then 1
          when lower(cdot.tu_2_nm_type) like '%scooter%' then 1
          else 0
          end
      )                                                  as "bicycleInvolvedCrashes",
      sum(
        case
          when doti.pedestrian_ind > 0 then doti.pedestrian_ind
          when lower(cdot.tu_1_nm_type) like '%pedestrian%' then 1
          when lower(cdot.tu_1_nm_type) like '%personal conveyance%' then 1
          when lower(cdot.tu_1_nm_type) like '%wheelchair%' then 1
          when lower(cdot.tu_2_nm_type) like '%pedestrian%' then 1
          when lower(cdot.tu_2_nm_type) like '%personal conveyance%' then 1
          when lower(cdot.tu_2_nm_type) like '%wheelchair%' then 1
          else 0
          end
      )                                                  as "pedestrianInvolvedCrashes",
      max(greatest(cdot.tu_1_estimated_speed, cdot.tu_2_estimated_speed)) as "maxSpeedMph",
      count(*) filter ( where cdot.tu_1_estimated_speed > cdot.tu_1_speed_limit or cdot.tu_2_estimated_speed > cdot.tu_2_speed_limit ) as "crashesOverSpeedLimit",
      count(*) filter ( where cdot.tu_1_estimated_speed > 0 or cdot.tu_2_estimated_speed > 0 ) as "crashesWithSpeedData"
    FROM vision_zero.incidents_denver doti
           join buffered_line bl on ST_Intersects(doti.priority_geo, bl.line)
      -- 200 meters. This is somewhat arbitrary but, but it should fine since the dates and times have to match.
           left join vision_zero.cdot_crashes cdot ON ST_DWithin(cdot.geo,doti.geo,200)
      and doti.first_occurrence_date = cdot.vz_date
      and cdot.suspected_duplicate = false
    GROUP BY date_part('year', first_occurrence_date)
    ORDER BY year
  `;

    const results = await dbClient.query(entireStreetQuery, [
      bufferInMeters,
      fullStreetName.value,
    ]);
    return Response.json(results.rows.map(mapRow));
  } catch {
    return databaseFailureResponse();
  }
}

const mapRow = (row: any) => {
  return {
    year: row.year,
    crashes: parseInt(row.crashes, 10),
    fatalities: parseInt(row.fatalities, 10),
    seriousInjuries: parseInt(row.seriousInjuries, 10),
    bicycleInvolvedCrashes: parseInt(row.bicycleInvolvedCrashes, 10),
    pedestrianInvolvedCrashes: parseInt(row.pedestrianInvolvedCrashes, 10),
    maxSpeedMph: parseFloat(row.maxSpeedMph),
    crashesOverSpeedLimit: parseInt(row.crashesOverSpeedLimit, 10),
    crashesWithSpeedData: parseInt(row.crashesWithSpeedData, 10),
  };
};
