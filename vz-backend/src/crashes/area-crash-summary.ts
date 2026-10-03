export type KabcoSeverityLevel = 'K' | 'A' | 'B' | 'C' | 'O';

/**
 * The subset of `vision_zero.vw_crashes` columns the summary depends on.
 */
export type SummarizableCrash = {
  doti_incident_id: string | null;
  doti_fatalities: number | null;
  doti_serious_injuries: number | null;
  doti_bicycle_count: number | null;
  doti_pedestrian_count: number | null;
  cdot_cuid: string | null;
  cdot_mhe: string | null;
  cdot_injury_00: number | null;
  cdot_injury_01: number | null;
  cdot_injury_02: number | null;
  cdot_injury_03: number | null;
  cdot_injury_04: number | null;
  cdot_tu_1_nm_type: string | null;
  cdot_tu_2_nm_type: string | null;
};

export type AreaCrashSummary = {
  bicyclesInvolved: number;
  comprehensiveCosts: number;
  crashes: number;
  kabcoSeverityCounts: Record<KabcoSeverityLevel, number>;
  maxKabcoSeverityCounts: Record<KabcoSeverityLevel, number>;
  pedestriansInvolved: number;
};

// 2024 US Dollars
const COMPREHENSIVE_UNIT_COSTS_BY_KABCO_SEVERITY_IN_USD: Record<
  KabcoSeverityLevel,
  number
> = {
  K: 15988000,
  A: 1705100,
  B: 384000,
  C: 204600,
  O: 18100,
};

/**
 * Per-crash severity and road-user figures. Returned on each search result so
 * consumers such as the CSV export don't have to re-derive them.
 */
export type IndividualCrashSummary = {
  maxKabcoSeverity: KabcoSeverityLevel;
  kabcoSeverityCounts: Record<KabcoSeverityLevel, number>;
  bicyclesInvolved: number;
  pedestriansInvolved: number;
  comprehensiveCost: number;
};

export const summarizeCrash = (
  crash: SummarizableCrash,
): IndividualCrashSummary => {
  const maxKabcoSeverity = getMaxSeverity(crash);
  const vulnerableRoadUserCounts = getVulnerableRoadUserCounts(crash);

  return {
    maxKabcoSeverity,
    kabcoSeverityCounts: getSeverityCounts(crash),
    bicyclesInvolved: vulnerableRoadUserCounts.bicycle,
    pedestriansInvolved: vulnerableRoadUserCounts.pedestrian,
    comprehensiveCost:
      COMPREHENSIVE_UNIT_COSTS_BY_KABCO_SEVERITY_IN_USD[maxKabcoSeverity],
  };
};

