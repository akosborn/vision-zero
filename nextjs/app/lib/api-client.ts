import { FeatureCollection, GeoJsonProperties, Geometry, Point } from "geojson";
import axios from "axios";
import { Street } from "@/app/api/streets/route";

const API_PATH_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api`;

export const getStreetCenterlines = async (params: {
  fullName?: string;
  crossStreets?: { from?: string; to?: string };
}) => {
  const response = await axios.get<FeatureCollection>(
    `${API_PATH_BASE}/street-centerlines`,
    {
      params: {
        fullStreetName: params.fullName,
        crossStreet1: params.crossStreets?.from,
        crossStreet2: params.crossStreets?.to,
      },
    },
  );
  return response.data;
};

export const getBufferedStreetCenterlines = async (params: {
  fullName: string;
  crossStreets?: { from?: string; to?: string };
  bufferInFeet: number;
}) => {
  const response = await axios.get<FeatureCollection>(
    `${API_PATH_BASE}/buffered-street-centerlines`,
    {
      params: {
        fullStreetName: params.fullName,
        crossStreet1: params.crossStreets?.from,
        crossStreet2: params.crossStreets?.to,
        bufferInFeet: params.bufferInFeet,
      },
    },
  );
  return response.data;
};

export const getStreets = async () => {
  const response = await axios.get<Street[]>(`${API_PATH_BASE}/streets`);
  return response.data;
};

/**
 * Incidents
 */

export const getIncidents = async (params: {
  startDate?: string;
  endDate?: string;
  bbox?: string;
  lat?: number;
  lng?: number;
  radiusInFeet?: number;
}) => {
  const response = await axios.get<FeatureCollection<Point, Crash>>(
    `${API_PATH_BASE}/incidents`,
    { params },
  );
  return response.data;
};

export const getIncidentsWithinBufferedStreet = async (params: {
  fullStreetName: string;
  crossStreets?: { from?: string; to?: string };
  bufferInFeet: number;
  startDate?: string;
  endDate?: string;
}) => {
  const response = await axios.get<FeatureCollection<Point, Crash>>(
    `${API_PATH_BASE}/incidents/buffered-street`,
    {
      params: {
        fullStreetName: params.fullStreetName,
        crossStreet1: params.crossStreets?.from,
        crossStreet2: params.crossStreets?.to,
        bufferInFeet: params.bufferInFeet,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    },
  );
  return response.data;
};

export const getIncidentsWithinBufferedRoute = async (params: {
  route: FeatureCollection<Geometry | null, GeoJsonProperties>;
  bufferInFeet: number;
  startDate?: string;
  endDate?: string;
}) => {
  const response = await axios.post<FeatureCollection<Point, Crash>>(
    `${API_PATH_BASE}/incidents/buffered-route`,
    {
      route: params.route,
      bufferInFeet: params.bufferInFeet,
      startDate: params.startDate,
      endDate: params.endDate,
    },
  );
  return response.data;
};

/**
 * Annual Summary
 */

export const getAnnualCrashHistory = async (params: {
  fullStreetName: string;
  crossStreets?: { from?: string; to?: string };
  bufferInFeet: number;
}) => {
  const response = await axios.get<AnnualCrashSummary[]>(
    `${API_PATH_BASE}/incidents/buffered-street/history`,
    {
      params: {
        fullStreetName: params.fullStreetName,
        crossStreet1: params.crossStreets?.from,
        crossStreet2: params.crossStreets?.to,
        bufferInFeet: params.bufferInFeet,
      },
    },
  );
  return response.data;
};

export interface CrashSourceLinks {
  dotiRecordUrl?: string;
  cdotReportRequestUrl?: string;
}

export interface Crash {
  // DOTI (Denver) Data
  doti_incident_id: string | null;
  doti_first_occurrence_date: string;
  doti_address: string;
  doti_google_maps_url: string | null;
  doti_neighborhood_id: string;
  doti_top_traffic_accident_offense: string;
  doti_serious_injuries: number;
  doti_fatalities: number;
  doti_bicycle_involved: boolean;
  doti_pedestrian_involved: boolean;
  doti_bicycle_count: number;
  doti_pedestrian_count: number;
  doti_tu1_vehicle_movement: string;
  doti_tu1_driver_action: string;
  doti_tu1_driver_humancontribfactor: string;
  doti_tu1_pedestrian_action: string;
  doti_tu1_vehicle_type: string;
  doti_tu1_travel_direction: string;
  doti_harmful_event_seq_1: string;
  doti_harmful_event_seq_2: string;
  doti_harmful_event_seq_3: string;
  doti_road_location: string;
  doti_road_description: string;
  doti_road_contour: string;
  doti_road_condition: string;
  doti_light_condition: string;
  doti_tu2_vehicle_type: string;
  doti_tu2_travel_direction: string;
  doti_tu2_vehicle_movement: string;
  doti_tu2_driver_action: string;
  doti_tu2_driver_humancontribfactor: string;
  doti_tu2_pedestrian_action: string;
  doti_fatality_mode_1: string;
  doti_fatality_mode_2: string;
  doti_seriously_injured_mode_1: string;
  doti_seriously_injured_mode_2: string;
  data_notes: string | null;
  sourceLinks?: CrashSourceLinks;

  // CDOT (State) Data
  cdot_cuid: string | null;
  cdot_mhe: string | null;
  cdot_number_killed: number | null;
  cdot_number_injured: number | null;
  cdot_injury_00: number | null;
  cdot_injury_01: number | null;
  cdot_injury_02: number | null;
  cdot_injury_03: number | null;
  cdot_injury_04: number | null;
  cdot_total_vehicles: number | null;
  cdot_construction_zone: string | null;
  cdot_school_zone: string | null;
  cdot_tu_1_speed_limit: number | null;
  cdot_tu_1_estimated_speed: number | null;
  cdot_tu_1_speed: number | null;
  cdot_tu_2_speed_limit: number | null;
  cdot_tu_2_estimated_speed: number | null;
  cdot_tu_2_speed: number | null;
  cdot_tu_1_nm_facility_available: string | null;
  cdot_tu_1_nm_safety_helmet: string | null;
  cdot_tu_1_nm_location: string | null;
  cdot_tu_1_nm_type: string | null;
  cdot_tu_1_age: number | null;
  cdot_tu_1_sex: string | null;
  cdot_tu_2_nm_facility_available: string | null;
  cdot_tu_2_nm_safety_helmet: string | null;
  cdot_tu_2_nm_location: string | null;
  cdot_tu_2_nm_type: string | null;
  cdot_tu_2_age: number | null;
  cdot_tu_2_sex: string | null;
}

export interface AnnualCrashSummary {
  year: number;
  crashes: number;
  fatalities: number;
  seriousInjuries: number;
  bicycleInvolvedCrashes: number;
  pedestrianInvolvedCrashes: number;
  maxSpeedMph: number | null;
  crashesOverSpeedLimit: number;
  crashesWithSpeedData: number;
}
