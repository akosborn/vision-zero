import { Incident, LocationSummary } from "@/app/components/Map";
import { Feature, FeatureCollection, Geometry } from "geojson";
import React from "react";
import CrashList from "@/app/components/LocationReport/CrashList";
import {
  Anchor,
  Container,
  Flex,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Text,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";

type Props = {
  streetName: string | null;
  droppedPin: { lng: number; lat: number } | null;
  incidentGeoJson: FeatureCollection | null;
  areaOfInterestIncidentGeoJson: FeatureCollection | null;
  locationSummary: LocationSummary | null;
  setViewport: React.Dispatch<
    React.SetStateAction<{ latitude: number; longitude: number; zoom: number }>
  >;
  zoomToLayer: (geojson: FeatureCollection) => void;
};

const LocationReport: React.FC<Props> = ({
  streetName,
  droppedPin,
  incidentGeoJson,
  areaOfInterestIncidentGeoJson,
  locationSummary,
  setViewport,
  zoomToLayer,
}) => {
  const [selectedView, setSelectedView] = React.useState<"Summary" | "Crashes">(
    "Summary",
  );

  return (
    <div>
      <SegmentedControl
        value={selectedView}
        onChange={(value) => setSelectedView(value as "Summary" | "Crashes")}
        data={["Summary", "Crashes"]}
        fullWidth
        size={"sm"}
        radius={"md"}
        mb={"sm"}
      />
      {selectedView === "Summary" && (
        <>
          {locationSummary ? (
            <SimpleGrid cols={2} spacing={"md"}>
              <Paper
                p="md"
                radius="md"
                style={{ backgroundColor: "#eff6ff", textAlign: "center" }}
              >
                <Text size="1.5rem" fw={700}>
                  {locationSummary?.totalIncidents}
                </Text>
                <Text size="xs" c="dimmed" fw={600}>
                  Crashes
                </Text>
              </Paper>

              <Paper
                p="md"
                radius="md"
                style={{ backgroundColor: "#eff6ff", textAlign: "center" }}
              >
                <Text size="1.5rem" fw={700}>
                  {usdFormatter.format(
                    locationSummary?.comprehensiveCosts || 0,
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

              {Object.entries(locationSummary?.severityCounts || {}).map(
                ([severity, count]) => {
                  if (count === 0) return null;
                  return (
                    <Paper
                      key={severity}
                      p="md"
                      radius="md"
                      style={{
                        backgroundColor: "#eff6ff",
                        textAlign: "center",
                      }}
                    >
                      <Text size="1.5rem" fw={700}>
                        {count}
                      </Text>
                      <Text size="xs" c="dimmed" fw={600}>
                        {severity}
                      </Text>
                    </Paper>
                  );
                },
              )}

              {locationSummary?.pedestriansInvolved ? (
                <Paper
                  p="md"
                  radius="md"
                  style={{ backgroundColor: "#eff6ff", textAlign: "center" }}
                >
                  <Text size="1.5rem" fw={700}>
                    {locationSummary.pedestriansInvolved}{" "}
                  </Text>
                  <Text size="xs" c="dimmed" fw={600}>
                    Pedestrians Involved
                  </Text>
                </Paper>
              ) : null}

              {locationSummary?.bicyclesInvolved ? (
                <Paper
                  p="md"
                  radius="md"
                  style={{ backgroundColor: "#eff6ff", textAlign: "center" }}
                >
                  <Text size="1.5rem" fw={700}>
                    {locationSummary.bicyclesInvolved}{" "}
                  </Text>
                  <Text size="xs" c="dimmed" fw={600}>
                    Bicyclists Involved
                  </Text>
                </Paper>
              ) : null}
            </SimpleGrid>
          ) : (
            <Text size={"sm"}>Loading report...</Text>
          )}
        </>
      )}

      {selectedView === "Crashes" && (
        <>
          {locationSummary ? (
            <Container mah={"40vh"} style={{ overflowY: "auto" }}>
              <CrashList
                incidentsFeatures={
                  (areaOfInterestIncidentGeoJson?.features ||
                    incidentGeoJson?.features ||
                    []) as Feature<Geometry, Incident>[]
                }
              />
            </Container>
          ) : (
            <Text size={"sm"}>Loading crashes...</Text>
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
