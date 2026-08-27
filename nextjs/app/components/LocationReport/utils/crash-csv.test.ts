import { Feature, Point } from "geojson";
import { describe, expect, it } from "vitest";

import { Crash } from "@/app/lib/api-client";

import {
  CRASH_CSV_COLUMNS,
  crashFeaturesToCsv,
  escapeCsvField,
  getCrashCsvFilename,
} from "./crash-csv";
import { DOTI_FEATURE_LAYER_URL } from "./crash-source-links";

const crash = (properties: Partial<Crash>): Crash => properties as Crash;

const feature = (
  properties: Partial<Crash>,
  coordinates: [number, number] = [-104.9903, 39.7392],
  id?: string | number,
): Feature<Point, Crash> => ({
  type: "Feature",
  ...(id !== undefined ? { id } : {}),
  geometry: { type: "Point", coordinates },
  properties: crash(properties),
});

const dotiCrash = (properties: Partial<Crash> = {}): Partial<Crash> => ({
  doti_incident_id: "DOTI-123",
  doti_first_occurrence_date: "2026-08-20T13:45:00-06:00",
  doti_address: "100 W COLFAX AVE",
  doti_fatalities: 0,
  doti_serious_injuries: 0,
  doti_bicycle_count: 0,
  doti_pedestrian_count: 0,
  cdot_cuid: null,
  ...properties,
});

const cdotCrash = (properties: Partial<Crash> = {}): Partial<Crash> => ({
  ...dotiCrash(),
  cdot_cuid: "CDOT-456",
  cdot_mhe: null,
  cdot_injury_00: 0,
  cdot_injury_01: 0,
  cdot_injury_02: 0,
  cdot_injury_03: 0,
  cdot_injury_04: 0,
  cdot_tu_1_nm_type: null,
  cdot_tu_2_nm_type: null,
  ...properties,
});

const rowValues = (csv: string, row = 1): string[] =>
  csv.split("\r\n")[row].split(",");

