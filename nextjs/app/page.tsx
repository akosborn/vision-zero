"use client";

import React, { Suspense, useState } from "react";
import Map, { DEFAULT_VIEWPORT } from "./components/Map";
import { DateTime } from "luxon";
import "flatpickr/dist/themes/dark.css";
import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Point,
} from "geojson";
import { MapRef } from "react-map-gl/mapbox-legacy";
import FilterPanel, { isEnabledSearchTool } from "@/app/components/FilterPanel";
import { Button, Drawer, em, Flex, Paper, Text } from "@mantine/core";
import LocationReport, {
  ExportCsvButton,
} from "@/app/components/LocationReport";
import {
  CrashListFilters,
  DEFAULT_CRASH_LIST_FILTERS,
  getVisibleCrashFeatures,
} from "@/app/components/LocationReport/CrashList";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  AnnualCrashSummary,
  Crash,
  getAnnualCrashHistory,
  getBufferedStreetCenterlines,
  getIncidents,
  getIncidentsWithinBufferedRoute,
  getIncidentsWithinBufferedStreet,
  getStreetCenterlines,
  getStreets,
} from "@/app/lib/api-client";
import { Street } from "@/app/api/streets/route";
import { useSearchParams } from "next/dist/client/components/navigation";
import zoomToLayerUtil from "@/app/utils/map/zoom-to-layer";
import {
  createFinalRoute,
  createRoutePreview,
  INITIAL_ROUTE_DRAWING_STATE,
  routeDrawingReducer,
} from "@/app/lib/route-drawing";
import { prepareRouteSearch } from "@/app/lib/route-search";

export type SearchTool =
  | "Radius Search"
  | "Street Search"
  | "Upload Route"
  | "Draw Route";

export type Filters = {
  searchTool: SearchTool;
  dateRange?: { from?: string; to?: string };
  bufferRadiusInFeet: number;
  streetSegment?: {
    fullName?: string;
    crossStreets?: { from?: string; to?: string };
  };
  droppedPin?: { lng: number; lat: number };
};

type ActiveCrashResults = {
  searchTool: SearchTool;
  features: Feature<Point, Crash>[];
};

const DEFAULT_BUFFER_RADIUS_IN_FEET = 20;
const EMPTY_CRASH_FEATURES: Feature<Point, Crash>[] = [];

