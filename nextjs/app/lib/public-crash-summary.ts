import type { Feature, Point } from "geojson";

import { generateLocationReport } from "@/app/components/LocationReport/utils/location-report";
import type { Crash } from "@/app/lib/api-client";

export const CRASH_SUMMARY_SCHEMA_VERSION = 1 as const;

export type PublicCrashSummary = {
  crashes: number;
  crashesByHighestSeverity: {
    fatal: number;
    incapacitatingInjury: number;
    nonIncapacitatingInjury: number;
    complaintOfInjury: number;
    noInjuryPropertyDamage: number;
  };
  peopleByInjurySeverity: {
    fatalities: number;
    incapacitatingInjuries: number;
    nonIncapacitatingInjuries: number;
    complaintsOfInjury: number;
    noInjuryPropertyDamage: number;
  };
  roadUsersInvolved: {
    bicyclists: number;
    pedestrians: number;
  };
  estimatedComprehensiveCostUsd: number;
};

export const buildPublicCrashSummary = (
  features: Feature<Point, Crash>[],
): PublicCrashSummary => {
  const report = generateLocationReport(features);

  return {
    crashes: report.crashes,
    crashesByHighestSeverity: {
      fatal: report.maxKabcoSeverityCounts.K,
      incapacitatingInjury: report.maxKabcoSeverityCounts.A,
      nonIncapacitatingInjury: report.maxKabcoSeverityCounts.B,
      complaintOfInjury: report.maxKabcoSeverityCounts.C,
      noInjuryPropertyDamage: report.maxKabcoSeverityCounts.O,
    },
    peopleByInjurySeverity: {
      fatalities: report.kabcoSeverityCounts.K,
      incapacitatingInjuries: report.kabcoSeverityCounts.A,
      nonIncapacitatingInjuries: report.kabcoSeverityCounts.B,
      complaintsOfInjury: report.kabcoSeverityCounts.C,
      noInjuryPropertyDamage: report.kabcoSeverityCounts.O,
    },
    roadUsersInvolved: {
      bicyclists: report.bicyclesInvolved,
      pedestrians: report.pedestriansInvolved,
    },
    estimatedComprehensiveCostUsd: report.comprehensiveCosts,
  };
};
