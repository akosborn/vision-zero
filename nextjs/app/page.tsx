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
import FilterPanel, {
  ENABLED_SEARCH_TOOLS,
} from "@/app/components/FilterPanel";
import { Alert, Button, Drawer, em, Flex, Paper, Text } from "@mantine/core";
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
  getAnnualRadiusCrashHistory,
  getAnnualRouteCrashHistory,
  getBufferedStreetCenterlines,
  getIncidents,
  getIncidentsWithinBufferedRoute,
  getIncidentsWithinBufferedStreet,
  getStreetCenterlines,
  getStreets,
} from "@/app/lib/api-client";
import { Street } from "@/app/api/streets/route";
import zoomToLayerUtil from "@/app/utils/map/zoom-to-layer";
import {
  createFinalRoute,
  createRoutePreview,
  INITIAL_ROUTE_DRAWING_STATE,
  routeDrawingReducer,
} from "@/app/lib/route-drawing";
import { prepareRouteSearch } from "@/app/lib/route-search";
import {
  type QueryDateRange,
  type QueryDefinitionV1,
  validateQueryDefinition,
} from "@/app/lib/query-definition";
import {
  isCanonicalQueryUrlShareable,
  parseQueryUrl,
  serializeQueryUrl,
} from "@/app/lib/query-url";
import {
  useRouter,
  useSearchParams,
} from "next/dist/client/components/navigation";
import CopyQueryLinkButton from "@/app/components/CopyQueryLinkButton";

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
  query: QueryDefinitionV1 | null;
  uploadDateRange?: { from?: string; to?: string };
  features: Feature<Point, Crash>[];
};

const DEFAULT_BUFFER_RADIUS_IN_FEET = 1000;
const EMPTY_CRASH_FEATURES: Feature<Point, Crash>[] = [];

