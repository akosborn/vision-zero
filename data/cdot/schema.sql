CREATE TABLE cdot_crashes
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
    link_distance                    text,
    location_2                       text,
    location_relation                text,

    road_description                 text,

    first_he                         text,
    second_he                        text,
    third_he                         text,
    fourth_he                        text,
    mhe                              text,

    crash_type                       text,
    approach_overtaking              text,
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
    lighting_condition               text,
    weather_condition                text,
    weather_condition_2              text,

    lane_position                    text,

    -- Traffic Unit 1
    tu1_direction                    text,
    tu1_movement                     text,
    tu1_type                         text,
    tu1_special_function             text,
    tu1_autonomous_vehicle           text,
    tu1_hit_and_run                  boolean,
    tu1_speed_limit                  integer,
    tu1_estimated_speed              integer,
    tu1_speed                        integer,
    tu1_driver_action                text,
    tu1_human_contributing_factor    text,
    tu1_age                          integer,
    tu1_sex                          text,
    tu1_safety_system_available      text,
    tu1_safety_restraint_use         text,
    tu1_safety_helmet                text,
    tu1_alcohol_suspected            text,
    tu1_marijuana_suspected          text,
    tu1_other_drugs_suspected        text,

    -- Traffic Unit 2
    tu2_direction                    text,
    tu2_movement                     text,
    tu2_type                         text,
    tu2_special_function             text,
    tu2_autonomous_vehicle           text,
    tu2_hit_and_run                  boolean,
    tu2_speed_limit                  integer,
    tu2_estimated_speed              integer,
    tu2_speed                        integer,
    tu2_driver_action                text,
    tu2_human_contributing_factor    text,
    tu2_age                          integer,
    tu2_sex                          text,
    tu2_safety_system_available      text,
    tu2_safety_restraint_use         text,
    tu2_safety_helmet                text,
    tu2_alcohol_suspected            text,
    tu2_marijuana_suspected          text,
    tu2_other_drugs_suspected        text,

    -- Non-Motorist Unit 1
    tu1_nm_direction                 text,
    tu1_nm_movement                  text,
    tu1_nm_facility_available        text,
    tu1_nm_location                  text,
    tu1_nm_type                      text,
    tu1_nm_age                       integer,
    tu1_nm_sex                       text,
    tu1_nm_action                    text,
    tu1_nm_human_contributing_factor text,
    tu1_nm_safety_helmet             text,
    tu1_nm_alcohol_suspected         text,
    tu1_nm_marijuana_suspected       text,
    tu1_nm_other_drugs_suspected     text,

    -- Non-Motorist Unit 2
    tu2_nm_direction                 text,
    tu2_nm_movement                  text,
    tu2_nm_facility_available        text,
    tu2_nm_location                  text,
    tu2_nm_type                      text,
    tu2_nm_age                       integer,
    tu2_nm_sex                       text,
    tu2_nm_action                    text,
    tu2_nm_human_contributing_factor text,
    tu2_nm_safety_helmet             text,
    tu2_nm_alcohol_suspected         text,
    tu2_nm_marijuana_suspected       text,
    tu2_nm_other_drugs_suspected     text,

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
    BEFORE UPDATE ON cdot_crashes
    FOR EACH ROW
EXECUTE FUNCTION set_vz_updated_at();
