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
import { Alert, Button, Drawer, em, Paper, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import LocationReport from "@/app/components/LocationReport";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { Crash } from "@/app/lib/api-client";

export default function Home() {
  const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

  const mapRef = React.useRef<MapRef | null>(null);

  const [viewport, setViewport] = React.useState(defaultViewport);

  const [isLoading, setIsLoading] = useState(false);

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

  const [opened, { open, close }] = useDisclosure(true);

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
        height: "100vh",
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
        />
      </div>

      {/* Top Filter Panel Overlay */}
      <div
        className={
          "absolute top-4 left-4 right-4 md:top-6 md:left-6 md:right-auto z-10 flex items-start flex-col gap-2"
        }
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          right: "1rem",
          zIndex: 10,
          display: "flex",
          alignItems: "start",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <Paper
          shadow={"xs"}
          radius={"md"}
          p={"sm"}
          className="flex flex-row items-stretch md:items-center gap-3 md:gap-6 p-3 md:p-4 rounded-lg shadow-xl bg-background text-foreground w-full md:w-auto"
        >
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
              To get started, select an area of interest or click anywhere on
              the map.
            </Alert>
          )}
          <FilterPanel
            dateRange={dateRange}
            setDateRange={setDateRange}
            streetName={streetName}
            setStreetName={setStreetName}
            setAreaOfInterestIncidentGeoJson={setAreaOfInterestIncidentGeoJson}
            incidentGeoJson={incidentGeoJson}
            setIncidentGeoJson={setIncidentGeoJson}
            droppedPin={droppedPin}
            setDroppedPin={setDroppedPin}
            radiusFeet={radiusInFeet}
            setRadiusFeet={setRadiusInFeet}
          />
        </Paper>
      </div>

      {/* Location Summary Overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 md:bottom-6 md:left-6 md:right-auto max-h-[40vh] md:max-h-[70vh] overflow-y-auto z-10 flex flex-col p-4 rounded-t-xl md:rounded-lg shadow-2xl bg-background text-foreground border-t md:border-none"
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
          minWidth: isMobile ? "100%" : "30vw",
          maxWidth: isMobile ? "100%" : "70%",
        }}
      >
        {isMobile ? (
          <>
            <Drawer.Root opened={opened} onClose={close} position={"bottom"}>
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

            <Button variant="default" onClick={open}>
              Open Location Report
            </Button>
          </>
        ) : (
          <Paper
            shadow={"xs"}
            radius={"md"}
            p={"sm"}
            w={"100%"}
            className="flex flex-row items-stretch md:items-center gap-3 md:gap-6 p-3 md:p-4 rounded-lg shadow-xl bg-background text-foreground w-full md:w-auto"
          >
            <Text size={"md"} fw={700} mb={'sm'}>
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
          </Paper>
        )}
      </div>

      {/*/!* Legend Overlay - Hidden on very small screens or moved *!/*/}
      {/*<div className="hidden sm:block absolute bottom-6 right-6 z-10 p-3 md:p-4 rounded-lg shadow-xl bg-background text-foreground border md:border-none">*/}
      {/*  <h3 className="text-[10px] md:text-xs font-semibold mb-2 md:mb-3 tracking-wider uppercase">*/}
      {/*    Crash Severity*/}
      {/*  </h3>*/}
      {/*  <div className="space-y-1 md:space-y-2">*/}
      {/*    <div className="flex items-center gap-3">*/}
      {/*      <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white/20"></span>*/}
      {/*      <span className="text-sm">Fatality</span>*/}
      {/*    </div>*/}
      {/*    <div className="flex items-center gap-3">*/}
      {/*      <span className="w-3 h-3 rounded-full bg-[#facc15] border border-white/20"></span>*/}
      {/*      <span className="text-sm">Serious Injury</span>*/}
      {/*    </div>*/}
      {/*    <div className="flex items-center gap-3">*/}
      {/*      <span className="w-3 h-3 rounded-full bg-[#22c55e] border border-white/20"></span>*/}
      {/*      <span className="text-sm">*/}
      {/*        Minor Injury or Only Property Damage*/}
      {/*      </span>*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*</div>*/}
    </main>
  );
}
