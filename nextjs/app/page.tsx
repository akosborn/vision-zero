"use client";

import React, { useEffect, useState } from "react";
import Map, { defaultViewport, LocationSummary } from "./components/Map";
import { DateTime } from "luxon";
import "flatpickr/dist/themes/dark.css";
import { SquareX } from "lucide-react";
import { FeatureCollection, Position } from "geojson";
import { LngLatBounds } from "mapbox-gl";
import { MapRef } from "react-map-gl/mapbox-legacy";
import { Alert, AlertDescription } from "@/components/ui/alert";
import _ from "lodash";
import FilterPanel from "@/app/components/FilterPanel";
import LocationReport from "@/app/components/LocationReport";

export default function Home() {
  const mapRef = React.useRef<MapRef | null>(null);

  const [viewport, setViewport] = React.useState(defaultViewport);

  const [dateRange, setDateRange] = useState<
    { from?: string; to?: string } | undefined
  >({
    from: DateTime.now()
      .setZone("America/Denver")
      .minus({ months: 12 })
      .toFormat("yyyy-MM-dd"),
    to: DateTime.now().setZone("America/Denver").toFormat("yyyy-MM-dd"),
  });
  const [radiusFeet, setRadiusFeet] = useState(20);

  const [streetName, setStreetName] = useState<string | null>(null);
  const [areaOfInterestIncidentGeoJson, setAreaOfInterestIncidentGeoJson] =
    React.useState<FeatureCollection | null>(null);

  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [droppedPin, setDroppedPin] = React.useState<{
    lng: number;
    lat: number;
  } | null>({
    lng: defaultViewport.longitude,
    lat: defaultViewport.latitude,
  });
  const [incidentGeoJson, setIncidentGeoJson] =
    React.useState<FeatureCollection | null>(null);

  const [locationSummary, setLocationSummary] =
    React.useState<LocationSummary | null>(null);

  const [getStartedInfoIsOpen, setGetStartedInfoIsOpen] = React.useState(true);

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
    <main className="relative flex h-screen w-screen overflow-hidden">
      {/* Map Area */}
      <div className="absolute inset-0">
        <Map
          droppedPin={droppedPin}
          setLocationSummary={setLocationSummary}
          setDroppedPin={setDroppedPin}
          startDate={dateRange?.from}
          endDate={dateRange?.to}
          radiusFeet={radiusFeet}
          streetName={streetName}
          viewport={viewport}
          setViewport={setViewport}
          ref={mapRef}
          areaOfInterestIncidentGeoJson={areaOfInterestIncidentGeoJson}
          setAreaOfInterestIncidentGeoJson={setAreaOfInterestIncidentGeoJson}
          setStreetName={setStreetName}
          incidentGeoJson={incidentGeoJson}
          setIncidentGeoJson={setIncidentGeoJson}
        />
      </div>

      {/* Top Filter Panel Overlay */}
      <div
        className={
          "absolute top-4 left-4 right-4 md:top-6 md:left-6 md:right-auto z-10 flex items-start flex-col gap-2"
        }
      >
        <div className="flex flex-row items-stretch md:items-center gap-3 md:gap-6 p-3 md:p-4 rounded-lg shadow-xl bg-background text-foreground w-full md:w-auto">
          <FilterPanel
            calendarOpen={calendarOpen}
            setCalendarOpen={setCalendarOpen}
            dateRange={dateRange}
            setDateRange={setDateRange}
            streetName={streetName}
            setStreetName={setStreetName}
            setAreaOfInterestIncidentGeoJson={setAreaOfInterestIncidentGeoJson}
            incidentGeoJson={incidentGeoJson}
            setIncidentGeoJson={setIncidentGeoJson}
            setLocationSummary={setLocationSummary}
            droppedPin={droppedPin}
            setDroppedPin={setDroppedPin}
          />
        </div>
        {getStartedInfoIsOpen && (
          <div className="flex items-center w-full md:w-auto">
            <Alert className="py-2 px-3">
              <SquareX
                className="h-4 w-4 cursor-pointer"
                onClick={() => setGetStartedInfoIsOpen(false)}
              />
              <AlertDescription className="text-xs md:text-sm">
                To get started, select an area of interest or click anywhere on
                the map.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {/* Location Summary Overlay */}
      <div className="absolute bottom-0 left-0 right-0 md:bottom-6 md:left-6 md:right-auto max-h-[40vh] md:max-h-[70vh] overflow-y-auto z-10 flex flex-col p-4 rounded-t-xl md:rounded-lg shadow-2xl bg-background text-foreground border-t md:border-none">
        <LocationReport
          radiusFeet={radiusFeet}
          setRadiusFeet={setRadiusFeet}
          locationSummary={locationSummary}
          setViewport={setViewport}
          zoomToLayer={zoomToLayer}
          streetName={streetName}
          droppedPin={droppedPin}
          incidentGeoJson={incidentGeoJson}
          areaOfInterestIncidentGeoJson={areaOfInterestIncidentGeoJson}
        />
      </div>

      {/* Legend Overlay - Hidden on very small screens or moved */}
      <div className="hidden sm:block absolute bottom-6 right-6 z-10 p-3 md:p-4 rounded-lg shadow-xl bg-background text-foreground border md:border-none">
        <h3 className="text-[10px] md:text-xs font-semibold mb-2 md:mb-3 tracking-wider uppercase">
          Crash Severity
        </h3>
        <div className="space-y-1 md:space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white/20"></span>
            <span className="text-sm">Fatality</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#facc15] border border-white/20"></span>
            <span className="text-sm">Serious Injury</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#22c55e] border border-white/20"></span>
            <span className="text-sm">
              Minor Injury or Only Property Damage
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
