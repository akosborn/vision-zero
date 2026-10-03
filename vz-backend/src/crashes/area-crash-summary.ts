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
