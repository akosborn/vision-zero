ALTER TABLE vision_zero.cdot_crashes ALTER COLUMN vz_date TYPE TIMESTAMPTZ;

UPDATE vision_zero.cdot_crashes
SET vz_date = (crash_date + crash_time) AT TIME ZONE 'America/Denver';
