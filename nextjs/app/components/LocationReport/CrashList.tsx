import React from "react";
import { Feature, Geometry, Point } from "geojson";
import { DateTime } from "luxon";
import { Container, Select, SimpleGrid, Text } from "@mantine/core";
import {
  CrashDetails,
  SEVERITY_LABELS,
} from "@/app/components/LocationReport/CrashDetails";
import { Crash } from "@/app/lib/api-client";
import {
  getMaxSeverity,
  getVulnerableRoadUserCounts,
  KABCO_SEVERITY_LEVEL,
} from "@/app/components/LocationReport/utils/location-report";
import { getCrashSourceLinks } from "@/app/components/LocationReport/utils/crash-source-links";

type Props = {
  crashFeatures: Feature<Point, Crash>[];
  filters: CrashListFilters;
  onFiltersChange: (filters: CrashListFilters) => void;
  selectedCrashFeature: Feature<Point, Crash> | null;
  onCrashSelect: (feature: Feature<Point, Crash>) => void;
};

export type SeverityFilter = KABCO_SEVERITY_LEVEL | "all";
export type RoadUserFilter = "all" | "pedestrian" | "bicycle";

export type CrashListFilters = {
  severity: SeverityFilter;
  roadUser: RoadUserFilter;
};

export const DEFAULT_CRASH_LIST_FILTERS: CrashListFilters = {
  severity: "all",
  roadUser: "all",
};

const severityFilterOptions = [
  { value: "all", label: "All severities" },
  ...Object.entries(SEVERITY_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const roadUserFilterOptions = [
  { value: "all", label: "All crashes" },
  { value: "pedestrian", label: "Pedestrian crashes" },
  { value: "bicycle", label: "Bicyclist crashes" },
];

const CrashList: React.FC<Props> = ({
  crashFeatures,
  filters,
  onFiltersChange,
  selectedCrashFeature,
  onCrashSelect,
}) => {
  const sortedFeatures = React.useMemo(
    () => getVisibleCrashFeatures(crashFeatures, filters),
    [crashFeatures, filters],
  );

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" mb="sm">
        <Select
          label="Crash severity"
          data={severityFilterOptions}
          value={filters.severity}
          allowDeselect={false}
          onChange={(value) =>
            onFiltersChange({
              ...filters,
              severity: (value as SeverityFilter | null) ?? "all",
            })
          }
        />
        <Select
          label="Road user"
          data={roadUserFilterOptions}
          value={filters.roadUser}
          allowDeselect={false}
          onChange={(value) =>
            onFiltersChange({
              ...filters,
              roadUser: (value as RoadUserFilter | null) ?? "all",
            })
          }
        />
      </SimpleGrid>

      <Container mah="40vh" style={{ overflowY: "auto" }} px={0}>
        {sortedFeatures.length === 0 && (
          <Text c="dimmed" ta="center" py="md">
            No crashes match the selected filters.
          </Text>
        )}

        {sortedFeatures.map((feature) => {
          const { geometry, properties } = feature;
          const type = getType(properties);
          const severity = getMaxSeverity(properties);

          const [lng, lat] = geometry.coordinates;
          const sourceLinks = getCrashSourceLinks(properties);
          const rowKey = getCrashFeatureKey(feature);
          const isSelected = selectedCrashFeature
            ? getCrashFeatureKey(selectedCrashFeature) === rowKey
            : false;

          return (
            <Container key={rowKey} px={0} mb="sm">
              <CrashDetails
                dotiIncidentId={properties.doti_incident_id}
                cdotCuid={properties.cdot_cuid}
                sourceLinks={sourceLinks}
                type={type}
                kabcoSeverityLevel={severity}
                area={properties.doti_address || ""}
                date={DateTime.fromISO(properties.doti_first_occurrence_date, {
                  zone: "America/Denver",
                }).toJSDate()}
                coordinates={{ lat, lng }}
                // @ts-ignore
                demographics={[
                  properties.cdot_tu_1_age && properties.cdot_tu_1_sex
                    ? {
                        age: properties.cdot_tu_1_age,
                        sex: properties.cdot_tu_1_sex,
                      }
                    : null,
                  properties.cdot_tu_2_age && properties.cdot_tu_2_sex
                    ? {
                        age: properties.cdot_tu_2_age,
                        sex: properties.cdot_tu_2_sex,
                      }
                    : null,
                ].filter((d) => d)}
                onClick={() => onCrashSelect(feature)}
                isSelected={isSelected}
              />
            </Container>
          );
        })}
      </Container>
    </>
  );
};

export const getCrashFeatureKey = (
  feature: Feature<Point, Crash>,
): string | number => {
  const [lng, lat] = feature.geometry.coordinates;

  return (
    feature.id ??
    feature.properties.doti_incident_id ??
    feature.properties.cdot_cuid ??
    `${lng},${lat},${feature.properties.doti_first_occurrence_date}`
  );
};

export const getVisibleCrashFeatures = <G extends Geometry>(
  crashFeatures: Feature<G, Crash>[],
  filters: CrashListFilters,
): Feature<G, Crash>[] =>
  crashFeatures
    .filter(({ properties }) => {
      if (
        filters.severity !== "all" &&
        getMaxSeverity(properties) !== filters.severity
      ) {
        return false;
      }

      return (
        filters.roadUser === "all" ||
        isRoadUserInvolved(properties, filters.roadUser)
      );
    })
    .toSorted((a, b) => {
      return (
        DateTime.fromISO(b.properties.doti_first_occurrence_date).toMillis() -
        DateTime.fromISO(a.properties.doti_first_occurrence_date).toMillis()
      );
    });

const isRoadUserInvolved = (
  crash: Crash,
  roadUser: Exclude<RoadUserFilter, "all">,
) => {
  const counts = getVulnerableRoadUserCounts(crash);

  if (counts[roadUser] > 0) {
    return true;
  }

  if (crash.cdot_cuid) {
    return false;
  }

  return roadUser === "bicycle"
    ? crash.doti_bicycle_involved
    : crash.doti_pedestrian_involved;
};

const getType = (crash: Crash) => {
  if (isRoadUserInvolved(crash, "bicycle")) {
    return "Bicycle";
  }

  if (isRoadUserInvolved(crash, "pedestrian")) {
    return "Pedestrian";
  }

  return "Vehicle";
};

export default CrashList;
