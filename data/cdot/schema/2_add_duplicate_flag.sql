ALTER TABLE vision_zero.cdot_crashes
ADD COLUMN suspected_duplicate boolean DEFAULT false;

BEGIN;

-- Find the duplicates
with duplicates as (
    with potential_duplicates as (
        SELECT array_agg(distinct cuid) as cdot_crashes
        FROM vision_zero.cdot_crashes
        group by crash_date, crash_time, system_code, location_1, location_2
        having count(*) > 1
        order by min(crash_date)
    )
    select cuid,
           rank() over (
               partition by crash_date, crash_time, system_code, location_1, location_2
               order by last_updated desc
               ) as rank
    from vision_zero.cdot_crashes cdot
         join potential_duplicates pd on cdot.cuid = any(pd.cdot_crashes)
    order by crash_date, crash_time, system_code, location_1, location_2, rank
)
update vision_zero.cdot_crashes cdot
set suspected_duplicate = true
from duplicates d
where d.rank > 1 and cdot.cuid = d.cuid
;

;

-- ROLLBACK;
-- COMMIT;
