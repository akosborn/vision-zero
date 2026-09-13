CREATE INDEX idx_cdot_timestamp_denver ON vision_zero.cdot_crashes
(((crash_date + crash_time) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver'));

with buffered_line as (SELECT ST_Buffer(
                                      ST_Union(geom)::geography,
                                      ${bufferInMeters}
                              )::geometry AS line
                       FROM (select *
                             from get_street_segments_between(${fullStreetName}, ${crossStreet1},
                                                              ${crossStreet2})) inputs)
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
         left join vision_zero.cdot_crashes cdot ON
    ST_DWithin(
            cdot.geo,
            doti.geo,
            200 -- Meters. This is somewhat arbitrary but should fine since the dates and times have to match.
    )
        and doti.first_occurrence_date AT TIME ZONE 'America/Denver' = cdot.vz_date
        and cdot.suspected_duplicate = false
         join buffered_line bl on st_dwithin(COALESCE(cdot.geo, doti.geo)::geography, bl.line::geography, 0)
GROUP BY date_part('year', first_occurrence_date)
ORDER BY year desc
;