function HomeContent() {
  const isMobile = useMediaQuery(`(max-width: ${em(750)})`);
  const router = useRouter();
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

  const handleSearchToolChange = React.useCallback((searchTool: SearchTool) => {
    dispatchRouteDrawing({ type: "cancel" });
    setFilters((previousFilters) => ({
      ...previousFilters,
      searchTool,
      droppedPin: undefined,
    }));
  }, []);

  const startRouteDrawing = React.useCallback(() => {
    dispatchRouteDrawing({ type: "start" });
    closeLocationReport();
  }, [closeLocationReport]);

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

  const [queryError, setQueryError] = React.useState<string | null>(null);

  const replaceUrlForSuccessfulQuery = React.useCallback(
    (query: QueryDefinitionV1) => {
      const pathname = window.location.pathname || "/map";
      if (!isCanonicalQueryUrlShareable(query, pathname)) {
        router.replace(pathname, { scroll: false });
        return;
      }
      router.replace(`?${serializeQueryUrl(query).toString()}`, {
        scroll: false,
      });
    },
    [router],
  );

  const runQuery = React.useCallback(
    async (unvalidatedQuery: QueryDefinitionV1): Promise<boolean> => {
      let query: QueryDefinitionV1;
      try {
        query = validateQueryDefinition(unvalidatedQuery);
      } catch {
        setQueryError("Complete the query before applying it.");
        return false;
      }

      setIsLoading(true);
      setQueryError(null);
      closeMobileFilters();
      openLocationReport();

      try {
        if (query.tool === "radius") {
          const [crashes, history] = await Promise.all([
            getIncidents({
              startDate: query.dateRange.from,
              endDate: query.dateRange.to,
              lat: query.center.lat,
              lng: query.center.lng,
              radiusInFeet: query.radiusFeet,
            }),
            getAnnualRadiusCrashHistory({
              lat: query.center.lat,
              lng: query.center.lng,
              radiusInFeet: query.radiusFeet,
            }),
          ]);

          setIncidentGeoJson(crashes);
          setAreaOfInterestIncidentGeoJson(null);
          setStreetCenterlines(null);
          setBufferedStreet(null);
          setRouteGeometry(null);
          setRouteSearchArea(null);
          setCrashSummaryHistory(history);
          setActiveCrashResults({ query, features: crashes.features });
          zoomToLayer(crashes);
        } else if (query.tool === "street") {
          const streetSegment = {
            fullName: query.street,
            crossStreets: query.crossStreets,
          };
          const [centerlines, buffer, incidentsInBuffer, history] =
            await Promise.all([
              getStreetCenterlines(streetSegment),
              getBufferedStreetCenterlines({
                ...streetSegment,
                fullName: query.street,
                bufferInFeet: query.bufferFeet,
              }),
              getIncidentsWithinBufferedStreet({
                ...streetSegment,
                fullStreetName: query.street,
                bufferInFeet: query.bufferFeet,
                startDate: query.dateRange.from,
                endDate: query.dateRange.to,
              }),
              getAnnualCrashHistory({
                ...streetSegment,
                fullStreetName: query.street,
                bufferInFeet: query.bufferFeet,
              }),
            ]);

          setIncidentGeoJson(null);
          setAreaOfInterestIncidentGeoJson(incidentsInBuffer);
          setStreetCenterlines(centerlines);
          setBufferedStreet(buffer);
          setRouteGeometry(null);
          setRouteSearchArea(null);
          setCrashSummaryHistory(history);
          setActiveCrashResults({
            query,
            features: incidentsInBuffer.features,
          });
          zoomToLayer(incidentsInBuffer);
        } else {
          const preparedSearch = prepareRouteSearch(
            query.route,
            query.bufferFeet,
            query.dateRange,
          );
          if (!preparedSearch) {
            throw new Error("Invalid drawn route");
          }

          const [incidentsInBuffer, history] = await Promise.all([
            getIncidentsWithinBufferedRoute(preparedSearch.request),
            getAnnualRouteCrashHistory({
              route: preparedSearch.route,
              bufferInFeet: preparedSearch.request.bufferInFeet,
            }),
          ]);

          setIncidentGeoJson(null);
          setAreaOfInterestIncidentGeoJson(incidentsInBuffer);
          setStreetCenterlines(null);
          setBufferedStreet(null);
          setRouteGeometry(preparedSearch.route);
          setRouteSearchArea(preparedSearch.searchArea);
          setCrashSummaryHistory(history);
          setActiveCrashResults({
            query,
            features: incidentsInBuffer.features,
          });
          zoomToLayer(preparedSearch.route);
        }

        setSelectedCrashFeature(null);
        setSelectedCrashCalloutIsOpen(false);
        replaceUrlForSuccessfulQuery(query);
        return true;
      } catch {
        setQueryError(
          "The query could not be completed. The previous report is unchanged.",
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [
      closeMobileFilters,
      openLocationReport,
      replaceUrlForSuccessfulQuery,
      zoomToLayer,
    ],
  );

  const initialQueryWasHandled = React.useRef(false);
  React.useEffect(() => {
    if (initialQueryWasHandled.current) {
      return;
    }
    initialQueryWasHandled.current = true;

    const enabledTools = [
      "radius" as const,
      "street" as const,
      ...(ENABLED_SEARCH_TOOLS.includes("Draw Route")
        ? (["draw"] as const)
        : []),
    ];
    const parsed = parseQueryUrl(searchParams, { enabledTools });
    if (parsed.status === "empty") {
      return;
    }
    if (parsed.status === "error") {
      setQueryError(parsed.message);
      return;
    }

    const { query } = parsed;
    if (query.tool === "radius") {
      setFilters((previous) => ({
        ...previous,
        searchTool: "Radius Search",
        dateRange: query.dateRange,
        bufferRadiusInFeet: query.radiusFeet,
        droppedPin: query.center,
        streetSegment: undefined,
      }));
    } else if (query.tool === "street") {
      setFilters((previous) => ({
        ...previous,
        searchTool: "Street Search",
        dateRange: query.dateRange,
        bufferRadiusInFeet: query.bufferFeet,
        droppedPin: undefined,
        streetSegment: {
          fullName: query.street,
          crossStreets: query.crossStreets,
        },
      }));
    } else {
      setFilters((previous) => ({
        ...previous,
        searchTool: "Draw Route",
        dateRange: query.dateRange,
        bufferRadiusInFeet: query.bufferFeet,
        droppedPin: undefined,
        streetSegment: undefined,
      }));
      setRouteGeometry(query.route);
    }

    void runQuery(query);
  }, [runQuery, searchParams]);

  React.useEffect(() => {
    setIsLoadingStreets(true);
    void getStreets()
      .then(setStreets)
      .finally(() => setIsLoadingStreets(false));
  }, []);

  const getCompleteDateRange = (): QueryDateRange | null => {
    const { from, to } = filters.dateRange ?? {};
    return from && to ? { from, to } : null;
  };

  const applyStreetQuery = async () => {
    const dateRange = getCompleteDateRange();
    const street = filters.streetSegment?.fullName;
    if (!dateRange || !street) {
      setQueryError("Complete the street and date fields before applying.");
      return;
    }

    await runQuery({
      version: 1,
      tool: "street",
      dateRange,
      street,
      ...(filters.streetSegment?.crossStreets?.from &&
      filters.streetSegment.crossStreets.to
        ? {
            crossStreets: {
              from: filters.streetSegment.crossStreets.from,
              to: filters.streetSegment.crossStreets.to,
            },
          }
        : {}),
      bufferFeet: filters.bufferRadiusInFeet,
    });
  };

  const applyRadiusQuery = async (
    point = filters.droppedPin,
  ): Promise<void> => {
    const dateRange = getCompleteDateRange();
    if (!dateRange || !point) {
      setQueryError("Choose a map point and complete the date range first.");
      return;
    }

    await runQuery({
      version: 1,
      tool: "radius",
      dateRange,
      center: point,
      radiusFeet: filters.bufferRadiusInFeet,
    });
  };

  const applyDrawnRoute = async () => {
    const dateRange = getCompleteDateRange();
    if (!finalDrawnRoute || !dateRange) {
      setQueryError("Draw a route and complete the date range first.");
      return;
    }

    const succeeded = await runQuery({
      version: 1,
      tool: "draw",
      dateRange,
      route: finalDrawnRoute,
      bufferFeet: filters.bufferRadiusInFeet,
    });
    if (succeeded) {
      dispatchRouteDrawing({ type: "cancel" });
    }
  };

  const refreshAppliedDrawnRoute = async (range: {
    from?: string;
    to?: string;
  }) => {
    const activeQuery = activeCrashResults?.query;
    if (activeQuery?.tool !== "draw" || !range.from || !range.to) {
      return;
    }

    await runQuery({
      ...activeQuery,
      dateRange: { from: range.from, to: range.to },
    });
  };

  const getDataForUploadedRoute = async (
    radius: number,
    candidateRoute: FeatureCollection<Geometry | null, GeoJsonProperties>,
    range: { from?: string; to?: string } | undefined,
  ) => {
    const preparedSearch = prepareRouteSearch(candidateRoute, radius, range);
    if (!preparedSearch) {
      setQueryError("Choose a valid route file before applying.");
      return;
    }

    setIsLoading(true);
    setQueryError(null);
    closeMobileFilters();
    openLocationReport();
    try {
      const [incidentsInBuffer, history] = await Promise.all([
        getIncidentsWithinBufferedRoute(preparedSearch.request),
        getAnnualRouteCrashHistory({
          route: preparedSearch.route,
          bufferInFeet: preparedSearch.request.bufferInFeet,
        }),
      ]);
      setIncidentGeoJson(null);
      setAreaOfInterestIncidentGeoJson(incidentsInBuffer);
      setStreetCenterlines(null);
      setBufferedStreet(null);
      setRouteGeometry(preparedSearch.route);
      setRouteSearchArea(preparedSearch.searchArea);
      setCrashSummaryHistory(history);
      setActiveCrashResults({
        query: null,
        uploadDateRange: range,
        features: incidentsInBuffer.features,
      });
      zoomToLayer(preparedSearch.route);
      router.replace(window.location.pathname || "/map", { scroll: false });
    } catch {
      setQueryError(
        "The query could not be completed. The previous report is unchanged.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapRadiusSearchPoint = React.useCallback(
    (point: { lng: number; lat: number }) => {
      setFilters((previousFilters) => ({
        ...previousFilters,
        searchTool: "Radius Search",
        droppedPin: point,
      }));
      const { from, to } = filters.dateRange ?? {};
      if (!from || !to) {
        setQueryError("Choose a map point and complete the date range first.");
        return;
      }
      void runQuery({
        version: 1,
        tool: "radius",
        dateRange: { from, to },
        center: point,
        radiusFeet: filters.bufferRadiusInFeet,
      });
    },
    [filters.bufferRadiusInFeet, filters.dateRange, runQuery],
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

  const reportSearchTool = activeCrashResults?.query
    ? activeCrashResults.query.tool === "radius"
      ? "Radius Search"
      : activeCrashResults.query.tool === "street"
        ? "Street Search"
        : "Draw Route"
    : activeCrashResults
      ? "Upload Route"
      : filters.searchTool;
  const reportDateRange =
    activeCrashResults?.query?.dateRange || activeCrashResults?.uploadDateRange;
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
            incidentGeoJson={incidentGeoJson}
            isLoading={isLoading}
            streetCenterlines={streetCenterlines}
            bufferedStreet={bufferedStreet}
            onRadiusSearchPoint={handleMapRadiusSearchPoint}
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
            {queryError && (
              <Alert color="red" mb="xs">
                {queryError}
              </Alert>
            )}
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
                  onApplyStreetSearch={applyStreetQuery}
                  onApplyRadiusSearch={applyRadiusQuery}
                  onApplyUploadRoute={(
                    uploadedRoute: FeatureCollection<Geometry | null>,
                  ) =>
                    getDataForUploadedRoute(
                      filters.bufferRadiusInFeet,
                      uploadedRoute,
                      filters.dateRange,
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
                onApplyStreetSearch={applyStreetQuery}
                onApplyRadiusSearch={applyRadiusQuery}
                onApplyUploadRoute={(
                  uploadedRoute: FeatureCollection<Geometry | null>,
                ) =>
                  getDataForUploadedRoute(
                    filters.bufferRadiusInFeet,
                    uploadedRoute,
                    filters.dateRange,
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
                        <CopyQueryLinkButton
                          query={activeCrashResults?.query ?? null}
                        />
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
                        historyAvailable={crashSummaryHistory !== null}
                        selectedDateRange={reportDateRange}
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
                  <Flex gap="xs">
                    <CopyQueryLinkButton
                      query={activeCrashResults?.query ?? null}
                    />
                    <ExportCsvButton
                      isLoading={isLoading}
                      searchTool={reportSearchTool}
                      crashFeatures={exportCrashFeatures}
                    />
                  </Flex>
                </Flex>
                <LocationReport
                  crashSummaryHistory={crashSummaryHistory}
                  isLoading={isLoading}
                  crashFeatures={reportCrashFeatures}
                  setViewport={setViewport}
                  zoomToLayer={zoomToLayer}
                  droppedPin={filters.droppedPin}
                  historyAvailable={crashSummaryHistory !== null}
                  selectedDateRange={reportDateRange}
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
