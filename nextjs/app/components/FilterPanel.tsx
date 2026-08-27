import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import React, { useState } from "react";
import { FeatureCollection, GeoJsonProperties, Geometry, Point } from "geojson";
import { DatePickerInput } from "@mantine/dates";
import {
  Alert,
  Button,
  em,
  FileInput,
  Flex,
  Grid,
  NumberInput,
  SegmentedControl,
  Select,
} from "@mantine/core";
import { Crash } from "@/app/lib/api-client";
import { Street } from "@/app/api/streets/route";
import { useMediaQuery } from "@mantine/hooks";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  useRouter,
  useSearchParams,
} from "next/dist/client/components/navigation";
import type { Filters, SearchTool } from "@/app/page";
import { parseRouteFile } from "@/app/lib/route-file";
import RouteDrawingControls from "@/app/components/RouteDrawingControls";

type Props = {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  closeMobileFilters: () => void;
  setAreaOfInterestIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection<Point, Crash> | null>
  >;
  incidentGeoJson: FeatureCollection<Point, Crash> | null;
  setIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection<Point, Crash> | null>
  >;
  onApplyStreetSearch: () => Promise<void>;
  onApplyRadiusSearch: () => Promise<void>;
  onApplyUploadRoute: (
    uploadedRoute: FeatureCollection<Geometry | null, GeoJsonProperties>,
  ) => Promise<void>;
  onSearchToolChange: (searchTool: SearchTool) => void;
  hasAppliedRoute: boolean;
  isDrawingRoute: boolean;
  routeDrawingVertexCount: number;
  canApplyDrawnRoute: boolean;
  onStartRouteDrawing: () => void;
  onCancelRouteDrawing: () => void;
  onUndoRouteDrawing: () => void;
  onClearRouteDrawing: () => void;
  onApplyDrawnRoute: () => void;
  onClearRoute: () => void;
  isLoading: boolean;
  streets: Street[];
};

const uploadRouteIsEnabled =
  process.env.NEXT_PUBLIC_UPLOAD_ROUTE_ENABLED === "true" ||
  (process.env.NEXT_PUBLIC_UPLOAD_ROUTE_ENABLED === undefined &&
    process.env.UPLOAD_ROUTE_ENABLED === "true");
const drawRouteIsEnabled =
  process.env.NEXT_PUBLIC_DRAW_ROUTE_ENABLED !== "false";

export const ENABLED_SEARCH_TOOLS: SearchTool[] = [
  "Street Search",
  "Radius Search",
  ...(uploadRouteIsEnabled ? (["Upload Route"] as const) : []),
  ...(drawRouteIsEnabled ? (["Draw Route"] as const) : []),
];

export const isEnabledSearchTool = (value: string): value is SearchTool =>
  ENABLED_SEARCH_TOOLS.includes(value as SearchTool);

