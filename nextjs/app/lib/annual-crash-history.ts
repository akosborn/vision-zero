import type { AnnualCrashSummary } from "@/app/lib/api-client";

export const buildAnnualCrashHistoryQuery = ({
  searchAreaCte = "",
  spatialClause,
}: {
  searchAreaCte?: string;
  spatialClause: string;
}) => `
  ${searchAreaCte}
  SELECT
    date_part('year', doti.first_occurrence_date) AS year,
    count(*) AS crashes,
    sum(
      CASE
        WHEN cdot.cuid IS NOT NULL THEN cdot.number_killed
        WHEN doti.fatalities > 0 THEN doti.fatalities
        WHEN upper(doti.top_traffic_accident_offense) LIKE '%FATAL%' THEN 1
        ELSE 0
      END
    ) AS fatalities,
    sum(
      CASE
        WHEN cdot.cuid IS NOT NULL THEN cdot.injury_03
        WHEN doti.seriously_injured > 0 THEN doti.seriously_injured
        WHEN upper(doti.top_traffic_accident_offense) LIKE '%SBI%' THEN 1
        ELSE 0
      END
    ) AS "seriousInjuries",
    sum(
      CASE
        WHEN doti.bicycle_ind > 0 THEN doti.bicycle_ind
        WHEN lower(cdot.tu_1_nm_type) LIKE '%bicycle%' THEN 1
        WHEN lower(cdot.tu_1_nm_type) LIKE '%cyclist%' THEN 1
        WHEN lower(cdot.tu_1_nm_type) LIKE '%non-motorist%' THEN 1
        WHEN lower(cdot.tu_1_nm_type) LIKE '%scooter%' THEN 1
        WHEN lower(cdot.tu_2_nm_type) LIKE '%bicycle%' THEN 1
        WHEN lower(cdot.tu_2_nm_type) LIKE '%cyclist%' THEN 1
        WHEN lower(cdot.tu_2_nm_type) LIKE '%non-motorist%' THEN 1
        WHEN lower(cdot.tu_2_nm_type) LIKE '%scooter%' THEN 1
        ELSE 0
      END
    ) AS "bicycleInvolvedCrashes",
    sum(
      CASE
        WHEN doti.pedestrian_ind > 0 THEN doti.pedestrian_ind
        WHEN lower(cdot.tu_1_nm_type) LIKE '%pedestrian%' THEN 1
        WHEN lower(cdot.tu_1_nm_type) LIKE '%personal conveyance%' THEN 1
        WHEN lower(cdot.tu_1_nm_type) LIKE '%wheelchair%' THEN 1
        WHEN lower(cdot.tu_2_nm_type) LIKE '%pedestrian%' THEN 1
        WHEN lower(cdot.tu_2_nm_type) LIKE '%personal conveyance%' THEN 1
        WHEN lower(cdot.tu_2_nm_type) LIKE '%wheelchair%' THEN 1
        ELSE 0
      END
    ) AS "pedestrianInvolvedCrashes",
    max(greatest(cdot.tu_1_estimated_speed, cdot.tu_2_estimated_speed)) AS "maxSpeedMph",
    count(*) FILTER (
      WHERE cdot.tu_1_estimated_speed > cdot.tu_1_speed_limit
         OR cdot.tu_2_estimated_speed > cdot.tu_2_speed_limit
    ) AS "crashesOverSpeedLimit",
    count(*) FILTER (
      WHERE cdot.tu_1_estimated_speed > 0
         OR cdot.tu_2_estimated_speed > 0
    ) AS "crashesWithSpeedData"
  FROM vision_zero.incidents_denver doti
  LEFT JOIN vision_zero.cdot_crashes cdot ON
    ST_DWithin(cdot.geo, doti.geo, 200)
    AND doti.first_occurrence_date =
      (cdot.crash_date + cdot.crash_time) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver'
    AND cdot.suspected_duplicate = false
  ${spatialClause}
  GROUP BY date_part('year', doti.first_occurrence_date)
  ORDER BY year
`;

type AnnualCrashSummaryRow = Record<string, unknown>;

const parseInteger = (value: unknown) =>
  Number.parseInt(String(value ?? 0), 10);

export const mapAnnualCrashSummaryRows = (
  rows: AnnualCrashSummaryRow[],
): AnnualCrashSummary[] =>
  rows.map((row) => ({
    year: parseInteger(row.year),
    crashes: parseInteger(row.crashes),
    fatalities: parseInteger(row.fatalities),
    seriousInjuries: parseInteger(row.seriousInjuries),
    bicycleInvolvedCrashes: parseInteger(row.bicycleInvolvedCrashes),
    pedestrianInvolvedCrashes: parseInteger(row.pedestrianInvolvedCrashes),
    maxSpeedMph:
      row.maxSpeedMph === null || row.maxSpeedMph === undefined
        ? null
        : Number.parseFloat(String(row.maxSpeedMph)),
    crashesOverSpeedLimit: parseInteger(row.crashesOverSpeedLimit),
    crashesWithSpeedData: parseInteger(row.crashesWithSpeedData),
  }));
