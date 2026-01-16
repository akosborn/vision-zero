import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import React from "react";
import {FeatureCollection, Point} from "geojson";
import {DatePickerInput} from "@mantine/dates";
import { Button, em, Flex, Grid, NumberInput, SegmentedControl, Select } from "@mantine/core";
import {Crash, getStreets} from "@/app/lib/api-client";
import {Street} from "@/app/api/streets/route";
import { useMediaQuery } from "@mantine/hooks";

type Props = {
  closeMobileFilters: () => void;
  dateRange: { from?: string; to?: string } | undefined;
  radiusFeet: number;
  setRadiusFeet: React.Dispatch<React.SetStateAction<number>>;
  setDateRange: React.Dispatch<
    React.SetStateAction<{ from?: string; to?: string } | undefined>
  >;
  streetName: string | null;
  setStreetName: React.Dispatch<React.SetStateAction<string | null>>;
  setAreaOfInterestIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection<Point, Crash> | null>
  >;
  incidentGeoJson: FeatureCollection<Point, Crash> | null;
  setIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection<Point, Crash> | null>
  >;
  droppedPin: { lng: number; lat: number } | null;
  setDroppedPin: React.Dispatch<
    React.SetStateAction<{ lng: number; lat: number } | null>
  >;
  selectedStreetSegment: {
    fullName?: string;
    crossStreets?: { from?: string; to?: string };
  } | null;
  setSelectedStreetSegment: React.Dispatch<
    React.SetStateAction<
      | {
          fullName?: string;
          crossStreets?: { from?: string; to?: string };
        }
      | null
    >
  >;
  onApply: () => Promise<void>;
  isLoading: boolean;
};

