export type KABCO_SEVERITY_LEVEL = "K" | "A" | "B" | "C" | "O";

/** Per-crash figures computed by the backend and returned on each search result. */
export type IndividualCrashSummary = {
  maxKabcoSeverity: KABCO_SEVERITY_LEVEL;
  kabcoSeverityCounts: Record<KABCO_SEVERITY_LEVEL, number>;
  bicyclesInvolved: number;
  pedestriansInvolved: number;
  comprehensiveCost: number;
};

export const EMPTY_AREA_CRASH_SUMMARY: AreaCrashSummary = {
  bicyclesInvolved: 0,
  comprehensiveCosts: 0,
  crashes: 0,
  kabcoSeverityCounts: { K: 0, A: 0, B: 0, C: 0, O: 0 },
  maxKabcoSeverityCounts: { K: 0, A: 0, B: 0, C: 0, O: 0 },
  pedestriansInvolved: 0,
};

export type AreaCrashSummary = {
  bicyclesInvolved: number;
  comprehensiveCosts: number;
  crashes: number;
  kabcoSeverityCounts: Record<KABCO_SEVERITY_LEVEL, number>;
  maxKabcoSeverityCounts: Record<KABCO_SEVERITY_LEVEL, number>;
  pedestriansInvolved: number;
};
