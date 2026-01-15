-- Base query to join DOTI incidents to CDOT crashes
select cdot.*,
       doti.*
from vision_zero.incidents_denver doti
    left join vision_zero.cdot_crashes cdot on
        ST_DWithin(
            cdot.geo,
            doti.geo,
            200 -- Meters. This is somewhat arbitrary but should fine since the dates and times have to match.
        )
    and doti.first_occurrence_date = (crash_date + crash_time) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver'
    and cdot.suspected_duplicate = false
order by doti.first_occurrence_date desc
;
