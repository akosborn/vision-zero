import { Feature, Point } from "geojson";
import { Crash } from "@/app/lib/api-client";

export type KABCO_SEVERITY_LEVEL = "K" | "A" | "B" | "C" | "O";

export const COLOR_BY_SEVERITY: Record<KABCO_SEVERITY_LEVEL, string> = {
  K: "#00703c",
  A: "#ff9900",
  B: "#f0e68c",
  C: "#ff3333",
  O: "#999999",
};

// 2024 US Dollars
const COMPREHENSIVE_UNIT_COSTS_BY_KABCO_SEVERITY_IN_USD: Record<
  KABCO_SEVERITY_LEVEL,
  number
> = {
  K: 15988000,
  A: 1705100,
  B: 384000,
  C: 204600,
  O: 18100,
};

export const generateLocationReport = (
  features: Feature<Point, Crash>[],
): LocationSummary => {
  return features.reduce(
    (summary, f) => {
      const maxKabcoSeverity = getMaxSeverity(f.properties);
      const kabcoSeverityCounts = getSeverityCounts(f.properties);

      summary.maxKabcoSeverityCounts[maxKabcoSeverity]++;

      for (const severity in kabcoSeverityCounts) {
        summary.kabcoSeverityCounts[severity as KABCO_SEVERITY_LEVEL] += kabcoSeverityCounts[severity as KABCO_SEVERITY_LEVEL];
      }

      const vulnerableRoadUserCounts = getVulnerableRoadUserCounts(f.properties);
      summary.bicyclesInvolved += vulnerableRoadUserCounts.bicycle;
      summary.pedestriansInvolved += vulnerableRoadUserCounts.pedestrian;

      summary.comprehensiveCosts +=
        COMPREHENSIVE_UNIT_COSTS_BY_KABCO_SEVERITY_IN_USD[maxKabcoSeverity];

      return summary;
    },
    {
      bicyclesInvolved: 0,
      crashes: features.length,
      comprehensiveCosts: 0,
      kabcoSeverityCounts: {
        K: 0,
        A: 0,
        B: 0,
        C: 0,
        O: 0,
      },
      maxKabcoSeverityCounts: {
        K: 0,
        A: 0,
        B: 0,
        C: 0,
        O: 0,
      },
      pedestriansInvolved: 0,
    },
  );
};

export const getMaxSeverity = (crash: Crash): KABCO_SEVERITY_LEVEL => {
  const severityCounts = getSeverityCounts(crash);

  if (severityCounts.K > 0) {
    return "K";
  }

  if (severityCounts.A > 0) {
    return "A";
  }

  if (severityCounts.B > 0) {
    return "B";
  }

  if (severityCounts.C > 0) {
    return "C";
  }

  return "O";
};

const getSeverityCounts = (
  crash: Crash,
): Record<KABCO_SEVERITY_LEVEL, number> => {
  if (crash.cdot_cuid) {
    return {
      K: crash.cdot_injury_04 || 0,
      A: crash.cdot_injury_03 || 0,
      B: crash.cdot_injury_02 || 0,
      C: crash.cdot_injury_01 || 0,
      O: crash.cdot_injury_00 || 0,
    };
  }

  if (crash.doti_incident_id) {
    const fatalities = crash.doti_fatalities || 0;
    const seriousInjuries = crash.doti_serious_injuries || 0;

    return {
      K: fatalities,
      A: seriousInjuries,
      B: 0,
      C: 0,
      // 1 is a bit of a guess, but the guess is on the conservative end. There could have been multiple uninjured parties involved.
      // Perhaps I could look to see if TU_2 is not null and put 2 here in that case.
      O: fatalities + seriousInjuries === 0 ? 1 : 0,
    };
  }

  throw new Error("Unknown severity");
};

type Mode = 'bicycle' | 'pedestrian';

/**
 * Assumes that crashes won't involve both bicycles and pedestrians.
 * @param crash
 */
const getVulnerableRoadUserCounts = (
  crash: Crash,
): Record<Mode, number> => {
  if (crash.cdot_cuid) {
    const BIKE_INDICATORS = ["bicycle", "bicyclist", "cyclist", "non-motorist", "scooter"];
    const bikeIndicatedTypes = [crash.cdot_tu_1_nm_type, crash.cdot_tu_2_nm_type].filter((value) =>
        BIKE_INDICATORS.some((indicator) =>
          value?.toLowerCase().includes(indicator)));

    let bikesInvolved = 0;

    if (bikeIndicatedTypes.length === 0) {
      // Sometimes the `mhe` column is populated with an indicator, but the `tu_1_nm_type` and `tu_2_nm_type` columns are empty
      const isBikeIndicated = BIKE_INDICATORS.some((indicator) => crash.cdot_mhe?.toLowerCase().includes(indicator))
      if (isBikeIndicated) {
        bikesInvolved = 1;
      }
    }
    if (bikeIndicatedTypes.length > 0) {
      return {
        bicycle: bikesInvolved,
        pedestrian: 0,
      };
    }

    const PEDESTRIAN_INDICATORS = ["pedestrian", "personal conveyance", "wheelchair"];
    const pedestrianIndicatedTypes = [
      crash.cdot_tu_1_nm_type,
      crash.cdot_tu_2_nm_type,
    ].filter((value) =>
      BIKE_INDICATORS.some((indicator) =>
        value?.toLowerCase().includes(indicator),
      ),
    );

    let pedestriansInvolved = 0;

    if (pedestrianIndicatedTypes.length === 0) {
      // Sometimes the `mhe` column is populated with an indicator, but the `tu_1_nm_type` and `tu_2_nm_type` columns are empty
      const isPedestrianIndicated = PEDESTRIAN_INDICATORS.some((indicator) =>
        crash.cdot_mhe?.toLowerCase().includes(indicator),
      );
      if (isPedestrianIndicated) {
        pedestriansInvolved = 1;
      }
    }
    return {
      bicycle: 0,
      pedestrian: pedestriansInvolved,
    };
  }

  if (crash.doti_incident_id) {
    return {
      bicycle: crash.doti_bicycle_count || 0,
      pedestrian: crash.doti_pedestrian_count || 0,
    };
  }

  throw new Error("Unknown vulnerable road user counts");
};

export type LocationSummary = {
  bicyclesInvolved: number;
  comprehensiveCosts: number;
  crashes: number;
  kabcoSeverityCounts: Record<KABCO_SEVERITY_LEVEL, number>;
  maxKabcoSeverityCounts: Record<KABCO_SEVERITY_LEVEL, number>;
  pedestriansInvolved: number;
};