const FilterPanel: React.FC<Props> = ({
  closeMobileFilters,
  isLoading,
  onApply,
  dateRange,
  radiusFeet,
  setDateRange,
  streetName,
  setRadiusFeet,
  setStreetName,
  setIncidentGeoJson,
  setAreaOfInterestIncidentGeoJson,
  setDroppedPin,
  selectedStreetSegment,
  setSelectedStreetSegment,
}) => {
  const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

  const [searchTool, setSearchTool] = React.useState<"Radius Search" | "Street Search">(
    "Street Search",
  );

  const [isLoadingStreets, setIsLoadingStreets] = React.useState(true);
  const [streets, setStreets] = React.useState<Street[]>([]);

  React.useEffect(() => {
    setIsLoadingStreets(true);

    (async () => {
      const streets = await getStreets();
      setStreets(streets);
      setIsLoadingStreets(false);
    })();
  }, []);

  const crossStreetsToDisplay = React.useMemo(() => {
    if (!selectedStreetSegment?.fullName) {
      return [];
    }

    const street = streets.find(
      ({ fullName }) => fullName === selectedStreetSegment.fullName,
    );
    return street?.crossingStreets || [];
  }, [streets, selectedStreetSegment?.fullName]);

  const fromCrossStreetsToDisplay = crossStreetsToDisplay.filter(
    (crossStreet) => crossStreet !== selectedStreetSegment?.crossStreets?.to,
  );
  const toCrossStreetsToDisplay = crossStreetsToDisplay.filter(
    (crossStreet) =>
      crossStreet !== selectedStreetSegment?.crossStreets?.from,
  );

  if (isMobile) {
    return (
      <>
        <Grid gutter={"xs"}>
          <Grid.Col span={{ base: 12 }}>
            <SegmentedControl
              value={searchTool}
              onChange={(value) =>
                setSearchTool(value as "Radius Search" | "Street Search")
              }
              data={["Street Search", "Radius Search"]}
              fullWidth
              size={"sm"}
              radius={"md"}
              mb={"sm"}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 8 }}>
            <DatePickerInput
              disabled={isLoading || isLoadingStreets}
              type={"range"}
              label={"Date range"}
              className={"bg-background"}
              value={[dateRange?.from || null, dateRange?.to || null]}
              onChange={(values) => {
                setDateRange({
                  from: values[0] || undefined,
                  to: values[1] || undefined,
                });
              }}
              valueFormat={"MMM D, YYYY"}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 4 }}>
            <NumberInput
              disabled={isLoading || isLoadingStreets}
              label={`${streetName ? "Buffer" : "Radius"} (ft)`}
              placeholder={`${streetName ? "Buffer" : "Radius"} in feet`}
              value={radiusFeet}
              onChange={(value) => setRadiusFeet(value as number)}
              min={5}
              max={500}
              step={50}
            />
          </Grid.Col>

          {searchTool === "Street Search" && (
            <>
              <Grid.Col span={{ base: 12 }}>
                <Select
                  disabled={isLoading || isLoadingStreets}
                  label={"Street"}
                  placeholder={"Search for a street"}
                  searchable
                  data={streets.map(({ fullName }) => fullName)}
                  limit={20}
                  value={selectedStreetSegment?.fullName || null}
                  onChange={(value) => {
                    // @TODO: This is probably not necessary
                    setIncidentGeoJson(null);
                    setAreaOfInterestIncidentGeoJson(null);
                    setDroppedPin(null);
                    setStreetName(value);
                    setSelectedStreetSegment({ fullName: value || undefined });
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 6 }}>
                <Select
                  label={"From Cross street"}
                  disabled={
                    isLoading ||
                    isLoadingStreets ||
                    !selectedStreetSegment?.fullName
                  }
                  searchable
                  data={fromCrossStreetsToDisplay}
                  limit={20}
                  value={selectedStreetSegment?.crossStreets?.from || null}
                  required={
                    selectedStreetSegment?.crossStreets?.to !== undefined
                  }
                  onChange={(value) => {
                    // @TODO: This is probably not necessary
                    setIncidentGeoJson(null);
                    setAreaOfInterestIncidentGeoJson(null);
                    setDroppedPin(null);
                    setStreetName(value);
                    setSelectedStreetSegment((prev) => ({
                      ...prev,
                      crossStreets: { from: value || undefined },
                    }));
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 6 }}>
                <Select
                  label={"To Cross street"}
                  disabled={
                    isLoading ||
                    isLoadingStreets ||
                    !selectedStreetSegment?.fullName
                  }
                  searchable
                  data={toCrossStreetsToDisplay}
                  limit={20}
                  value={selectedStreetSegment?.crossStreets?.to || null}
                  required={
                    selectedStreetSegment?.crossStreets?.from !== undefined
                  }
                  onChange={(value) => {
                    // @TODO: This is probably not necessary
                    setIncidentGeoJson(null);
                    setAreaOfInterestIncidentGeoJson(null);
                    setDroppedPin(null);
                    setStreetName(value);
                    setSelectedStreetSegment((prev) => ({
                      ...prev,
                      crossStreets: {
                        ...prev?.crossStreets,
                        to: value || undefined,
                      },
                    }));
                  }}
                />
              </Grid.Col>
            </>
          )}
        </Grid>

        <Flex justify={"space-between"}>
          <Button variant="default" onClick={closeMobileFilters} mt={"sm"}>
            Close
          </Button>
          <Button
            disabled={isLoading || isLoadingStreets}
            variant="filled"
            onClick={onApply}
            mt={"sm"}
          >
            Apply
          </Button>
        </Flex>
      </>
    );
  }

  return (
    <Flex gap={"sm"} justify={"flex-start"} align={"flex-start"} wrap={"wrap"}>
      <SegmentedControl
        value={searchTool}
        onChange={(value) =>
          setSearchTool(value as "Radius Search" | "Street Search")
        }
        data={["Street Search", "Radius Search"]}
        fullWidth
        size={"sm"}
        radius={"md"}
        style={{ alignItems: "flex-end" }}
      />

      <DatePickerInput
        disabled={isLoading || isLoadingStreets}
        type={"range"}
        label={"Date range"}
        className={"bg-background"}
        value={[dateRange?.from || null, dateRange?.to || null]}
        onChange={(values) => {
          setDateRange({
            from: values[0] || undefined,
            to: values[1] || undefined,
          });
        }}
        valueFormat={"MMM D, YYYY"}
      />

      <NumberInput
        disabled={isLoading || isLoadingStreets}
        label={`${streetName ? "Buffer" : "Radius"} (ft)`}
        placeholder={`${streetName ? "Buffer" : "Radius"} in feet`}
        value={radiusFeet}
        onChange={(value) => setRadiusFeet(value as number)}
        min={5}
        max={500}
        step={10}
        style={{ width: 100 }}
      />

      {searchTool === "Street Search" && (
        <>
          <Select
            label={"Street"}
            placeholder={"Search for a street"}
            disabled={isLoading || isLoadingStreets}
            searchable
            data={streets.map(({ fullName }) => fullName)}
            limit={20}
            value={selectedStreetSegment?.fullName || null}
            onChange={(value) => {
              // @TODO: This is probably not necessary
              setIncidentGeoJson(null);
              setAreaOfInterestIncidentGeoJson(null);
              setDroppedPin(null);
              setStreetName(value);
              setSelectedStreetSegment({ fullName: value || undefined });
            }}
            style={{ width: 200 }}
          />

          <Select
            label={"From Cross street"}
            disabled={
              isLoading || isLoadingStreets || !selectedStreetSegment?.fullName
            }
            searchable
            data={fromCrossStreetsToDisplay}
            limit={20}
            value={selectedStreetSegment?.crossStreets?.from || null}
            required={selectedStreetSegment?.crossStreets?.to !== undefined}
            onChange={(value) => {
              // @TODO: This is probably not necessary
              setIncidentGeoJson(null);
              setAreaOfInterestIncidentGeoJson(null);
              setDroppedPin(null);
              setStreetName(value);
              setSelectedStreetSegment((prev) => ({
                ...prev,
                crossStreets: { from: value || undefined },
              }));
            }}
            style={{ width: 200 }}
          />

          <Select
            label={"To Cross street"}
            disabled={
              isLoading || isLoadingStreets || !selectedStreetSegment?.fullName
            }
            searchable
            data={toCrossStreetsToDisplay}
            limit={20}
            value={selectedStreetSegment?.crossStreets?.to || null}
            required={selectedStreetSegment?.crossStreets?.from !== undefined}
            onChange={(value) => {
              // @TODO: This is probably not necessary
              setIncidentGeoJson(null);
              setAreaOfInterestIncidentGeoJson(null);
              setDroppedPin(null);
              setStreetName(value);
              setSelectedStreetSegment((prev) => ({
                ...prev,
                crossStreets: {
                  ...prev?.crossStreets,
                  to: value || undefined,
                },
              }));
            }}
            style={{ width: 200 }}
          />
        </>
      )}

      <Button
        variant="filled"
        onClick={onApply}
        mt={"sm"}
        style={{ alignItems: "flex-end" }}
        disabled={
          isLoading || isLoadingStreets || !selectedStreetSegment?.fullName
        }
      >
        Apply
      </Button>
    </Flex>
  );
};

export default FilterPanel;
