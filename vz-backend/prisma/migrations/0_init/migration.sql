-- yarn prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script

CREATE EXTENSION postgis;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "vision_zero";

-- CreateTable
CREATE TABLE "bicycle_inventory" (
    "id" SERIAL NOT NULL,
    "geom" geometry,
    "fac_num" INTEGER,
    "fac_type" VARCHAR(254),
    "status" VARCHAR(254),
    "name" VARCHAR(254),
    "alt_name" VARCHAR(254),
    "route" VARCHAR(254),
    "crossing" VARCHAR(254),
    "sign" VARCHAR(254),
    "num_sds" INTEGER,
    "trvlwys" INTEGER,
    "on_st_pk" VARCHAR(254),
    "surface" VARCHAR(254),
    "pln_yr" DATE,
    "prpsd_pln" VARCHAR(254),
    "horiz_buf" INTEGER,
    "vert_bar" VARCHAR(254),
    "width" INTEGER,
    "rum_strps" VARCHAR(254),
    "atc" VARCHAR(254),
    "on_off" VARCHAR(254),
    "len_ft" DECIMAL,
    "geomid" VARCHAR(254),

    CONSTRAINT "bicycle_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdot_crashes" (
    "cuid" TEXT NOT NULL,
    "system_code" TEXT,
    "rd_number" TEXT,
    "rd_section" TEXT,
    "city_street" TEXT,
    "crash_date" DATE,
    "crash_time" TIME(6),
    "agency_id" TEXT,
    "city" TEXT,
    "county" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "geo" geography,
    "location_1" TEXT,
    "link" TEXT,
    "location_2" TEXT,
    "location" TEXT,
    "road_description" TEXT,
    "first_he" TEXT,
    "second_he" TEXT,
    "third_he" TEXT,
    "fourth_he" TEXT,
    "mhe" TEXT,
    "crash_type" TEXT,
    "approach_overtaking_turn" TEXT,
    "wild_animal" TEXT,
    "number_killed" INTEGER,
    "number_injured" INTEGER,
    "injury_00" INTEGER,
    "injury_01" INTEGER,
    "injury_02" INTEGER,
    "injury_03" INTEGER,
    "injury_04" INTEGER,
    "total_vehicles" INTEGER,
    "secondary_crash" BOOLEAN,
    "construction_zone" BOOLEAN,
    "school_zone" BOOLEAN,
    "road_contour_curves" TEXT,
    "road_contour_grade" TEXT,
    "road_condition" TEXT,
    "lighting_conditions" TEXT,
    "weather_condition" TEXT,
    "weather_condition_2" TEXT,
    "lane_position" TEXT,
    "tu_1_direction" TEXT,
    "tu_1_movement" TEXT,
    "tu_1_type" TEXT,
    "tu_1_special_function" TEXT,
    "tu_1_autonomous_vehicle" TEXT,
    "tu_1_hit_and_run" BOOLEAN,
    "tu_1_speed_limit" INTEGER,
    "tu_1_estimated_speed" INTEGER,
    "tu_1_speed" INTEGER,
    "tu_1_driver_action" TEXT,
    "tu_1_human_contributing_factor" TEXT,
    "tu_1_age" INTEGER,
    "tu_1_sex" TEXT,
    "tu_1_safety_system_available" TEXT,
    "tu_1_safety_restraint_use" TEXT,
    "tu_1_safety_helmet" TEXT,
    "tu_1_alcohol_suspected" TEXT,
    "tu_1_marijuana_suspected" TEXT,
    "tu_1_other_drugs_suspected" TEXT,
    "tu_2_direction" TEXT,
    "tu_2_movement" TEXT,
    "tu_2_type" TEXT,
    "tu_2_special_function" TEXT,
    "tu_2_autonomous_vehicle" TEXT,
    "tu_2_hit_and_run" BOOLEAN,
    "tu_2_speed_limit" INTEGER,
    "tu_2_estimated_speed" INTEGER,
    "tu_2_speed" INTEGER,
    "tu_2_driver_action" TEXT,
    "tu_2_human_contributing_factor" TEXT,
    "tu_2_age" INTEGER,
    "tu_2_sex" TEXT,
    "tu_2_safety_system_available" TEXT,
    "tu_2_safety_restraint_use" TEXT,
    "tu_2_safety_helmet" TEXT,
    "tu_2_alcohol_suspected" TEXT,
    "tu_2_marijuana_suspected" TEXT,
    "tu_2_other_drugs_suspected" TEXT,
    "tu_1_nm_direction" TEXT,
    "tu_1_nm_movement" TEXT,
    "tu_1_nm_facility_available" TEXT,
    "tu_1_nm_location" TEXT,
    "tu_1_nm_type" TEXT,
    "tu_1_nm_age" INTEGER,
    "tu_1_nm_sex" TEXT,
    "tu_1_nm_action" TEXT,
    "tu_1_nm_human_contributing_factor" TEXT,
    "tu_1_nm_safety_helmet" TEXT,
    "tu_1_nm_alcohol_suspected" TEXT,
    "tu_1_nm_marijuana_suspected" TEXT,
    "tu_1_nm_other_drugs_suspected" TEXT,
    "tu_2_nm_direction" TEXT,
    "tu_2_nm_movement" TEXT,
    "tu_2_nm_facility_available" TEXT,
    "tu_2_nm_location" TEXT,
    "tu_2_nm_type" TEXT,
    "tu_2_nm_age" INTEGER,
    "tu_2_nm_sex" TEXT,
    "tu_2_nm_action" TEXT,
    "tu_2_nm_human_contributing_factor" TEXT,
    "tu_2_nm_safety_helmet" TEXT,
    "tu_2_nm_alcohol_suspected" TEXT,
    "tu_2_nm_marijuana_suspected" TEXT,
    "tu_2_nm_other_drugs_suspected" TEXT,
    "record_status" TEXT,
    "processing_status" TEXT,
    "last_updated" TIMESTAMPTZ(6),
    "vz_created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vz_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspected_duplicate" BOOLEAN DEFAULT false,
    "vz_date" TIMESTAMPTZ(6),

    CONSTRAINT "cdot_crashes_pkey" PRIMARY KEY ("cuid")
);

-- CreateTable
CREATE TABLE "incidents_denver" (
    "object_id" BIGINT NOT NULL,
    "incident_id" VARCHAR(20),
    "offense_id" VARCHAR(20),
    "offense_code" VARCHAR(4),
    "offense_code_extension" CHAR(1),
    "top_traffic_accident_offense" VARCHAR(200),
    "first_occurrence_date" TIMESTAMP(6),
    "last_occurrence_date" TIMESTAMP(6),
    "reported_date" TIMESTAMP(6),
    "incident_address" VARCHAR(100),
    "geo_x" INTEGER,
    "geo_y" INTEGER,
    "geo_lon" DECIMAL(11,8),
    "geo_lat" DECIMAL(10,8),
    "district_id" VARCHAR(6),
    "precinct_id" VARCHAR(3),
    "neighborhood_id" VARCHAR(50),
    "bicycle_ind" SMALLINT,
    "pedestrian_ind" SMALLINT,
    "harmful_event_seq_1" VARCHAR(100),
    "harmful_event_seq_2" VARCHAR(100),
    "harmful_event_seq_3" VARCHAR(100),
    "road_location" VARCHAR(100),
    "road_description" VARCHAR(100),
    "road_contour" VARCHAR(100),
    "road_condition" VARCHAR(100),
    "light_condition" VARCHAR(100),
    "tu1_vehicle_type" VARCHAR(100),
    "tu1_travel_direction" VARCHAR(20),
    "tu1_vehicle_movement" VARCHAR(100),
    "tu1_driver_action" VARCHAR(100),
    "tu1_driver_humancontribfactor" VARCHAR(100),
    "tu1_pedestrian_action" VARCHAR(100),
    "tu2_vehicle_type" VARCHAR(100),
    "tu2_travel_direction" VARCHAR(20),
    "tu2_vehicle_movement" VARCHAR(100),
    "tu2_driver_action" VARCHAR(100),
    "tu2_driver_humancontribfactor" VARCHAR(100),
    "tu2_pedestrian_action" VARCHAR(100),
    "seriously_injured" SMALLINT,
    "fatalities" SMALLINT,
    "fatality_mode_1" VARCHAR(100),
    "fatality_mode_2" VARCHAR(100),
    "seriously_injured_mode_1" VARCHAR(100),
    "seriously_injured_mode_2" VARCHAR(100),
    "point_x" DECIMAL(15,6),
    "point_y" DECIMAL(15,6),
    "geo" geography,
    "data_notes" VARCHAR(1000),
    "priority_geo" geography,

    CONSTRAINT "incidents_denver_pkey" PRIMARY KEY ("object_id")
);

-- CreateIndex
CREATE INDEX "idx_bicycle_inventory_geom" ON "bicycle_inventory" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "sidx_bicycle_inventory_geom" ON "bicycle_inventory" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "idx_cdot_crash_date_denver" ON "cdot_crashes"("vz_date");

-- CreateIndex
CREATE INDEX "idx_cdot_crashes_geo" ON "cdot_crashes" USING GIST ("geo");

-- CreateIndex
CREATE INDEX "idx_first_occurrence_date_denver" ON "incidents_denver"("first_occurrence_date");

-- CreateIndex
CREATE INDEX "idx_incidents_denver_geo" ON "incidents_denver" USING GIST ("geo");

-- CreateIndex
CREATE INDEX "idx_traffic_incidents_incident_id" ON "incidents_denver"("incident_id");

-- CreateIndex
CREATE INDEX "idx_traffic_incidents_location" ON "incidents_denver"("geo_lat", "geo_lon");

-- CreateIndex
CREATE INDEX "idx_traffic_incidents_neighborhood" ON "incidents_denver"("neighborhood_id");

-- CreateIndex
CREATE INDEX "idx_traffic_incidents_reported_date" ON "incidents_denver"("reported_date");

-- CreateIndex
CREATE INDEX "incidents_denver_priority_geo_idx" ON "incidents_denver" USING GIST ("priority_geo");
