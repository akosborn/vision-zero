ALTER TABLE vision_zero.cdot_crashes
ADD COLUMN vz_date TIMESTAMP;

UPDATE vision_zero.cdot_crashes
SET vz_date = (crash_date + crash_time) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver';

CREATE INDEX idx_cdot_crash_date_denver ON vision_zero.cdot_crashes (vz_date);
