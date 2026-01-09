import { Incident } from "@/app/components/Map";
import { FeatureCollection, Point } from "geojson";
import axios from "axios";

const API_PATH_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api`;

export const getStreetCenterlines = async (streetName: string) => {
  const response = await axios.get<FeatureCollection>(
    `${API_PATH_BASE}/street-centerlines`,
    { params: { streetName } },
  );
  return response.data;
};

export const getBufferedStreetCenterlines = async (params: {
  streetName: string;
  bufferInFeet: number;
}) => {
  const response = await axios.get<FeatureCollection>(
    `${API_PATH_BASE}/buffered-street-centerlines`,
    { params },
  );
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
  const response = await axios.get<FeatureCollection<Point, Incident>>(
    `${API_PATH_BASE}/incidents`,
    { params },
  );
  return response.data;
};

export const getIncidentsWithinBufferedStreet = async (params: {
  streetName: string;
  bufferInFeet: number;
  startDate?: string;
  endDate?: string;
}) => {
  const response = await axios.get<FeatureCollection<Point, Incident>>(
    `${API_PATH_BASE}/incidents/buffered-street`,
    { params },
  );
  return response.data;
};