export const generateAreaCrashSummary = (
  crashSummaries: IndividualCrashSummary[],
): AreaCrashSummary => {
  return crashSummaries.reduce(
    (summary, crash) => {
      summary.maxKabcoSeverityCounts[crash.maxKabcoSeverity]++;

      for (const severity in crash.kabcoSeverityCounts) {
        summary.kabcoSeverityCounts[severity as KabcoSeverityLevel] +=
          crash.kabcoSeverityCounts[severity as KabcoSeverityLevel];
      }

      summary.bicyclesInvolved += crash.bicyclesInvolved;
      summary.pedestriansInvolved += crash.pedestriansInvolved;
      summary.comprehensiveCosts += crash.comprehensiveCost;

      return summary;
    },
    {
      bicyclesInvolved: 0,
      crashes: crashSummaries.length,
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

export const getMaxSeverity = (
  crash: SummarizableCrash,
): KabcoSeverityLevel => {
  const severityCounts = getSeverityCounts(crash);

  if (severityCounts.K > 0) {
    return 'K';
  }

  if (severityCounts.A > 0) {
    return 'A';
  }

  if (severityCounts.B > 0) {
    return 'B';
  }

  if (severityCounts.C > 0) {
    return 'C';
  }

  return 'O';
};

const getSeverityCounts = (
  crash: SummarizableCrash,
): Record<KabcoSeverityLevel, number> => {
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

  throw new Error('Unknown severity');
};

type Mode = 'bicycle' | 'pedestrian';

const BIKE_INDICATORS = [
  'bicycle',
  'bicyclist',
  'cyclist',
  'non-motorist',
  'scooter',
];

const PEDESTRIAN_INDICATORS = [
  'pedestrian',
  'personal conveyance',
  'wheelchair',
];

/**
 * Assumes that crashes won't involve both bicycles and pedestrians.
 */
export const getVulnerableRoadUserCounts = (
  crash: SummarizableCrash,
): Record<Mode, number> => {
  if (crash.cdot_cuid) {
    const bikesInvolved = countCdotIndicators(crash, BIKE_INDICATORS);
    if (bikesInvolved > 0) {
      return {
        bicycle: bikesInvolved,
        pedestrian: 0,
      };
    }

    return {
      bicycle: 0,
      pedestrian: countCdotIndicators(crash, PEDESTRIAN_INDICATORS),
    };
  }

  if (crash.doti_incident_id) {
    return {
      bicycle: crash.doti_bicycle_count || 0,
      pedestrian: crash.doti_pedestrian_count || 0,
    };
  }

  throw new Error('Unknown vulnerable road user counts');
};

const countCdotIndicators = (
  crash: SummarizableCrash,
  indicators: string[],
): number => {
  const isIndicated = (value: string | null) =>
    indicators.some((indicator) => value?.toLowerCase().includes(indicator));

  const indicatedTypes = [
    crash.cdot_tu_1_nm_type,
    crash.cdot_tu_2_nm_type,
  ].filter(isIndicated);

  if (indicatedTypes.length > 0) {
    return indicatedTypes.length;
  }

  // Sometimes the `mhe` column is populated with an indicator, but the `tu_1_nm_type` and `tu_2_nm_type` columns are empty
  return isIndicated(crash.cdot_mhe) ? 1 : 0;
};

export type VulnerableRoadUserMode = 'bicycle' | 'pedestrian';

export type AnnualCrashSummary = {
  year: number;
  /** Crashes that year */
  count: number;
  /** People at each KABCO injury level */
  kabcoSeverity: Record<KabcoSeverityLevel, number>;
  /** Crashes involving each vulnerable road user mode */
  mode: Record<VulnerableRoadUserMode, number>;
  maxSpeedMph: number | null;
  crashesOverSpeedLimit: number;
  crashesWithSpeedData: number;
};

/**
 * The `vision_zero.vw_crashes` columns the annual summary depends on, on top of
 * those the per-crash summary needs.
 */
export type AnnualSummarizableCrash = SummarizableCrash & {
  doti_first_occurrence_date: string;
  cdot_tu_1_estimated_speed: number | null;
  cdot_tu_2_estimated_speed: number | null;
  cdot_tu_1_speed_limit: number | null;
  cdot_tu_2_speed_limit: number | null;
};

/**
 * Groups crashes by calendar year, using `summarizeCrash` for severity and
 * road-user figures so the history agrees with the search summary.
 */
export const generateAnnualCrashSummaries = (
  crashes: AnnualSummarizableCrash[],
): AnnualCrashSummary[] => {
  const summariesByYear = new Map<number, AnnualCrashSummary>();

  for (const crash of crashes) {
    // Local timestamp such as `2024-03-01T12:34:00`, so the year is the prefix.
    const year = Number(crash.doti_first_occurrence_date.slice(0, 4));
    const summary = summariesByYear.get(year) ?? emptyAnnualSummary(year);
    summariesByYear.set(year, summary);

    const crashSummary = summarizeCrash(crash);

    summary.count++;
    for (const severity in crashSummary.kabcoSeverityCounts) {
      summary.kabcoSeverity[severity as KabcoSeverityLevel] +=
        crashSummary.kabcoSeverityCounts[severity as KabcoSeverityLevel];
    }
    if (crashSummary.bicyclesInvolved > 0) {
      summary.mode.bicycle++;
    }
    if (crashSummary.pedestriansInvolved > 0) {
      summary.mode.pedestrian++;
    }

    const estimatedSpeeds = [
      crash.cdot_tu_1_estimated_speed,
      crash.cdot_tu_2_estimated_speed,
    ].filter((speed): speed is number => speed !== null);
    if (estimatedSpeeds.length > 0) {
      summary.maxSpeedMph = Math.max(
        summary.maxSpeedMph ?? -Infinity,
        ...estimatedSpeeds,
      );
    }
    if (
      isOverSpeedLimit(
        crash.cdot_tu_1_estimated_speed,
        crash.cdot_tu_1_speed_limit,
      ) ||
      isOverSpeedLimit(
        crash.cdot_tu_2_estimated_speed,
        crash.cdot_tu_2_speed_limit,
      )
    ) {
      summary.crashesOverSpeedLimit++;
    }
    if (estimatedSpeeds.some((speed) => speed > 0)) {
      summary.crashesWithSpeedData++;
    }
  }

  return [...summariesByYear.values()].sort((a, b) => a.year - b.year);
};

const isOverSpeedLimit = (
  estimatedSpeed: number | null,
  speedLimit: number | null,
) =>
  estimatedSpeed !== null && speedLimit !== null && estimatedSpeed > speedLimit;

const emptyAnnualSummary = (year: number): AnnualCrashSummary => ({
  year,
  count: 0,
  kabcoSeverity: { K: 0, A: 0, B: 0, C: 0, O: 0 },
  mode: { bicycle: 0, pedestrian: 0 },
  maxSpeedMph: null,
  crashesOverSpeedLimit: 0,
  crashesWithSpeedData: 0,
});
