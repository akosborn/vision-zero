import { Feature, FeatureCollection, Geometry, Point } from "geojson";
import React from "react";
import CrashList from "@/app/components/LocationReport/CrashList";
import {
  Anchor,
  Container,
  Flex, Loader,
  Paper,
  SegmentedControl,
  SimpleGrid, Table,
  Text, useMantineTheme,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  generateLocationReport,
  KABCO_SEVERITY_LEVEL,
} from "@/app/components/LocationReport/utils/location-report";
import { AnnualCrashSummary, Crash } from "@/app/lib/api-client";
import { SEVERITY_LABELS } from "@/app/components/LocationReport/CrashDetails";
import BarChart from "@/app/components/LocationReport/History/CrashBarChart";

type Props = {
  streetName: string | null;
  isLoading: boolean;
  droppedPin: { lng: number; lat: number } | null;
  incidentGeoJson: FeatureCollection<Point, Crash> | null;
  areaOfInterestIncidentGeoJson: FeatureCollection<Point, Crash> | null;
  setViewport: React.Dispatch<
    React.SetStateAction<{ latitude: number; longitude: number; zoom: number }>
  >;
  zoomToLayer: (geojson: FeatureCollection) => void;
  crashSummaryHistory: AnnualCrashSummary[] | null;
};

type View = "Summary" | "Crashes" | "History";

const LocationReport: React.FC<Props> = ({
  streetName,
  crashSummaryHistory,
  droppedPin,
  incidentGeoJson,
  isLoading,
  areaOfInterestIncidentGeoJson,
  setViewport,
  zoomToLayer,
}) => {
  const [selectedView, setSelectedView] = React.useState<View>("Summary");

  const theme = useMantineTheme();

  const locationReport = React.useMemo(() => {
    const features = areaOfInterestIncidentGeoJson?.features || incidentGeoJson?.features || [];
    return generateLocationReport(features);
  }, [incidentGeoJson, areaOfInterestIncidentGeoJson]);

  return (
    <div>
      <SegmentedControl
        value={selectedView}
        onChange={(value) => setSelectedView(value as View)}
        data={["Summary", "Crashes", "History"]}
        fullWidth
        size={"sm"}
        radius={"md"}
        mb={"sm"}
      />
      {selectedView === "Summary" && (
        <>
          {!isLoading ? (
            <>
              <SimpleGrid cols={2} spacing={"xs"} mb={"xs"}>
                <Paper
                  p="xs"
                  radius="md"
                  style={{ backgroundColor: "#eff6ff", textAlign: "center" }}
                >
                  <Text size="1.5rem" fw={700}>
                    {locationReport?.crashes}
                  </Text>
                  <Text size="xs" c="dimmed" fw={600}>
                    Crashes
                  </Text>
                </Paper>

                <Paper
                  p="xs"
                  radius="md"
                  style={{ backgroundColor: "#eff6ff", textAlign: "center" }}
                >
                  <Text size="1.5rem" fw={700}>
                    {usdFormatter.format(
                      locationReport?.comprehensiveCosts || 0,
                    )}
                  </Text>
                  <Flex justify={"center"} gap={"2px"}>
                    <Text size="xs" c="dimmed" fw={600}>
                      Cost
                    </Text>
                    <div>
                      <Anchor
                        href="https://highways.dot.gov/sites/fhwa.dot.gov/files/2025-10/CrashCostFactSheet_508_OCT2025.pdf"
                        target="_blank"
                        title="Comprehensive crash cost estimates based on KABCO Crash Costs in 2024 dollars"
                      >
                        <IconInfoCircle
                          size={17}
                          color={"#868e96"}
                          cursor={"pointer"}
                        />
                      </Anchor>
                    </div>
                  </Flex>
                </Paper>
              </SimpleGrid>

              <Table variant="vertical" layout="auto" withTableBorder mb={"xs"}>
                <Table.Tbody>
                  {Object.entries(
                    locationReport?.kabcoSeverityCounts || {},
                  ).map(([severity, count]) => {
                    return (
                      <Table.Tr key={severity}>
                        <Table.Th>
                          {SEVERITY_LABELS[severity as KABCO_SEVERITY_LEVEL]}
                        </Table.Th>
                        <Table.Td>{count}</Table.Td>
                      </Table.Tr>
                    );
                  })}

                  <Table.Tr
                    style={{ borderTop: `solid ${theme.colors.gray[3]} 4px` }}
                  >
                    <Table.Th>Pedestrians</Table.Th>
                    <Table.Td>{locationReport.pedestriansInvolved}</Table.Td>
                  </Table.Tr>

                  <Table.Tr>
                    <Table.Th>Bicyclists</Table.Th>
                    <Table.Td>{locationReport.bicyclesInvolved}</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </>
          ) : (
            <Loader />
          )}
        </>
      )}

      {selectedView === "Crashes" && (
        <>
          {!isLoading ? (
            <Container mah={"40vh"} style={{ overflowY: "auto" }} px={0}>
              <CrashList
                crashFeatures={
                  (areaOfInterestIncidentGeoJson?.features ||
                    incidentGeoJson?.features ||
                    []) as Feature<Geometry, Crash>[]
                }
              />
            </Container>
          ) : (
            <Loader />
          )}
        </>
      )}

      {selectedView === "History" && (
        <>
          {!isLoading ? (
            <>
              {crashSummaryHistory && crashSummaryHistory.length > 0 && (
                <Container w={'100%'} h={'100%'} px={0}>
                  <BarChart summaries={crashSummaryHistory} />
                </Container>
              )}
            </>
          ) : (
            <Loader />
          )}
        </>
      )}
    </div>
  );
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  notation: "compact",
});

export default LocationReport;
