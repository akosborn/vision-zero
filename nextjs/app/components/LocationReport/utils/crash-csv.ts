import { Feature, Point } from "geojson";

import { generateLocationReport, getMaxSeverity } from "./location-report";
import { getCrashSourceLinks } from "./crash-source-links";
import { Crash } from "@/app/lib/api-client";

type CsvValue = string | number | boolean | null | undefined;

/**
 * Public crash-export contract. Keep this order stable so saved exports can be
 * compared and consumed without detecting columns dynamically.
 *
 * CDOT age and sex fields, data notes, Google Maps URLs, and CDOT report-request
 * URLs are intentionally excluded from the public export contract.
 */
export const CRASH_CSV_COLUMNS = [
  "doti_incident_id",
  "cdot_cuid",
  "occurred_at",
  "address",
  "latitude",
  "longitude",
  "kabco_max_severity",
  "fatalities",
  "serious_injuries",
  "bicyclists_involved",
  "pedestrians_involved",
  "top_traffic_accident_offense",
  "neighborhood_id",
  "road_location",
  "road_description",
  "road_contour",
  "road_condition",
  "light_condition",
  "construction_zone",
  "school_zone",
  "total_vehicles",
  "unit_1_speed_limit_mph",
  "unit_1_estimated_speed_mph",
  "unit_1_recorded_speed_mph",
  "unit_2_speed_limit_mph",
  "unit_2_estimated_speed_mph",
  "unit_2_recorded_speed_mph",
  "doti_source_record_url",
] as const;

/**
 * Converts the active crash features into an RFC 4180-style CSV document.
 * Each feature becomes exactly one data row; no summary rows are added.
 */
export const crashFeaturesToCsv = (
  features: Feature<Point, Crash>[],
): string => {
  const rows = features.map(crashFeatureToCsvRow);

  return [CRASH_CSV_COLUMNS, ...rows]
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\r\n");
};

/**
 * Builds a stable, readable browser-download filename such as
 * `vision-zero-crashes-radius-search-2026-08-26.csv`.
 */
export const getCrashCsvFilename = (
  searchType: string,
  date: Date = new Date(),
): string => {
  const searchTypeSlug = searchType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `vision-zero-crashes-${searchTypeSlug || "results"}-${year}-${month}-${day}.csv`;
};

/** Starts a browser download for the supplied active crash result set. */
export const downloadCrashCsv = (
  features: Feature<Point, Crash>[],
  options: { searchTool: string; date?: Date },
): void => {
  const csv = crashFeaturesToCsv(features);
  const blobUrl = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");

  link.href = blobUrl;
  link.download = getCrashCsvFilename(options.searchTool, options.date);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
};

/**
 * Escapes a value as one CSV field. String values that could be interpreted as
 * spreadsheet formulas are prefixed with an apostrophe before CSV quoting.
 * Numeric negatives remain numeric because they are not formula payloads.
 */
export const escapeCsvField = (value: CsvValue): string => {
  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);
  if (typeof value === "string" && /^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
};

const crashFeatureToCsvRow = (feature: Feature<Point, Crash>): CsvValue[] => {
  const { properties } = feature;
  const [longitude, latitude] = feature.geometry.coordinates;
  const report = generateLocationReport([feature]);

  return [
    properties.doti_incident_id,
    properties.cdot_cuid,
    properties.doti_first_occurrence_date,
    properties.doti_address,
    finiteNumberOrEmpty(latitude),
    finiteNumberOrEmpty(longitude),
    getMaxSeverity(properties),
    report.kabcoSeverityCounts.K,
    report.kabcoSeverityCounts.A,
    report.bicyclesInvolved,
    report.pedestriansInvolved,
    properties.doti_top_traffic_accident_offense,
    properties.doti_neighborhood_id,
    properties.doti_road_location,
    properties.doti_road_description,
    properties.doti_road_contour,
    properties.doti_road_condition,
    properties.doti_light_condition,
    properties.cdot_construction_zone,
    properties.cdot_school_zone,
    properties.cdot_total_vehicles,
    properties.cdot_tu_1_speed_limit,
    properties.cdot_tu_1_estimated_speed,
    properties.cdot_tu_1_speed,
    properties.cdot_tu_2_speed_limit,
    properties.cdot_tu_2_estimated_speed,
    properties.cdot_tu_2_speed,
    getCrashSourceLinks(properties).dotiRecordUrl,
  ];
};

const finiteNumberOrEmpty = (value: number | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