const FilterPanel: React.FC<Props> = ({
  closeMobileFilters,
  isLoading,
  filters,
  setFilters,
  onApplyStreetSearch,
  onApplyRadiusSearch,
  onApplyUploadRoute,
  onSearchToolChange,
  hasAppliedRoute,
  isDrawingRoute,
  routeDrawingVertexCount,
  canApplyDrawnRoute,
  onStartRouteDrawing,
  onCancelRouteDrawing,
  onUndoRouteDrawing,
  onClearRouteDrawing,
  onApplyDrawnRoute,
  onClearRoute,
  setIncidentGeoJson,
  setAreaOfInterestIncidentGeoJson,
  streets,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [uploadedRoute, setUploadRoute] = useState<FeatureCollection<
    Geometry | null,
    GeoJsonProperties
  > | null>(null);

  const isMobile = useMediaQuery(`(max-width: ${em(750)})`);
  const crossStreetsToDisplay = React.useMemo(() => {
    if (!filters.streetSegment?.fullName) {
      return [];
    }

    const street = streets.find(
      ({ fullName }) => fullName === filters.streetSegment?.fullName,
    );
    return street?.crossingStreets || [];
  }, [streets, filters.streetSegment]);

  const fromCrossStreetsToDisplay = crossStreetsToDisplay.filter(
    (crossStreet) => crossStreet !== filters.streetSegment?.crossStreets?.to,
  );
  const toCrossStreetsToDisplay = crossStreetsToDisplay.filter(
    (crossStreet) => crossStreet !== filters.streetSegment?.crossStreets?.from,
  );

  const handleRouteFileChange = async (file: File | null) => {
    if (!file) {
      setUploadRoute(null);
      return;
    }

    setUploadRoute(await parseRouteFile(file));
  };

  const handleSearchToolChange = (value: string) => {
    const searchTool = value as SearchTool;
    onSearchToolChange(searchTool);

    const params = new URLSearchParams(searchParams.toString());
    params.set("tool", searchTool);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const distanceLabel =
    filters.searchTool === "Radius Search" ? "Radius" : "Buffer";

  // Must have zero cross streets selected or both cross-streets selected
  const isFormValid =
    filters.searchTool === "Street Search"
      ? filters.streetSegment?.fullName &&
        (filters.streetSegment.crossStreets?.from
          ? !!filters.streetSegment.crossStreets.to
          : true) &&
        (filters.streetSegment.crossStreets?.to
          ? !!filters.streetSegment.crossStreets.from
          : true)
      : filters.searchTool === "Upload Route"
        ? !!uploadedRoute?.features.length
        : true;

  if (isMobile) {
    return (
      <>
        <Grid gutter="xs">
          <Grid.Col span={{ base: 12 }}>
            <SegmentedControl
              disabled={isLoading}
              value={filters.searchTool}
              onChange={handleSearchToolChange}
              data={ENABLED_SEARCH_TOOLS}
              fullWidth
              size="sm"
              radius="md"
              mb="sm"
            />
          </Grid.Col>

          {filters.searchTool === "Radius Search" && (
            <Grid.Col span={{ base: 12 }}>
              <Alert
                variant="light"
                icon={<IconInfoCircle />}
                color="cyan"
                p="xs"
                my="0"
              >
                To get started, click anywhere on the map to inspect a circular
                area.
              </Alert>
            </Grid.Col>
          )}

          {filters.searchTool === "Draw Route" && isDrawingRoute && (
            <Grid.Col span={{ base: 12 }}>
              <RouteDrawingControls
                vertexCount={routeDrawingVertexCount}
                canApply={canApplyDrawnRoute}
                isLoading={isLoading}
                onUndo={onUndoRouteDrawing}
                onClear={onClearRouteDrawing}
                onApply={onApplyDrawnRoute}
              />
            </Grid.Col>
          )}

          <Grid.Col span={{ base: 8 }}>
            <DatePickerInput
              disabled={isLoading}
              type="range"
              label="Date range"
              className="bg-background"
              value={[
                filters.dateRange?.from || null,
                filters.dateRange?.to || null,
              ]}
              onChange={(values) => {
                setFilters((prevState) => ({
                  ...prevState,
                  dateRange: {
                    from: values[0] || undefined,
                    to: values[1] || undefined,
                  },
                }));

                const params = new URLSearchParams(searchParams.toString());
                params.set("fromDate", values[0]?.toString() || "");
                params.set("toDate", values[1]?.toString() || "");
                router.replace(`?${params.toString()}`, { scroll: false });
              }}
              valueFormat="MMM D, YYYY"
            />
          </Grid.Col>

          <Grid.Col span={{ base: 4 }}>
            <NumberInput
              disabled={isLoading}
              label={`${distanceLabel} (ft)`}
              placeholder={`${distanceLabel} in feet`}
              value={filters.bufferRadiusInFeet}
              onChange={(value) => {
                setFilters((prevState) => ({
                  ...prevState,
                  bufferRadiusInFeet: value as number,
                }));

                const params = new URLSearchParams(searchParams.toString());
                params.set("r", value?.toString() || "");
                router.replace(`?${params.toString()}`, { scroll: false });
              }}
              min={5}
              max={500}
              step={50}
            />
          </Grid.Col>

          {filters.searchTool === "Street Search" && (
            <>
              <Grid.Col span={{ base: 12 }}>
                <Select
                  disabled={isLoading}
                  label="Street"
                  placeholder="Search for a street"
                  searchable
                  data={streets.map(({ fullName }) => fullName)}
                  limit={20}
                  value={filters.streetSegment?.fullName || null}
                  onChange={(value) => {
                    // @TODO: This is probably not necessary
                    setIncidentGeoJson(null);
                    setAreaOfInterestIncidentGeoJson(null);
                    setFilters((prevState) => ({
                      ...prevState,
                      droppedPin: undefined,
                      streetSegment: { fullName: value || undefined },
                    }));

                    const params = new URLSearchParams(searchParams.toString());
                    params.set("street", value || "");
                    params.delete("crossStreet1");
                    params.delete("crossStreet2");
                    router.replace(`?${params.toString()}`);
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 6 }}>
                <Select
                  label="From Cross street"
                  disabled={isLoading || !filters.streetSegment?.fullName}
                  searchable
                  data={fromCrossStreetsToDisplay}
                  limit={20}
                  value={filters.streetSegment?.crossStreets?.from || null}
                  required={
                    filters.streetSegment?.crossStreets?.to !== undefined
                  }
                  onChange={(value) => {
                    // @TODO: This is probably not necessary
                    setIncidentGeoJson(null);
                    setAreaOfInterestIncidentGeoJson(null);
                    setFilters((prevState) => ({
                      ...prevState,
                      droppedPin: undefined,
                      streetSegment: {
                        ...prevState.streetSegment,
                        crossStreets: { from: value || undefined },
                      },
                    }));

                    const params = new URLSearchParams(searchParams.toString());
                    params.set("crossStreet1", value || "");
                    router.replace(`?${params.toString()}`, { scroll: false });
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 6 }}>
                <Select
                  label="To Cross street"
                  disabled={isLoading || !filters.streetSegment?.fullName}
                  searchable
                  data={toCrossStreetsToDisplay}
                  limit={20}
                  value={filters.streetSegment?.crossStreets?.to || null}
                  required={
                    filters.streetSegment?.crossStreets?.from !== undefined
                  }
                  onChange={(value) => {
                    // @TODO: This is probably not necessary
                    setIncidentGeoJson(null);
                    setAreaOfInterestIncidentGeoJson(null);
                    setFilters((prevState) => ({
                      ...prevState,
                      droppedPin: undefined,
                      streetSegment: {
                        ...prevState.streetSegment,
                        crossStreets: {
                          ...prevState.streetSegment?.crossStreets,
                          to: value || undefined,
                        },
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

          {filters.searchTool === "Upload Route" && (
            <Grid.Col span={{ base: 12 }}>
              <FileInput
                label="Upload GPX or KML"
                placeholder="Select a file"
                accept="application/gpx+xml,application/vnd.google-earth.kml+xml"
                disabled={isLoading}
                onChange={handleRouteFileChange}
              />
            </Grid.Col>
          )}
        </Grid>

        <Flex justify="space-between">
          <Button variant="default" onClick={closeMobileFilters} mt="sm">
            Close
          </Button>
          {filters.searchTool !== "Draw Route" && (
            <Button
              disabled={isLoading || !isFormValid}
              variant="filled"
              onClick={() => {
                if (filters.searchTool === "Street Search") {
                  onApplyStreetSearch();
                } else if (filters.searchTool === "Radius Search") {
                  onApplyRadiusSearch();
                } else if (uploadedRoute) {
                  onApplyUploadRoute(uploadedRoute);
                }
              }}
              mt="sm"
            >
              Apply
            </Button>
          )}
          {filters.searchTool === "Draw Route" && (
            <Button
              disabled={isLoading}
              variant={isDrawingRoute || hasAppliedRoute ? "default" : "filled"}
              onClick={
                isDrawingRoute
                  ? onCancelRouteDrawing
                  : hasAppliedRoute
                    ? onClearRoute
                    : onStartRouteDrawing
              }
              mt="sm"
            >
              {isDrawingRoute
                ? "Cancel"
                : hasAppliedRoute
                  ? "Clear Route"
                  : "Start Drawing"}
            </Button>
          )}
        </Flex>
      </>
    );
  }

  return (
    <>
      {filters.searchTool === "Radius Search" && (
        <Alert
          variant="light"
          icon={<IconInfoCircle />}
          color="cyan"
          p="xs"
          mb="xs"
        >
          To get started, click anywhere on the map to inspect a circular area.
        </Alert>
      )}

      {filters.searchTool === "Draw Route" && isDrawingRoute && (
        <RouteDrawingControls
          vertexCount={routeDrawingVertexCount}
          canApply={canApplyDrawnRoute}
          isLoading={isLoading}
          onUndo={onUndoRouteDrawing}
          onClear={onClearRouteDrawing}
          onApply={onApplyDrawnRoute}
        />
      )}

      <Flex gap="sm" justify="flex-start" align="flex-end" wrap="wrap">
        <SegmentedControl
          disabled={isLoading}
          value={filters.searchTool}
          onChange={handleSearchToolChange}
          data={ENABLED_SEARCH_TOOLS}
          fullWidth
          size="sm"
          radius="md"
        />

        <DatePickerInput
          disabled={isLoading}
          type="range"
          label="Date range"
          className="bg-background"
          value={[
            filters.dateRange?.from || null,
            filters.dateRange?.to || null,
          ]}
          onChange={(values) => {
            setFilters((prevState) => ({
              ...prevState,
              dateRange: {
                from: values[0] || undefined,
                to: values[1] || undefined,
              },
            }));

            const params = new URLSearchParams(searchParams.toString());
            params.set("fromDate", values[0]?.toString() || "");
            params.set("toDate", values[1]?.toString() || "");
            router.replace(`?${params.toString()}`, { scroll: false });
          }}
          valueFormat="MMM D, YYYY"
        />

        <NumberInput
          disabled={isLoading}
          label={`${distanceLabel} (ft)`}
          placeholder={`${distanceLabel} in feet`}
          value={filters.bufferRadiusInFeet}
          onChange={(value) => {
            setFilters((prevState) => ({
              ...prevState,
              bufferRadiusInFeet: value as number,
            }));

            const params = new URLSearchParams(searchParams.toString());
            params.set("r", value?.toString() || "");
            router.replace(`?${params.toString()}`, { scroll: false });
          }}
          min={5}
          max={500}
          step={10}
          style={{ width: 100 }}
        />

        {filters.searchTool === "Street Search" && (
          <>
            <Select
              label="Street"
              placeholder="Search for a street"
              disabled={isLoading}
              searchable
              data={streets.map(({ fullName }) => fullName)}
              limit={20}
              value={filters.streetSegment?.fullName || null}
              onChange={(value) => {
                // @TODO: This is probably not necessary
                setIncidentGeoJson(null);
                setAreaOfInterestIncidentGeoJson(null);
                setFilters((prevState) => ({
                  ...prevState,
                  droppedPin: undefined,
                  streetSegment: { fullName: value || undefined },
                }));

                const params = new URLSearchParams(searchParams.toString());
                params.set("street", value || "");
                params.delete("crossStreet1");
                params.delete("crossStreet2");
                router.replace(`?${params.toString()}`);
              }}
              style={{ width: 200 }}
            />

            <Select
              label="From Cross street"
              disabled={isLoading || !filters.streetSegment?.fullName}
              searchable
              data={fromCrossStreetsToDisplay}
              limit={20}
              value={filters.streetSegment?.crossStreets?.from || null}
              required={filters.streetSegment?.crossStreets?.to !== undefined}
              onChange={(value) => {
                // @TODO: This is probably not necessary
                setIncidentGeoJson(null);
                setAreaOfInterestIncidentGeoJson(null);
                setFilters((prevState) => ({
                  ...prevState,
                  droppedPin: undefined,
                  streetSegment: {
                    ...prevState.streetSegment,
                    crossStreets: { from: value || undefined },
                  },
                }));

                const params = new URLSearchParams(searchParams.toString());
                params.set("crossStreet1", value || "");
                router.replace(`?${params.toString()}`, { scroll: false });
              }}
              style={{ width: 200 }}
            />

            <Select
              label="To Cross street"
              disabled={isLoading || !filters.streetSegment?.fullName}
              searchable
              data={toCrossStreetsToDisplay}
              limit={20}
              value={filters.streetSegment?.crossStreets?.to || null}
              required={filters.streetSegment?.crossStreets?.from !== undefined}
              onChange={(value) => {
                // @TODO: This is probably not necessary
                setIncidentGeoJson(null);
                setAreaOfInterestIncidentGeoJson(null);
                setFilters((prevState) => ({
                  ...prevState,
                  droppedPin: undefined,
                  streetSegment: {
                    ...prevState.streetSegment,
                    crossStreets: {
                      ...prevState.streetSegment?.crossStreets,
                      to: value || undefined,
                    },
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

        {filters.searchTool === "Upload Route" && (
          <FileInput
            label="Upload GPX or KML"
            placeholder="Select a file"
            accept="application/gpx+xml,application/vnd.google-earth.kml+xml"
            disabled={isLoading}
            onChange={handleRouteFileChange}
          />
        )}

        {filters.searchTool !== "Draw Route" && (
          <Button
            variant="filled"
            onClick={() => {
              if (filters.searchTool === "Street Search") {
                onApplyStreetSearch();
              } else if (filters.searchTool === "Radius Search") {
                onApplyRadiusSearch();
              } else if (uploadedRoute) {
                onApplyUploadRoute(uploadedRoute);
              }
            }}
            mt="sm"
            disabled={isLoading || !isFormValid}
          >
            Apply
          </Button>
        )}
        {filters.searchTool === "Draw Route" && (
          <Button
            disabled={isLoading}
            variant={isDrawingRoute || hasAppliedRoute ? "default" : "filled"}
            onClick={
              isDrawingRoute
                ? onCancelRouteDrawing
                : hasAppliedRoute
                  ? onClearRoute
                  : onStartRouteDrawing
            }
            mt="sm"
          >
            {isDrawingRoute
              ? "Cancel"
              : hasAppliedRoute
                ? "Clear Route"
                : "Start Drawing"}
          </Button>
        )}
      </Flex>
    </>
  );
};

export default FilterPanel;
