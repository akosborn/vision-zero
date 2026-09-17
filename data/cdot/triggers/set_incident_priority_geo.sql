CREATE OR REPLACE FUNCTION vision_zero.set_incident_priority_geo()
    RETURNS trigger
    LANGUAGE plpgsql
AS $$
DECLARE
    v_cdot_geo geometry;
BEGIN
    SELECT cdot.geo
    INTO v_cdot_geo
    FROM vision_zero.cdot_crashes cdot
    WHERE ST_DWithin(cdot.geo, NEW.geo, 200)
      AND cdot.vz_date = NEW.first_occurrence_date
    LIMIT 1;

    NEW.priority_geo := COALESCE(v_cdot_geo, NEW.geo);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_incident_priority_geo ON vision_zero.incidents_denver;

CREATE TRIGGER trg_set_incident_priority_geo
    BEFORE INSERT OR UPDATE OF geo, first_occurrence_date ON vision_zero.incidents_denver
    FOR EACH ROW
EXECUTE FUNCTION vision_zero.set_incident_priority_geo();
