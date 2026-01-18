ALTER TABLE vision_zero.incidents_denver
ADD COLUMN priority_geo geography(Point, 4326);

CREATE INDEX incidents_denver_priority_geo_idx ON vision_zero.incidents_denver USING GIST (priority_geo);

-- Trigger to set default for new rows
CREATE OR REPLACE FUNCTION vision_zero.set_default_priority_geo()
    RETURNS trigger AS $$
BEGIN
    IF NEW.priority_geo IS NULL THEN
        NEW.priority_geo = NEW.geo;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_priority_geo
    BEFORE INSERT ON vision_zero.incidents_denver
    FOR EACH ROW
EXECUTE FUNCTION vision_zero.set_default_priority_geo();

with matches as (
 select doti.incident_id, coalesce(cdot.geo, doti.geo) as priority_geo
 from vision_zero.incidents_denver doti
    left join vision_zero.cdot_crashes cdot ON ST_DWithin(cdot.geo,doti.geo,200)
                                           and doti.first_occurrence_date = cdot.vz_date
)
update vision_zero.incidents_denver doti
set priority_geo = matches.priority_geo
from matches
where doti.incident_id = matches.incident_id;
