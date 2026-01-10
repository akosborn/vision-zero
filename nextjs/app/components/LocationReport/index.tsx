import { Separator } from "@/components/ui/separator";
import { Incident, LocationSummary } from "@/app/components/Map";
import { LocateFixedIcon } from "lucide-react";
import { STREET_NAMES_OPTIONS } from "@/app/components/FilterPanel";
import { Feature, FeatureCollection, Geometry } from "geojson";
import React from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import CrashList from "@/app/components/LocationReport/CrashList";
import { Anchor, Flex, NumberInput, Text } from "@mantine/core";

type Props = {
  streetName: string | null;
  droppedPin: { lng: number; lat: number } | null;
  incidentGeoJson: FeatureCollection | null;
  areaOfInterestIncidentGeoJson: FeatureCollection | null;
  radiusFeet: number;
  setRadiusFeet: React.Dispatch<React.SetStateAction<number>>;
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
  radiusFeet,
  setRadiusFeet,
  locationSummary,
  setViewport,
  zoomToLayer,
}) => {
  const [showIncidentDetails, setShowIncidentDetails] = React.useState(false);

  return (
    <div>
      <Flex
        direction={"row"}
        align={"center"}
        gap={"xl"}
        justify={"space-between"}
        className={"flex flex-row items-center gap-4 justify-between mb-2"}
      >
        <div>
          <Text
            size={"md"}
            fw={700}
            className={"font-semibold uppercase text-xs md:text-sm"}
          >
            {streetName ? "Area of Interest" : "Pinned Location"} Report
          </Text>
        </div>
        <Anchor
          underline={"never"}
          component={"button"}
          onClick={() => setShowIncidentDetails(!showIncidentDetails)}
        >
          {showIncidentDetails ? "Show Summary" : "List Crashes"}
        </Anchor>
      </Flex>
      <Flex align={"center"} gap={"sm"}>
        <LocateFixedIcon
          size={18}
          cursor={"pointer"}
          onClick={() => {
            if (droppedPin) {
              if (incidentGeoJson?.features.length) {
                zoomToLayer(incidentGeoJson);
              } else {
                setViewport({
                  zoom: 17,
                  longitude: droppedPin.lng,
                  latitude: droppedPin.lat,
                });
              }
            }
          }}
        />

        <div style={{ overflow: "hidden" }}>
          <Text size={"sm"}>
            {streetName && (
              <>
                {
                  STREET_NAMES_OPTIONS.find(
                    (option) => option.id === streetName,
                  )?.label
                }
              </>
            )}
            {droppedPin?.lng && droppedPin?.lat && (
              <>
                {droppedPin.lng.toFixed(4)}, {droppedPin.lat.toFixed(4)}
              </>
            )}
          </Text>
        </div>
      </Flex>

      {showIncidentDetails ? (
        <>
          {locationSummary ? (
            <CrashList
              incidentsFeatures={
                (areaOfInterestIncidentGeoJson?.features ||
                  incidentGeoJson?.features ||
                  []) as Feature<Geometry, Incident>[]
              }
            />
          ) : (
            <Text size={"sm"}>Loading crashes...</Text>
          )}
        </>
      ) : (
        <>
          <Separator className={"my-3 md:my-4"} />

          {locationSummary ? (
            <div className="grid grid-cols-2 gap-x-4">
              <div className="mb-2 col-span-1">
                <span
                  className={
                    "text-[10px] md:text-sm uppercase tracking-tight text-muted-foreground"
                  }
                >
                  Total Crashes
                </span>
                <h4 className={"font-bold text-lg md:text-xl"}>
                  {locationSummary.totalIncidents}
                </h4>
              </div>

              <div className="mb-2 col-span-1">
                <div className="flex items-center gap-1">
                  <span
                    className={
                      "text-[10px] md:text-sm uppercase tracking-tight text-muted-foreground"
                    }
                  >
                    Comprehensive Cost
                  </span>
                  <a
                    href="https://highways.dot.gov/sites/fhwa.dot.gov/files/2025-10/CrashCostFactSheet_508_OCT2025.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-500 transition-colors"
                    title="Comprehensive crash cost estimates based on KABCO Crash Costs in 2024 dollars"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  </a>
                </div>
                <h4 className={"font-bold text-lg md:text-xl"}>
                  {usdFormatter.format(locationSummary.comprehensiveCosts)}
                </h4>
              </div>

              <Separator className="col-span-2 hidden md:block my-2" />

              {Object.entries(locationSummary.severityCounts).map(
                ([severity, count]) => {
                  if (count === 0) return null;
                  return (
                    <div key={severity} className="mb-2">
                      <span
                        className={
                          "text-[10px] md:text-sm uppercase tracking-tight text-muted-foreground"
                        }
                      >
                        {severity}
                      </span>
                      <h4 className={"font-bold text-lg md:text-xl"}>
                        {count}
                      </h4>
                    </div>
                  );
                },
              )}

              {!!(
                locationSummary.bicyclesInvolved ||
                locationSummary.pedestriansInvolved
              ) && <Separator className="col-span-2 hidden md:block my-2" />}

              {locationSummary.bicyclesInvolved ? (
                <div>
                  <span
                    className={
                      "text-[10px] md:text-sm uppercase tracking-tight text-muted-foreground"
                    }
                  >
                    Bicyclists Involved
                  </span>
                  <h4 className={"font-bold text-lg md:text-xl"}>
                    {locationSummary.bicyclesInvolved}
                  </h4>
                </div>
              ) : null}

              {locationSummary.pedestriansInvolved ? (
                <div>
                  <span
                    className={
                      "text-[10px] md:text-sm uppercase tracking-tight text-muted-foreground"
                    }
                  >
                    Pedestrians Involved
                  </span>
                  <h4 className={"font-bold text-lg md:text-xl"}>
                    {locationSummary.pedestriansInvolved}
                  </h4>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-sm italic">Loading report...</div>
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
});

export default LocationReport;