describe("crashFeaturesToCsv", () => {
  it("uses the fixed documented columns in exact order and emits no summary row", () => {
    const csv = crashFeaturesToCsv([feature(dotiCrash())]);
    const lines = csv.split("\r\n");

    expect(CRASH_CSV_COLUMNS).toEqual([
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
    ]);
    expect(lines[0]).toBe(CRASH_CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(2);
    expect(CRASH_CSV_COLUMNS).not.toContain("cdot_tu_1_age");
    expect(CRASH_CSV_COLUMNS).not.toContain("cdot_tu_1_sex");
    expect(CRASH_CSV_COLUMNS).not.toContain("data_notes");
    expect(CRASH_CSV_COLUMNS).not.toContain("doti_google_maps_url");
    expect(CRASH_CSV_COLUMNS).not.toContain("cdot_report_request_url");
  });

  it("preserves coordinates in latitude/longitude order without treating a negative number as a formula", () => {
    const csv = crashFeaturesToCsv([
      feature(dotiCrash(), [-104.987654, 39.765432]),
    ]);
    const values = rowValues(csv);

    expect(values[CRASH_CSV_COLUMNS.indexOf("latitude")]).toBe("39.765432");
    expect(values[CRASH_CSV_COLUMNS.indexOf("longitude")]).toBe("-104.987654");
  });

  it("exports mixed DOTI and CDOT-enriched records with both identifiers and report-consistent calculations", () => {
    const csv = crashFeaturesToCsv([
      feature(
        dotiCrash({
          doti_incident_id: "DOTI-ONLY",
          doti_fatalities: 1,
          doti_bicycle_count: 2,
        }),
      ),
      feature(
        cdotCrash({
          doti_incident_id: "DOTI-MATCHED",
          cdot_cuid: "CDOT-MATCHED",
          doti_fatalities: 9,
          doti_bicycle_count: 9,
          cdot_injury_03: 2,
          cdot_tu_1_nm_type: "Pedestrian",
          cdot_total_vehicles: 2,
          cdot_tu_1_speed_limit: 30,
          cdot_tu_1_estimated_speed: 42,
        }),
      ),
    ]);
    const dotiValues = rowValues(csv, 1);
    const matchedValues = rowValues(csv, 2);

    expect(dotiValues.slice(0, 2)).toEqual(["DOTI-ONLY", ""]);
    expect(dotiValues[CRASH_CSV_COLUMNS.indexOf("kabco_max_severity")]).toBe(
      "K",
    );
    expect(dotiValues[CRASH_CSV_COLUMNS.indexOf("bicyclists_involved")]).toBe(
      "2",
    );

    expect(matchedValues.slice(0, 2)).toEqual(["DOTI-MATCHED", "CDOT-MATCHED"]);
    expect(matchedValues[CRASH_CSV_COLUMNS.indexOf("kabco_max_severity")]).toBe(
      "A",
    );
    expect(matchedValues[CRASH_CSV_COLUMNS.indexOf("fatalities")]).toBe("0");
    expect(matchedValues[CRASH_CSV_COLUMNS.indexOf("serious_injuries")]).toBe(
      "2",
    );
    expect(
      matchedValues[CRASH_CSV_COLUMNS.indexOf("pedestrians_involved")],
    ).toBe("1");
    expect(matchedValues[CRASH_CSV_COLUMNS.indexOf("total_vehicles")]).toBe(
      "2",
    );
    expect(
      matchedValues[CRASH_CSV_COLUMNS.indexOf("unit_1_estimated_speed_mph")],
    ).toBe("42");
  });

  it("leaves null and missing values empty and emits only the header for no crashes", () => {
    const csv = crashFeaturesToCsv([
      feature(
        dotiCrash({
          doti_address: undefined,
          doti_road_condition: null as unknown as string,
        }),
      ),
    ]);
    const values = rowValues(csv);

    expect(values[CRASH_CSV_COLUMNS.indexOf("address")]).toBe("");
    expect(values[CRASH_CSV_COLUMNS.indexOf("road_condition")]).toBe("");
    expect(crashFeaturesToCsv([])).toBe(CRASH_CSV_COLUMNS.join(","));
  });

  it("applies formula neutralization to exported crash strings", () => {
    const csv = crashFeaturesToCsv([
      feature(dotiCrash({ doti_address: "  =HYPERLINK(A1)" })),
    ]);

    expect(rowValues(csv)[CRASH_CSV_COLUMNS.indexOf("address")]).toBe(
      "'  =HYPERLINK(A1)",
    );
  });

  it("appends the exact authoritative DOTI object-record URL", () => {
    const csv = crashFeaturesToCsv([
      feature(dotiCrash({ doti_incident_id: "NON-UNIQUE-ID" }), undefined, 325),
    ]);

    expect(
      rowValues(csv)[CRASH_CSV_COLUMNS.indexOf("doti_source_record_url")],
    ).toBe(`${DOTI_FEATURE_LAYER_URL}/325`);
  });

  it("uses the safely encoded official incident query when an object ID is unavailable", () => {
    const csv = crashFeaturesToCsv([
      feature(dotiCrash({ doti_incident_id: " 2025'123 " })),
    ]);
    const sourceUrl = new URL(
      rowValues(csv)[CRASH_CSV_COLUMNS.indexOf("doti_source_record_url")],
    );

    expect(`${sourceUrl.origin}${sourceUrl.pathname}`).toBe(
      `${DOTI_FEATURE_LAYER_URL}/query`,
    );
    expect(sourceUrl.searchParams.get("where")).toBe(
      "incident_id = '2025''123'",
    );
    expect(sourceUrl.searchParams.get("f")).toBe("pjson");
  });

  it.each([
    [
      "a missing DOTI identifier",
      { doti_incident_id: null, cdot_cuid: "CDOT-ONLY" },
      undefined,
    ],
    [
      "an explicit missing source link",
      { doti_incident_id: "DOTI-123", sourceLinks: {} },
      325,
    ],
    [
      "an explicit unsafe source link",
      {
        doti_incident_id: "DOTI-123",
        sourceLinks: { dotiRecordUrl: "data:text/html,unsafe" },
      },
      325,
    ],
  ])("leaves the source URL empty for %s", (_description, properties, id) => {
    const csv = crashFeaturesToCsv([
      feature(dotiCrash(properties as Partial<Crash>), undefined, id),
    ]);

    expect(
      rowValues(csv)[CRASH_CSV_COLUMNS.indexOf("doti_source_record_url")],
    ).toBe("");
  });
});

describe("escapeCsvField", () => {
  it.each([
    ["ordinary", "ordinary"],
    ["value,with,commas", '"value,with,commas"'],
    ['a "quoted" value', '"a ""quoted"" value"'],
    ["two\nlines", '"two\nlines"'],
    ["two\r\nlines", '"two\r\nlines"'],
    [null, ""],
    [undefined, ""],
  ])("escapes %j as an RFC-style CSV field", (input, expected) => {
    expect(escapeCsvField(input)).toBe(expected);
  });

  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "  =HYPERLINK(A1)"])(
    "neutralizes a formula-leading string: %s",
    (input) => {
      expect(escapeCsvField(input)).toBe(`'${input}`);
    },
  );

  it("leaves negative numeric values usable as numbers", () => {
    expect(escapeCsvField(-104.99)).toBe("-104.99");
  });
});

describe("getCrashCsvFilename", () => {
  it.each([
    ["Radius Search", "radius-search"],
    ["Street Search", "street-search"],
    ["Upload Route", "upload-route"],
    ["Draw Route", "draw-route"],
  ])("includes the normalized %s type and date", (searchType, slug) => {
    expect(getCrashCsvFilename(searchType, new Date(2026, 7, 26))).toBe(
      `vision-zero-crashes-${slug}-2026-08-26.csv`,
    );
  });

  it("uses a safe fallback for an empty search type", () => {
    expect(getCrashCsvFilename("  ", new Date(2026, 0, 2))).toBe(
      "vision-zero-crashes-results-2026-01-02.csv",
    );
  });
});
