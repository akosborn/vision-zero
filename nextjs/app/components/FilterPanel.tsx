import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import React, { Suspense } from "react";
import {FeatureCollection, Point} from "geojson";
import {DatePickerInput} from "@mantine/dates";
import { Alert, Button, em, Flex, Grid, NumberInput, SegmentedControl, Select } from "@mantine/core";
import {Crash, getStreets} from "@/app/lib/api-client";
import {Street} from "@/app/api/streets/route";
import { useMediaQuery } from "@mantine/hooks";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  useRouter,
  useSearchParams,
} from "next/dist/client/components/navigation";

type Props = {
  closeMobileFilters: () => void;
  dateRange: { from?: string; to?: string } | undefined;
  radiusFeet: number;
  setRadiusFeet: React.Dispatch<React.SetStateAction<number>>;
  setDateRange: React.Dispatch<
    React.SetStateAction<{ from?: string; to?: string } | undefined>
  >;
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
  streets: Street[];
  setSearchTool: React.Dispatch<React.SetStateAction<'Radius Search' | 'Street Search'>>;
  searchTool: 'Radius Search' | 'Street Search';
};

const FilterPanel: React.FC<Props> = ({
  closeMobileFilters,
  isLoading,
  onApply,
  dateRange,
  radiusFeet,
  setDateRange,
  setRadiusFeet,
  setIncidentGeoJson,
  setAreaOfInterestIncidentGeoJson,
  setDroppedPin,
  selectedStreetSegment,
  setSelectedStreetSegment,
  streets,
  setSearchTool,
  searchTool,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isMobile = useMediaQuery(`(max-width: ${em(750)})`);
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

  // Must have zero cross streets selected or both cross streets selected
  const isFormValid =
    searchTool === 'Street Search' ? selectedStreetSegment?.fullName && (selectedStreetSegment.crossStreets?.from ? !!selectedStreetSegment.crossStreets.to : true) && (selectedStreetSegment.crossStreets?.to ? !!selectedStreetSegment.crossStreets.from : true) : true;

  if (isMobile) {
    return (
      <Suspense>
        <Grid gutter={"xs"}>
          <Grid.Col span={{ base: 12 }}>
            <SegmentedControl
              disabled={isLoading}
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

          {searchTool === "Radius Search" && (
            <Grid.Col span={{ base: 12 }}>
              <Alert
                variant={"light"}
                icon={<IconInfoCircle />}
                color={"cyan"}
                p={"xs"}
                my={"0"}
              >
                To get started, click anywhere on the map to inspect a circular
                area.
              </Alert>
            </Grid.Col>
          )}

          <Grid.Col span={{ base: 8 }}>
            <DatePickerInput
              disabled={isLoading}
              type={"range"}
              label={"Date range"}
              className={"bg-background"}
              value={[dateRange?.from || null, dateRange?.to || null]}
              onChange={(values) => {
                setDateRange({
                  from: values[0] || undefined,
                  to: values[1] || undefined,
                });

                const params = new URLSearchParams(searchParams.toString());
                params.set("fromDate", values[0]?.toString() || "");
                params.set("toDate", values[1]?.toString() || "");
                router.replace(`?${params.toString()}`, { scroll: false });
              }}
              valueFormat={"MMM D, YYYY"}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 4 }}>
            <NumberInput
              disabled={isLoading}
              label={`${searchTool === "Street Search" ? "Buffer" : "Radius"} (ft)`}
              placeholder={`${searchTool === "Street Search" ? "Buffer" : "Radius"} in feet`}
              value={radiusFeet}
              onChange={(value) => {
                setRadiusFeet(value as number);

                const params = new URLSearchParams(searchParams.toString());
                params.set("r", value?.toString() || "");
                router.replace(`?${params.toString()}`, { scroll: false });
              }}
              min={5}
              max={500}
              step={50}
            />
          </Grid.Col>

          {searchTool === "Street Search" && (
            <>
              <Grid.Col span={{ base: 12 }}>
                <Select
                  disabled={isLoading}
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
                    setSelectedStreetSegment({ fullName: value || undefined });

                    const params = new URLSearchParams(
                      searchParams.toString(),
                    );
                    params.set('street', value || '');
                    params.delete('crossStreet1');
                    params.delete('crossStreet2');
                    router.replace(`?${params.toString()}`);
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 6 }}>
                <Select
                  label={"From Cross street"}
                  disabled={isLoading || !selectedStreetSegment?.fullName}
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
                    setSelectedStreetSegment((prev) => ({
                      ...prev,
                      crossStreets: { from: value || undefined },
                    }));

                    const params = new URLSearchParams(searchParams.toString());
                    params.set("crossStreet1", value || "");
                    router.replace(`?${params.toString()}`, { scroll: false });
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 6 }}>
                <Select
                  label={"To Cross street"}
                  disabled={isLoading || !selectedStreetSegment?.fullName}
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
                    setSelectedStreetSegment((prev) => ({
                      ...prev,
                      crossStreets: {
                        ...prev?.crossStreets,
                        to: value || undefined,
                      },
                    }));

                    const params = new URLSearchParams(searchParams.toString());
                    params.set("crossStreet2", value || "");
                    router.replace(`?${params.toString()}`, { scroll: false });
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
            disabled={isLoading || !isFormValid}
            variant="filled"
            onClick={onApply}
            mt={"sm"}
          >
            Apply
          </Button>
        </Flex>
      </Suspense>
    );
  }

  return (
    <>
      {searchTool === "Radius Search" && (
        <Alert
          variant={"light"}
          icon={<IconInfoCircle />}
          color={"cyan"}
          p={"xs"}
          mb={"xs"}
        >
          To get started, click anywhere on the map to inspect a circular area.
        </Alert>
      )}

      <Flex gap={"sm"} justify={"flex-start"} align={"flex-end"} wrap={"wrap"}>
        <SegmentedControl
          disabled={isLoading}
          value={searchTool}
          onChange={(value) => {
            setSearchTool(value as "Radius Search" | "Street Search");

            const params = new URLSearchParams(searchParams.toString());
            params.set("tool", value?.toString() || "");
            router.replace(`?${params.toString()}`, { scroll: false });
          }}
          data={["Street Search", "Radius Search"]}
          fullWidth
          size={"sm"}
          radius={"md"}
        />

        <DatePickerInput
          disabled={isLoading}
          type={"range"}
          label={"Date range"}
          className={"bg-background"}
          value={[dateRange?.from || null, dateRange?.to || null]}
          onChange={(values) => {
            setDateRange({
              from: values[0] || undefined,
              to: values[1] || undefined,
            });

            const params = new URLSearchParams(searchParams.toString());
            params.set("fromDate", values[0]?.toString() || "");
            params.set("toDate", values[1]?.toString() || "");
            router.replace(`?${params.toString()}`, { scroll: false });
          }}
          valueFormat={"MMM D, YYYY"}
        />

        <NumberInput
          disabled={isLoading}
          label={`${searchTool === "Street Search" ? "Buffer" : "Radius"} (ft)`}
          placeholder={`${searchTool === "Street Search" ? "Buffer" : "Radius"} in feet`}
          value={radiusFeet}
          onChange={(value) => {
            setRadiusFeet(value as number);

            const params = new URLSearchParams(searchParams.toString());
            params.set("r", value?.toString() || "");
            router.replace(`?${params.toString()}`, { scroll: false });
          }}
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
              disabled={isLoading}
              searchable
              data={streets.map(({ fullName }) => fullName)}
              limit={20}
              value={selectedStreetSegment?.fullName || null}
              onChange={(value) => {
                // @TODO: This is probably not necessary
                setIncidentGeoJson(null);
                setAreaOfInterestIncidentGeoJson(null);
                setDroppedPin(null);
                setSelectedStreetSegment({ fullName: value || undefined });

                const params = new URLSearchParams(searchParams.toString());
                params.set("street", value || "");
                params.delete("crossStreet1");
                params.delete("crossStreet2");
                router.replace(`?${params.toString()}`);
              }}
              style={{ width: 200 }}
            />

            <Select
              label={"From Cross street"}
              disabled={isLoading || !selectedStreetSegment?.fullName}
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
                setSelectedStreetSegment((prev) => ({
                  ...prev,
                  crossStreets: { from: value || undefined },
                }));

                const params = new URLSearchParams(searchParams.toString());
                params.set("crossStreet1", value || "");
                router.replace(`?${params.toString()}`, { scroll: false });
              }}
              style={{ width: 200 }}
            />

            <Select
              label={"To Cross street"}
              disabled={isLoading || !selectedStreetSegment?.fullName}
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
                setSelectedStreetSegment((prev) => ({
                  ...prev,
                  crossStreets: {
                    ...prev?.crossStreets,
                    to: value || undefined,
                  },
                }));

                const params = new URLSearchParams(searchParams.toString());
                params.set("crossStreet2", value || "");
                router.replace(`?${params.toString()}`, { scroll: false });
              }}
              style={{ width: 200 }}
            />
          </>
        )}

        <Button
          variant="filled"
          onClick={onApply}
          mt={"sm"}
          disabled={isLoading || !isFormValid}
        >
          Apply
        </Button>
      </Flex>
    </Suspense>
  );
};

export default FilterPanel;