function HomeContent() {
  const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

  const searchParams = useSearchParams();

  const mapRef = React.useRef<MapRef | null>(null);

  const [viewport, setViewport] = React.useState(DEFAULT_VIEWPORT);

  const [isLoading, setIsLoading] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    searchTool: "Radius Search",
    dateRange: {
      from: DateTime.now()
        .setZone("America/Denver")
        .minus({ months: 12 })
        .toFormat("yyyy-MM-dd"),
      to: DateTime.now().setZone("America/Denver").toFormat("yyyy-MM-dd"),
    },
    bufferRadiusInFeet: DEFAULT_BUFFER_RADIUS_IN_FEET,
    droppedPin: {
      lng: DEFAULT_VIEWPORT.longitude,
      lat: DEFAULT_VIEWPORT.latitude,
    },
  });

  const [areaOfInterestIncidentGeoJson, setAreaOfInterestIncidentGeoJson] =
    React.useState<FeatureCollection<Point, Crash> | null>(null);

  const [incidentGeoJson, setIncidentGeoJson] =
    React.useState<FeatureCollection<Point, Crash> | null>(null);

  const [crashSummaryHistory, setCrashSummaryHistory] = React.useState<
    AnnualCrashSummary[] | null
  >(null);

  const [activeCrashResults, setActiveCrashResults] =
    React.useState<ActiveCrashResults | null>(null);
  const [crashListFilters, setCrashListFilters] =
    React.useState<CrashListFilters>(DEFAULT_CRASH_LIST_FILTERS);
  const [selectedCrashFeature, setSelectedCrashFeature] =
    React.useState<Feature<Point, Crash> | null>(null);
  const [selectedCrashCalloutIsOpen, setSelectedCrashCalloutIsOpen] =
    React.useState(false);

  const clearCrashResults = React.useCallback(() => {
    setIncidentGeoJson(null);
    setAreaOfInterestIncidentGeoJson(null);
    setCrashSummaryHistory(null);
    setActiveCrashResults(null);
    setSelectedCrashFeature(null);
    setSelectedCrashCalloutIsOpen(false);
  }, []);

  const [streetCenterlines, setStreetCenterlines] =
    React.useState<FeatureCollection | null>(null);
  const [bufferedStreet, setBufferedStreet] =
    React.useState<FeatureCollection | null>(null);
  const [routeGeometry, setRouteGeometry] =
    React.useState<FeatureCollection | null>(null);
  const [routeSearchArea, setRouteSearchArea] =
    React.useState<FeatureCollection | null>(null);
  const [routeDrawingState, dispatchRouteDrawing] = React.useReducer(
    routeDrawingReducer,
    INITIAL_ROUTE_DRAWING_STATE,
  );

  const drawnRoutePreview = React.useMemo(
    () =>
      routeDrawingState.status === "drawing"
        ? createRoutePreview(routeDrawingState)
        : null,
    [routeDrawingState],
  );
  const finalDrawnRoute = React.useMemo(
    () => createFinalRoute(routeDrawingState),
    [routeDrawingState],
  );

  const clearSearchGeometryAndResults = React.useCallback(() => {
    clearCrashResults();
    setStreetCenterlines(null);
    setBufferedStreet(null);
    setRouteGeometry(null);
    setRouteSearchArea(null);
  }, [clearCrashResults]);

  const [
    mobileFiltersAreOpen,
    { open: openMobileFilters, close: closeMobileFilters },
  ] = useDisclosure(false);
  const [
    locationReportIsOpen,
    { open: openLocationReport, close: closeLocationReport },
  ] = useDisclosure(true);

  const handleSearchToolChange = React.useCallback(
    (searchTool: SearchTool) => {
      clearSearchGeometryAndResults();
      dispatchRouteDrawing({ type: "cancel" });
      setFilters((previousFilters) => ({
        ...previousFilters,
        searchTool,
        droppedPin: undefined,
      }));
    },
    [clearSearchGeometryAndResults],
  );

  const startRouteDrawing = React.useCallback(() => {
    clearSearchGeometryAndResults();
    dispatchRouteDrawing({ type: "start" });
    closeLocationReport();
  }, [clearSearchGeometryAndResults, closeLocationReport]);

  const clearAppliedRoute = React.useCallback(() => {
    clearSearchGeometryAndResults();
    dispatchRouteDrawing({ type: "cancel" });
  }, [clearSearchGeometryAndResults]);

  const [isLoadingStreets, setIsLoadingStreets] = React.useState(true);
  const [streets, setStreets] = React.useState<Street[]>([]);

  const zoomToLayer = React.useCallback(
    (featureCollection?: FeatureCollection | null) => {
      const map = mapRef.current?.getMap();
      if (!map) {
        console.error("Map ref is null");
        return;
      }

      if (!featureCollection) {
        console.warn("No feature collection provided");
        return;
      }

      zoomToLayerUtil(map, featureCollection, isMobile);
    },
    [isMobile],
  );

  const fetchCrashDataWithArgs = async (
    radius: number,
    streetSegment?: {
      fullName?: string;
      crossStreets?: { from?: string; to?: string };
    },
    range?: { from?: string; to?: string },
  ) => {
    setIsLoading(true);
    clearCrashResults();
    closeMobileFilters();
    openLocationReport();

    if (radius >= 0 && streetSegment && streetSegment.fullName) {
      const fullName = streetSegment.fullName;

      const [centerlines, buffer, incidentsInBuffer, history] =
        await Promise.all([
          getStreetCenterlines(streetSegment),
          getBufferedStreetCenterlines({
            ...streetSegment,
            fullName,
            bufferInFeet: radius,
          }),
          getIncidentsWithinBufferedStreet({
            ...streetSegment,
            fullStreetName: fullName,
            bufferInFeet: radius,
            startDate: range?.from,
            endDate: range?.to,
          }),
          getAnnualCrashHistory({
            ...streetSegment,
            fullStreetName: fullName,
            bufferInFeet: radius,
          }),
        ]);
      setStreetCenterlines(centerlines);
      setBufferedStreet(buffer);
      setAreaOfInterestIncidentGeoJson(incidentsInBuffer);
      setCrashSummaryHistory(history);
      setActiveCrashResults({
        searchTool: "Street Search",
        features: incidentsInBuffer.features,
      });

      zoomToLayer(incidentsInBuffer);
    }
    setIsLoading(false);
  };

  React.useEffect(() => {
    setIsLoadingStreets(true);

    (async () => {
      const streets = await getStreets();
      setStreets(streets);
      setIsLoadingStreets(false);

      const searchTool = searchParams.get("tool");
      const fromDate = searchParams.get("fromDate") || filters.dateRange?.from;
      const toDate = searchParams.get("toDate") || filters.dateRange?.to;
      const street = searchParams.get("street");
      const crossStreet1 = searchParams.get("crossStreet1");
      const crossStreet2 = searchParams.get("crossStreet2");

      if (searchTool && isEnabledSearchTool(searchTool)) {
        setFilters((prevState) => ({
          ...prevState,
          searchTool,
        }));
      }

      if (fromDate && toDate) {
        setFilters((prevState) => ({
          ...prevState,
          dateRange: {
            from: fromDate,
            to: toDate,
          },
        }));
      }

      setFilters((prevState) => ({
        ...prevState,
        dateRange:
          fromDate && toDate
            ? {
                from: fromDate,
                to: toDate,
              }
            : undefined,
        streetSegment: {
          fullName: street || undefined,
          crossStreets: {
            from: crossStreet1 || undefined,
            to: crossStreet2 || undefined,
          },
        },
      }));

      if (fromDate && toDate && street) {
        await fetchCrashDataWithArgs(
          filters.bufferRadiusInFeet,
          {
            fullName: street,
            crossStreets: {
              from: crossStreet1 || undefined,
              to: crossStreet2 || undefined,
            },
          },
          { from: fromDate, to: toDate },
        );
      }
    })();
  }, []);

  const fetchCrashDataForPinRadius = async (
    radiusInFeet: number,
    point?: { lat: number; lng: number },
    range?: { from?: string; to?: string },
  ) => {
    setIsLoading(true);
    clearCrashResults();
    closeMobileFilters();
    openLocationReport();

    if (radiusInFeet >= 0 && point && range) {
      const crashes = await getIncidents({
        startDate: range.from,
        endDate: range.to,
        lat: point.lat,
        lng: point.lng,
        radiusInFeet,
      });
      setIncidentGeoJson(crashes);
      setStreetCenterlines(null);
      setBufferedStreet(null);
      setActiveCrashResults({
        searchTool: "Radius Search",
        features: crashes.features,
      });

      zoomToLayer(crashes);
    }
    setIsLoading(false);
  };

  const getDataForRoute = async (
    radius: number,
    candidateRoute: FeatureCollection<Geometry | null, GeoJsonProperties>,
    range: { from?: string; to?: string } | undefined,
    searchTool: "Upload Route" | "Draw Route",
    options: { preserveExistingResults?: boolean } = {},
  ) => {
    const preparedSearch = prepareRouteSearch(candidateRoute, radius, range);
    if (!preparedSearch) {
      return;
    }

    setIsLoading(true);
    if (!options.preserveExistingResults) {
      clearSearchGeometryAndResults();
    }
    closeMobileFilters();
    openLocationReport();

    try {
      const incidentsInBuffer = await getIncidentsWithinBufferedRoute(
        preparedSearch.request,
      );

      setRouteGeometry(preparedSearch.route);
      setRouteSearchArea(preparedSearch.searchArea);
      setCrashSummaryHistory(null);
      setAreaOfInterestIncidentGeoJson(incidentsInBuffer);
      setActiveCrashResults({
        searchTool,
        features: incidentsInBuffer.features,
      });

      zoomToLayer(preparedSearch.route);
    } finally {
      setIsLoading(false);
    }
  };

  const applyDrawnRoute = async () => {
    if (!finalDrawnRoute) {
      return;
    }

    await getDataForRoute(
      filters.bufferRadiusInFeet,
      finalDrawnRoute,
      filters.dateRange,
      "Draw Route",
    );
    dispatchRouteDrawing({ type: "cancel" });
  };

  const refreshAppliedDrawnRoute = async (range: {
    from?: string;
    to?: string;
  }) => {
    if (
      filters.searchTool !== "Draw Route" ||
      !routeGeometry ||
      !range.from ||
      !range.to
    ) {
      return;
    }

    await getDataForRoute(
      filters.bufferRadiusInFeet,
      routeGeometry,
      range,
      "Draw Route",
      { preserveExistingResults: true },
    );
  };

  const previousSearchTool = React.useRef(filters.searchTool);
  React.useEffect(() => {
    if (previousSearchTool.current !== filters.searchTool) {
      clearSearchGeometryAndResults();
      dispatchRouteDrawing({ type: "cancel" });
      previousSearchTool.current = filters.searchTool;
    }
  }, [clearSearchGeometryAndResults, filters.searchTool]);

  React.useEffect(() => {
    if (!incidentGeoJson && !areaOfInterestIncidentGeoJson) {
      setCrashSummaryHistory(null);
      setActiveCrashResults(null);
    }
  }, [areaOfInterestIncidentGeoJson, incidentGeoJson]);

  const handleMapRadiusResultsChange = React.useCallback(
    (results: FeatureCollection<Point, Crash> | null) => {
      setCrashSummaryHistory(null);
      setActiveCrashResults(
        results
          ? { searchTool: "Radius Search", features: results.features }
          : null,
      );
    },
    [],
  );

  const updateCrashSelection = React.useCallback(
    (feature: Feature<Point, Crash> | null, showCallout: boolean) => {
      setSelectedCrashFeature(feature);
      setSelectedCrashCalloutIsOpen(Boolean(feature) && showCallout);

      if (!feature) {
        return;
      }

      const [longitude, latitude] = feature.geometry.coordinates;
      setViewport((previousViewport) => ({
        ...previousViewport,
        longitude,
        latitude,
      }));
    },
    [],
  );

  const handleCrashListSelect = React.useCallback(
    (feature: Feature<Point, Crash>) => {
      updateCrashSelection(feature, false);

      if (isMobile) {
        closeLocationReport();
      }
    },
    [closeLocationReport, isMobile, updateCrashSelection],
  );

  const handleMapCrashSelect = React.useCallback(
    (feature: Feature<Point, Crash> | null) =>
      updateCrashSelection(feature, Boolean(feature)),
    [updateCrashSelection],
  );

  const reportSearchTool = activeCrashResults?.searchTool || filters.searchTool;
  const reportCrashFeatures =
    activeCrashResults?.features || EMPTY_CRASH_FEATURES;
  const exportCrashFeatures = React.useMemo(
    () => getVisibleCrashFeatures(reportCrashFeatures, crashListFilters),
    [crashListFilters, reportCrashFeatures],
  );

  return (
    <Suspense>
      <main
        style={{
          position: "relative",
          display: "flex",
          height: "100dvh",
          width: "100vw",
          overflow: "hidden",
        }}
      >
        {/* Map Area */}
        <div
          className="absolute inset-0"
          style={{ position: "absolute", inset: 0 }}
        >
          <Map
            filters={filters}
            setFilters={setFilters}
            viewport={viewport}
            setViewport={setViewport}
            ref={mapRef}
            areaOfInterestIncidentGeoJson={areaOfInterestIncidentGeoJson}
            setAreaOfInterestIncidentGeoJson={setAreaOfInterestIncidentGeoJson}
            incidentGeoJson={incidentGeoJson}
            setIncidentGeoJson={setIncidentGeoJson}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            setStreetCenterlines={setStreetCenterlines}
            streetCenterlines={streetCenterlines}
            bufferedStreet={bufferedStreet}
            setBufferedStreet={setBufferedStreet}
            onRadiusResultsChange={handleMapRadiusResultsChange}
            isDrawingRoute={routeDrawingState.status === "drawing"}
            drawnRoutePreview={drawnRoutePreview}
            routeGeometry={routeGeometry}
            routeSearchArea={routeSearchArea}
            selectedCrashFeature={selectedCrashFeature}
            selectedCrashCalloutIsOpen={selectedCrashCalloutIsOpen}
            onCrashSelect={handleMapCrashSelect}
            onAddDrawnRouteVertex={(coordinate) =>
              dispatchRouteDrawing({ type: "add-vertex", coordinate })
            }
          />
        </div>

        {/* Top Filter Panel Overlay */}
        <div
          style={{
            position: "absolute",
            top: isMobile ? 0 : "1rem",
            left: isMobile ? 0 : "1rem",
            right: isMobile ? 0 : "1rem",
            zIndex: 10,
            display: "flex",
            alignItems: "start",
            flexDirection: "column",
            gap: "0.5rem",
            width: isMobile ? "100%" : undefined,
          }}
        >
          <Paper
            shadow="xs"
            radius={isMobile ? 0 : "md"}
            p="sm"
            w={isMobile ? "100%" : undefined}
          >
            {isMobile && !mobileFiltersAreOpen && (
              <Flex w="100%">
                <Button
                  variant="default"
                  onClick={() => {
                    closeLocationReport();
                    openMobileFilters();
                  }}
                >
                  Filters
                </Button>
              </Flex>
            )}

            {isMobile && mobileFiltersAreOpen && (
              <>
                <FilterPanel
                  closeMobileFilters={closeMobileFilters}
                  setAreaOfInterestIncidentGeoJson={
                    setAreaOfInterestIncidentGeoJson
                  }
                  incidentGeoJson={incidentGeoJson}
                  filters={filters}
                  setFilters={setFilters}
                  onSearchToolChange={handleSearchToolChange}
                  hasAppliedRoute={routeGeometry !== null}
                  isDrawingRoute={routeDrawingState.status === "drawing"}
                  routeDrawingVertexCount={routeDrawingState.coordinates.length}
                  canApplyDrawnRoute={finalDrawnRoute !== null}
                  onStartRouteDrawing={startRouteDrawing}
                  onCancelRouteDrawing={clearAppliedRoute}
                  onUndoRouteDrawing={() =>
                    dispatchRouteDrawing({ type: "undo" })
                  }
                  onClearRouteDrawing={() =>
                    dispatchRouteDrawing({ type: "clear" })
                  }
                  onApplyDrawnRoute={() => void applyDrawnRoute()}
                  onClearRoute={clearAppliedRoute}
                  onDateRangeChange={(range) =>
                    void refreshAppliedDrawnRoute(range)
                  }
                  setIncidentGeoJson={setIncidentGeoJson}
                  onApplyStreetSearch={() =>
                    fetchCrashDataWithArgs(
                      filters.bufferRadiusInFeet,
                      filters.streetSegment,
                      filters.dateRange,
                    )
                  }
                  onApplyRadiusSearch={() =>
                    fetchCrashDataForPinRadius(
                      filters.bufferRadiusInFeet,
                      filters.droppedPin,
                      filters.dateRange,
                    )
                  }
                  onApplyUploadRoute={(
                    uploadedRoute: FeatureCollection<Geometry | null>,
                  ) =>
                    getDataForRoute(
                      filters.bufferRadiusInFeet,
                      uploadedRoute,
                      filters.dateRange,
                      "Upload Route",
                    )
                  }
                  isLoading={isLoading || isLoadingStreets}
                  streets={streets}
                />
              </>
            )}

            {!isMobile && (
              <FilterPanel
                closeMobileFilters={closeMobileFilters}
                setAreaOfInterestIncidentGeoJson={
                  setAreaOfInterestIncidentGeoJson
                }
                incidentGeoJson={incidentGeoJson}
                filters={filters}
                setFilters={setFilters}
                onSearchToolChange={handleSearchToolChange}
                hasAppliedRoute={routeGeometry !== null}
                isDrawingRoute={routeDrawingState.status === "drawing"}
                routeDrawingVertexCount={routeDrawingState.coordinates.length}
                canApplyDrawnRoute={finalDrawnRoute !== null}
                onStartRouteDrawing={startRouteDrawing}
                onCancelRouteDrawing={clearAppliedRoute}
                onUndoRouteDrawing={() =>
                  dispatchRouteDrawing({ type: "undo" })
                }
                onClearRouteDrawing={() =>
                  dispatchRouteDrawing({ type: "clear" })
                }
                onApplyDrawnRoute={() => void applyDrawnRoute()}
                onClearRoute={clearAppliedRoute}
                onDateRangeChange={(range) =>
                  void refreshAppliedDrawnRoute(range)
                }
                setIncidentGeoJson={setIncidentGeoJson}
                onApplyStreetSearch={() =>
                  fetchCrashDataWithArgs(
                    filters.bufferRadiusInFeet,
                    filters.streetSegment,
                    filters.dateRange,
                  )
                }
                onApplyRadiusSearch={() =>
                  fetchCrashDataForPinRadius(
                    filters.bufferRadiusInFeet,
                    filters.droppedPin,
                    filters.dateRange,
                  )
                }
                onApplyUploadRoute={(
                  uploadedRoute: FeatureCollection<Geometry | null>,
                ) =>
                  getDataForRoute(
                    filters.bufferRadiusInFeet,
                    uploadedRoute,
                    filters.dateRange,
                    "Upload Route",
                  )
                }
                isLoading={isLoading || isLoadingStreets}
                streets={streets}
              />
            )}
          </Paper>
        </div>

        {/* Location Report Overlay */}
        <div
          style={{
            position: "absolute",
            bottom: "0rem",
            left: "0rem",
            padding: isMobile ? 0 : "1rem",
            zIndex: 10,
            display: "flex",
            alignItems: "start",
            flexDirection: "column",
            gap: "0.5rem",
            minWidth: isMobile ? "100%" : undefined,
            maxWidth: isMobile ? "100%" : "70%",
            width: isMobile ? "100%" : 500,
          }}
        >
          <Paper shadow="xs" radius={isMobile ? 0 : "md"} p="sm" w="100%">
            {isMobile ? (
              <>
                <Drawer.Root
                  opened={locationReportIsOpen}
                  onClose={closeLocationReport}
                  position="bottom"
                >
                  <Drawer.Content style={{ height: "auto" }}>
                    <Drawer.Header>
                      <Drawer.Title fw={700}>Location Report</Drawer.Title>
                      <Flex align="center" gap="xs" ml="auto">
                        <ExportCsvButton
                          isLoading={isLoading}
                          searchTool={reportSearchTool}
                          crashFeatures={exportCrashFeatures}
                        />
                        <Drawer.CloseButton />
                      </Flex>
                    </Drawer.Header>
                    <Drawer.Body>
                      <LocationReport
                        crashSummaryHistory={crashSummaryHistory}
                        isLoading={isLoading}
                        crashFeatures={reportCrashFeatures}
                        setViewport={setViewport}
                        zoomToLayer={zoomToLayer}
                        droppedPin={filters.droppedPin}
                        historyAvailable={reportSearchTool === "Street Search"}
                        crashListFilters={crashListFilters}
                        onCrashListFiltersChange={setCrashListFilters}
                        selectedCrashFeature={selectedCrashFeature}
                        onCrashSelect={handleCrashListSelect}
                      />
                    </Drawer.Body>
                  </Drawer.Content>
                </Drawer.Root>

                <Flex w="100%">
                  <Button
                    variant="default"
                    onClick={() => {
                      closeMobileFilters();
                      openLocationReport();
                    }}
                  >
                    Location Report
                  </Button>
                </Flex>
              </>
            ) : (
              <>
                <Flex align="center" justify="space-between" mb="sm">
                  <Text size="md" fw={700}>
                    Location Report
                  </Text>
                  <ExportCsvButton
                    isLoading={isLoading}
                    searchTool={reportSearchTool}
                    crashFeatures={exportCrashFeatures}
                  />
                </Flex>
                <LocationReport
                  crashSummaryHistory={crashSummaryHistory}
                  isLoading={isLoading}
                  crashFeatures={reportCrashFeatures}
                  setViewport={setViewport}
                  zoomToLayer={zoomToLayer}
                  droppedPin={filters.droppedPin}
                  historyAvailable={reportSearchTool === "Street Search"}
                  crashListFilters={crashListFilters}
                  onCrashListFiltersChange={setCrashListFilters}
                  selectedCrashFeature={selectedCrashFeature}
                  onCrashSelect={handleCrashListSelect}
                />
              </>
            )}
          </Paper>
        </div>
      </main>
    </Suspense>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
