"use client";

import React, { useEffect, useState } from "react";
import Map, { defaultViewport } from "./components/Map";
import { DateTime } from "luxon";
import "flatpickr/dist/themes/dark.css";
import { FeatureCollection, Point, Position } from "geojson";
import { LngLatBounds } from "mapbox-gl";
import { MapRef } from "react-map-gl/mapbox-legacy";
import _ from "lodash";
import FilterPanel from "@/app/components/FilterPanel";
import { Alert, Button, Drawer, em, Flex, Paper, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import LocationReport from "@/app/components/LocationReport";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { Crash } from "@/app/lib/api-client";

export default function Home() {
  const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

  const mapRef = React.useRef<MapRef | null>(null);

  const [viewport, setViewport] = React.useState(defaultViewport);

  const [isLoading, setIsLoading] = useState(false);

  const [selectedStreetSegment, setSelectedStreetSegment] = React.useState<{
    fullName?: string;
    crossStreets?: { from?: string; to?: string };
  } | null>(null);

  const [dateRange, setDateRange] = useState<
    { from?: string; to?: string } | undefined
  >({
    from: DateTime.now()
      .setZone("America/Denver")
      .minus({ months: 12 })
      .toFormat("yyyy-MM-dd"),
    to: DateTime.now().setZone("America/Denver").toFormat("yyyy-MM-dd"),
  });
  const [radiusInFeet, setRadiusInFeet] = useState(20);

  const [streetName, setStreetName] = useState<string | null>(null);
  const [areaOfInterestIncidentGeoJson, setAreaOfInterestIncidentGeoJson] =
    React.useState<FeatureCollection<Point, Crash> | null>(null);

  const [droppedPin, setDroppedPin] = React.useState<{
    lng: number;
    lat: number;
  } | null>({
    lng: defaultViewport.longitude,
    lat: defaultViewport.latitude,
  });
  const [incidentGeoJson, setIncidentGeoJson] =
    React.useState<FeatureCollection<Point, Crash> | null>(null);

  const [getStartedInfoIsOpen, setGetStartedInfoIsOpen] = React.useState(true);

  const [mobileFiltersAreOpen, { open: openMobileFilters, close: closeMobileFilters }] = useDisclosure(false);
  const [locationReportIsOpen, { open: openLocationReport, close: closeLocationReport }] = useDisclosure(true);

  // Function to zoom to a specific GeoJSON data object
  const zoomToLayer = (data: FeatureCollection | null) => {
    if (!data || !data.features.length || !mapRef.current) {
      return;
    }

    const bounds = new LngLatBounds();

    data.features.forEach((feature) => {
      if (feature.geometry.type === "Point") {
        bounds.extend(feature.geometry.coordinates as [number, number]);
      } else if (
        feature.geometry.type === "LineString" ||
        feature.geometry.type === "Polygon"
      ) {
        // For lines/polygons, we need to iterate through the nested coordinates
        const coords = feature.geometry.coordinates;

        const flattenedCoordinates = Array.isArray(coords[0])
          ? _.flatten(coords as Position[])
          : coords;

        flattenedCoordinates.forEach((coordinate) =>
          bounds.extend(coordinate as [number, number]),
        );
      }
    });

    mapRef.current.getMap().fitBounds(bounds, {
      padding: 40,
      duration: 1000,
    });
  };

  useEffect(() => {
    if (!streetName || !areaOfInterestIncidentGeoJson?.features.length) {
      return;
    }

    zoomToLayer(areaOfInterestIncidentGeoJson);
  }, [streetName, areaOfInterestIncidentGeoJson]);

  return (
    <main
      className="relative flex h-screen w-screen overflow-hidden"
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
          droppedPin={droppedPin}
          setDroppedPin={setDroppedPin}
          startDate={dateRange?.from}
          endDate={dateRange?.to}
          radiusFeet={radiusInFeet}
          streetName={streetName}
          viewport={viewport}
          setViewport={setViewport}
          ref={mapRef}
          areaOfInterestIncidentGeoJson={areaOfInterestIncidentGeoJson}
          setAreaOfInterestIncidentGeoJson={setAreaOfInterestIncidentGeoJson}
          setStreetName={setStreetName}
          incidentGeoJson={incidentGeoJson}
          setIncidentGeoJson={setIncidentGeoJson}
          setIsLoading={setIsLoading}
          setSelectedStreetSegment={setSelectedStreetSegment}
          selectedStreetSegment={selectedStreetSegment}
        />
      </div>

      {/* Top Filter Panel Overlay */}
      <div
        className={
          "absolute top-4 left-4 right-4 md:top-6 md:left-6 md:right-auto z-10 flex items-start flex-col gap-2"
        }
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
        <Paper shadow={"xs"} radius={isMobile ? 0 : "md"} p={"sm"} w={isMobile ? '100%' : undefined}>
          {getStartedInfoIsOpen && (
            <Alert
              variant={"light"}
              icon={<IconInfoCircle />}
              withCloseButton={true}
              onClose={() => setGetStartedInfoIsOpen(false)}
              color={"cyan"}
              p={"sm"}
              mb={"xs"}
            >
              To get started, select an area of interest filter or click
              anywhere on the map to inspect a circular area.
            </Alert>
          )}

          {isMobile && !mobileFiltersAreOpen && (
            <Flex w={"100%"}>
              <Button variant="default" onClick={openMobileFilters}>
                Filters
              </Button>
            </Flex>
          )}

          {isMobile && mobileFiltersAreOpen && (
            <>
              <FilterPanel
                dateRange={dateRange}
                setDateRange={setDateRange}
                streetName={streetName}
                setStreetName={setStreetName}
                setAreaOfInterestIncidentGeoJson={
                  setAreaOfInterestIncidentGeoJson
                }
                incidentGeoJson={incidentGeoJson}
                setIncidentGeoJson={setIncidentGeoJson}
                droppedPin={droppedPin}
                setDroppedPin={setDroppedPin}
                radiusFeet={radiusInFeet}
                setRadiusFeet={setRadiusInFeet}
                setSelectedStreetSegment={setSelectedStreetSegment}
                selectedStreetSegment={selectedStreetSegment}
              />
              <Button variant="default" onClick={closeMobileFilters} mt={"sm"}>
                Close
              </Button>
            </>
          )}

          {!isMobile && (
            <FilterPanel
              dateRange={dateRange}
              setDateRange={setDateRange}
              streetName={streetName}
              setStreetName={setStreetName}
              setAreaOfInterestIncidentGeoJson={
                setAreaOfInterestIncidentGeoJson
              }
              incidentGeoJson={incidentGeoJson}
              setIncidentGeoJson={setIncidentGeoJson}
              droppedPin={droppedPin}
              setDroppedPin={setDroppedPin}
              radiusFeet={radiusInFeet}
              setRadiusFeet={setRadiusInFeet}
              setSelectedStreetSegment={setSelectedStreetSegment}
              selectedStreetSegment={selectedStreetSegment}
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
        }}
      >
        <Paper shadow={"xs"} radius={isMobile ? 0 : "md"} p={"sm"} w={"100%"}>
          {isMobile ? (
            <>
              <Drawer.Root
                opened={locationReportIsOpen}
                onClose={closeLocationReport}
                position={"bottom"}
              >
                <Drawer.Content style={{ height: "auto" }}>
                  <Drawer.Header>
                    <Drawer.Title fw={700}>Location Report</Drawer.Title>
                    <Drawer.CloseButton />
                  </Drawer.Header>
                  <Drawer.Body>
                    <LocationReport
                      isLoading={isLoading}
                      setViewport={setViewport}
                      zoomToLayer={zoomToLayer}
                      streetName={streetName}
                      droppedPin={droppedPin}
                      incidentGeoJson={incidentGeoJson}
                      areaOfInterestIncidentGeoJson={
                        areaOfInterestIncidentGeoJson
                      }
                    />
                  </Drawer.Body>
                </Drawer.Content>
              </Drawer.Root>

              <Flex w={"100%"}>
                <Button variant="default" onClick={openLocationReport}>
                  Location Report
                </Button>
              </Flex>
            </>
          ) : (
            <>
              <Text size={"md"} fw={700} mb={"sm"}>
                Location Report
              </Text>
              <LocationReport
                isLoading={isLoading}
                setViewport={setViewport}
                zoomToLayer={zoomToLayer}
                streetName={streetName}
                droppedPin={droppedPin}
                incidentGeoJson={incidentGeoJson}
                areaOfInterestIncidentGeoJson={areaOfInterestIncidentGeoJson}
              />
            </>
          )}
        </Paper>
      </div>
    </main>
  );
}
