DROP TABLE IF EXISTS vision_zero.cdot_crashes;

CREATE TABLE vision_zero.cdot_crashes
(
    cuid                             text PRIMARY KEY,

    system_code                      text,
    rd_number                        text,
    rd_section                       text,
    city_street                      text,

    crash_date                       date,
    crash_time                       time,

    agency_id                        text,
    city                             text,
    county                           text,

    latitude                         numeric(9, 6),
    longitude                        numeric(9, 6),
    geo                              geography(Point, 4326),

    location_1                       text,
    link                    text,
    location_2                       text,
    location                text,

    road_description                 text,

    first_he                         text,
    second_he                        text,
    third_he                         text,
    fourth_he                        text,
    mhe                              text,

    crash_type                       text,
    approach_overtaking_turn              text,
    wild_animal                      text,

    number_killed                    integer,
    number_injured                   integer,
    injury_00                        integer,
    injury_01                        integer,
    injury_02                        integer,
    injury_03                        integer,
    injury_04                        integer,

    total_vehicles                   integer,

    secondary_crash                  boolean,
    construction_zone                boolean,
    school_zone                      boolean,

    road_contour_curves              text,
    road_contour_grade               text,
    road_condition                   text,
    lighting_conditions               text,
    weather_condition                text,
    weather_condition_2              text,

    lane_position                    text,

    -- Traffic Unit 1
    tu_1_direction                    text,
    tu_1_movement                     text,
    tu_1_type                         text,
    tu_1_special_function             text,
    tu_1_autonomous_vehicle           text,
    tu_1_hit_and_run                  boolean,
    tu_1_speed_limit                  integer,
    tu_1_estimated_speed              integer,
    tu_1_speed                        integer,
    tu_1_driver_action                text,
    tu_1_human_contributing_factor    text,
    tu_1_age                          integer,
    tu_1_sex                          text,
    tu_1_safety_system_available      text,
    tu_1_safety_restraint_use         text,
    tu_1_safety_helmet                text,
    tu_1_alcohol_suspected            text,
    tu_1_marijuana_suspected          text,
    tu_1_other_drugs_suspected        text,

    -- Traffic Unit 2
    tu_2_direction                    text,
    tu_2_movement                     text,
    tu_2_type                         text,
    tu_2_special_function             text,
    tu_2_autonomous_vehicle           text,
    tu_2_hit_and_run                  boolean,
    tu_2_speed_limit                  integer,
    tu_2_estimated_speed              integer,
    tu_2_speed                        integer,
    tu_2_driver_action                text,
    tu_2_human_contributing_factor    text,
    tu_2_age                          integer,
    tu_2_sex                          text,
    tu_2_safety_system_available      text,
    tu_2_safety_restraint_use         text,
    tu_2_safety_helmet                text,
    tu_2_alcohol_suspected            text,
    tu_2_marijuana_suspected          text,
    tu_2_other_drugs_suspected        text,

    -- Non-Motorist Unit 1
    tu_1_nm_direction                 text,
    tu_1_nm_movement                  text,
    tu_1_nm_facility_available        text,
    tu_1_nm_location                  text,
    tu_1_nm_type                      text,
    tu_1_nm_age                       integer,
    tu_1_nm_sex                       text,
    tu_1_nm_action                    text,
    tu_1_nm_human_contributing_factor text,
    tu_1_nm_safety_helmet             text,
    tu_1_nm_alcohol_suspected         text,
    tu_1_nm_marijuana_suspected       text,
    tu_1_nm_other_drugs_suspected     text,

    -- Non-Motorist Unit 2
    tu_2_nm_direction                 text,
    tu_2_nm_movement                  text,
    tu_2_nm_facility_available        text,
    tu_2_nm_location                  text,
    tu_2_nm_type                      text,
    tu_2_nm_age                       integer,
    tu_2_nm_sex                       text,
    tu_2_nm_action                    text,
    tu_2_nm_human_contributing_factor text,
    tu_2_nm_safety_helmet             text,
    tu_2_nm_alcohol_suspected         text,
    tu_2_nm_marijuana_suspected       text,
    tu_2_nm_other_drugs_suspected     text,

    record_status                    text,
    processing_status                text,
    last_updated                     timestamptz,

    vz_created_at timestamptz NOT NULL DEFAULT now(),
    vz_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_vz_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.vz_updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cdot_crashes_updated_at
    BEFORE UPDATE ON vision_zero.cdot_crashes
    FOR EACH ROW
EXECUTE FUNCTION set_vz_updated_at();
