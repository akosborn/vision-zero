import { Feature, Point } from "geojson";
import { describe, expect, it } from "vitest";

import { Crash } from "@/app/lib/api-client";

import { generateLocationReport, getMaxSeverity } from "./location-report";

const crash = (properties: Partial<Crash>): Crash => properties as Crash;

const cdotCrash = (properties: Partial<Crash> = {}): Crash =>
  crash({
    doti_incident_id: "",
    cdot_cuid: "cdot-crash",
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

const dotiCrash = (properties: Partial<Crash> = {}): Crash =>
  crash({
    doti_incident_id: "doti-crash",
    cdot_cuid: null,
    doti_fatalities: 0,
    doti_serious_injuries: 0,
    doti_bicycle_count: 0,
    doti_pedestrian_count: 0,
    ...properties,
  });

const feature = (properties: Crash): Feature<Point, Crash> => ({
  type: "Feature",
  geometry: {
    type: "Point",
    coordinates: [-104.9903, 39.7392],
  },
  properties,
});

describe("getMaxSeverity", () => {
  it.each([
    ["K", { cdot_injury_04: 1, cdot_injury_03: 2 }],
    ["A", { cdot_injury_03: 1, cdot_injury_02: 2 }],
    ["B", { cdot_injury_02: 1, cdot_injury_01: 2 }],
    ["C", { cdot_injury_01: 1, cdot_injury_00: 2 }],
    ["O", { cdot_injury_00: 2 }],
  ] as const)(
    "selects the highest present CDOT severity, %s",
    (expected, counts) => {
      expect(getMaxSeverity(cdotCrash(counts))).toBe(expected);
    },
  );

  it.each([
    ["K", { doti_fatalities: 1, doti_serious_injuries: 2 }],
    ["A", { doti_serious_injuries: 1 }],
    ["O", {}],
  ] as const)("maps DOTI injury data to severity %s", (expected, counts) => {
    expect(getMaxSeverity(dotiCrash(counts))).toBe(expected);
  });

  it("uses CDOT data when a matched record contains both source identifiers", () => {
    expect(
      getMaxSeverity(
        cdotCrash({
          doti_incident_id: "matched-doti-crash",
          doti_fatalities: 3,
          cdot_injury_02: 1,
        }),
      ),
    ).toBe("B");
  });
});

describe("generateLocationReport severity counts and costs", () => {
  it("aggregates CDOT person counts at every KABCO severity", () => {
    const report = generateLocationReport([
      feature(
        cdotCrash({
          cdot_injury_04: 2,
          cdot_injury_03: 3,
          cdot_injury_02: 4,
          cdot_injury_01: 5,
          cdot_injury_00: 6,
        }),
      ),
    ]);

    expect(report.kabcoSeverityCounts).toEqual({
      K: 2,
      A: 3,
      B: 4,
      C: 5,
      O: 6,
    });
    expect(report.maxKabcoSeverityCounts).toEqual({
      K: 1,
      A: 0,
      B: 0,
      C: 0,
      O: 0,
    });
  });

  it("maps DOTI fatalities and serious injuries and uses the existing uninjured fallback", () => {
    const report = generateLocationReport([
      feature(dotiCrash({ doti_fatalities: 2, doti_serious_injuries: 3 })),
      feature(dotiCrash({ doti_incident_id: "uninjured-doti-crash" })),
    ]);

    expect(report.kabcoSeverityCounts).toEqual({
      K: 2,
      A: 3,
      B: 0,
      C: 0,
      O: 1,
    });
    expect(report.maxKabcoSeverityCounts).toEqual({
      K: 1,
      A: 0,
      B: 0,
      C: 0,
      O: 1,
    });
  });

  it("charges one comprehensive unit cost for each crash's maximum severity", () => {
    const report = generateLocationReport([
      feature(cdotCrash({ cdot_cuid: "K", cdot_injury_04: 2 })),
      feature(cdotCrash({ cdot_cuid: "A", cdot_injury_03: 1 })),
      feature(cdotCrash({ cdot_cuid: "B", cdot_injury_02: 1 })),
      feature(cdotCrash({ cdot_cuid: "C", cdot_injury_01: 1 })),
      feature(cdotCrash({ cdot_cuid: "O", cdot_injury_00: 1 })),
    ]);

    expect(report.crashes).toBe(5);
    expect(report.comprehensiveCosts).toBe(18_299_800);
  });

  it("treats missing CDOT injury counts as zero while classifying the crash as O", () => {
    const report = generateLocationReport([
      feature(
        cdotCrash({
          cdot_injury_00: null,
          cdot_injury_01: null,
          cdot_injury_02: null,
          cdot_injury_03: null,
          cdot_injury_04: null,
        }),
      ),
    ]);

    expect(report.kabcoSeverityCounts).toEqual({
      K: 0,
      A: 0,
      B: 0,
      C: 0,
      O: 0,
    });
    expect(report.maxKabcoSeverityCounts.O).toBe(1);
    expect(report.comprehensiveCosts).toBe(18_100);
  });
});

describe("generateLocationReport vulnerable road-user counts", () => {
  it("uses DOTI bicycle and pedestrian counts", () => {
    const report = generateLocationReport([
      feature(dotiCrash({ doti_bicycle_count: 2, doti_pedestrian_count: 3 })),
    ]);

    expect(report.bicyclesInvolved).toBe(2);
    expect(report.pedestriansInvolved).toBe(3);
  });

  it.each(["bicycle", "bicyclist", "cyclist", "non-motorist", "scooter"])(
    "counts a recognized CDOT bicycle type: %s",
    (type) => {
      const report = generateLocationReport([
        feature(cdotCrash({ cdot_tu_1_nm_type: type })),
      ]);

      expect(report.bicyclesInvolved).toBe(1);
      expect(report.pedestriansInvolved).toBe(0);
    },
  );

  it("counts bicycle types independently for both CDOT traffic units", () => {
    const report = generateLocationReport([
      feature(
        cdotCrash({
          cdot_tu_1_nm_type: "Bicycle",
          cdot_tu_2_nm_type: "electric SCOOTER",
        }),
      ),
    ]);

    expect(report.bicyclesInvolved).toBe(2);
    expect(report.pedestriansInvolved).toBe(0);
  });

  it.each(["pedestrian", "personal conveyance", "wheelchair"])(
    "counts a recognized CDOT pedestrian type: %s",
    (type) => {
      const report = generateLocationReport([
        feature(cdotCrash({ cdot_tu_1_nm_type: type })),
      ]);

      expect(report.bicyclesInvolved).toBe(0);
      expect(report.pedestriansInvolved).toBe(1);
    },
  );

  it("counts pedestrian types independently for both CDOT traffic units", () => {
    const report = generateLocationReport([
      feature(
        cdotCrash({
          cdot_tu_1_nm_type: "Pedestrian",
          cdot_tu_2_nm_type: "Wheelchair user",
        }),
      ),
    ]);

    expect(report.bicyclesInvolved).toBe(0);
    expect(report.pedestriansInvolved).toBe(2);
  });

  it.each([
    ["bicycle", "collision with a bicyclist", 1, 0],
    ["pedestrian", "collision with a pedestrian", 0, 1],
  ] as const)(
    "uses the CDOT MHE fallback for %s involvement when traffic-unit types are missing",
    (_mode, mhe, bicycles, pedestrians) => {
      const report = generateLocationReport([
        feature(cdotCrash({ cdot_mhe: mhe })),
      ]);

      expect(report.bicyclesInvolved).toBe(bicycles);
      expect(report.pedestriansInvolved).toBe(pedestrians);
    },
  );

  it("keeps bicycle precedence for an unexpected CDOT record containing both modes", () => {
    const report = generateLocationReport([
      feature(
        cdotCrash({
          cdot_tu_1_nm_type: "bicycle",
          cdot_tu_2_nm_type: "pedestrian",
        }),
      ),
    ]);

    expect(report.bicyclesInvolved).toBe(1);
    expect(report.pedestriansInvolved).toBe(0);
  });

  it("uses CDOT involvement data for a matched record with both source identifiers", () => {
    const report = generateLocationReport([
      feature(
        cdotCrash({
          doti_incident_id: "matched-doti-crash",
          doti_bicycle_count: 7,
          doti_pedestrian_count: 8,
          cdot_tu_1_nm_type: "pedestrian",
        }),
      ),
    ]);

    expect(report.bicyclesInvolved).toBe(0);
    expect(report.pedestriansInvolved).toBe(1);
  });

  it("returns zero involvement when CDOT mode fields are missing", () => {
    const report = generateLocationReport([feature(cdotCrash())]);

    expect(report.bicyclesInvolved).toBe(0);
    expect(report.pedestriansInvolved).toBe(0);
  });

  it("rejects a record without either source identifier", () => {
    expect(() => generateLocationReport([feature(crash({}))])).toThrow(
      "Unknown severity",
    );
  });
});
