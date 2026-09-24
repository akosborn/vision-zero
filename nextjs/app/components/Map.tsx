"use client";

import { MapMouseEvent } from "mapbox-gl";
import {
  Layer,
  Map as ReactMap,
  MapRef,
  Popup,
  Source,
} from "react-map-gl/mapbox-legacy";
import React, { forwardRef } from "react";
import { Feature, FeatureCollection, GeoJSON, Point } from "geojson";
import { Crash } from "@/app/lib/api-client";
import { severityConfig } from "@/app/components/LocationReport/CrashDetails";
import { getCrashSourceLinks } from "@/app/components/LocationReport/utils/crash-source-links";
import { Filters } from "@/app/page";

const FEET_TO_METERS = 0.3048;

const createGeoJSONCircle = (
  center: {
    lng: number;
    lat: number;
  },
  radiusInKm: number,
  points: number = 64,
): GeoJSON => {
  const coords = {
    latitude: center.lat,
    longitude: center.lng,
  };

  const km = radiusInKm;

  const ret = [];
  const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);

    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]);

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [ret],
    },
    properties: {},
  };
};

export const DEFAULT_VIEWPORT = {
  latitude: 39.74,
  longitude: -104.9874,
  zoom: 13,
};

type Props = {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  incidentGeoJson?: FeatureCollection | null;
  areaOfInterestIncidentGeoJson?: FeatureCollection | null;
  viewport: { latitude: number; longitude: number; zoom: number };
  setViewport: React.Dispatch<
    React.SetStateAction<{ latitude: number; longitude: number; zoom: number }>
  >;
  isLoading: boolean;
  onRadiusSearchPoint: (point: { lng: number; lat: number }) => void;
  streetCenterlines?: FeatureCollection | null;
  bufferedStreet?: FeatureCollection | null;
  isDrawingRoute: boolean;
  drawnRoutePreview?: FeatureCollection | null;
  routeGeometry?: FeatureCollection | null;
  routeSearchArea?: FeatureCollection | null;
  onAddDrawnRouteVertex: (coordinate: [number, number]) => void;
  selectedCrashFeature: Feature<Point, Crash> | null;
  selectedCrashCalloutIsOpen: boolean;
  onCrashSelect: (feature: Feature<Point, Crash> | null) => void;
};

export default forwardRef<MapRef | null, Props>(function Map(
  {
    filters,
    setFilters,
    areaOfInterestIncidentGeoJson,
    incidentGeoJson,
    viewport,
    setViewport,
    isLoading,
    onRadiusSearchPoint,
    streetCenterlines,
    bufferedStreet,
    isDrawingRoute,
    drawnRoutePreview,
    routeGeometry,
    routeSearchArea,
    onAddDrawnRouteVertex,
    selectedCrashFeature,
    selectedCrashCalloutIsOpen,
    onCrashSelect,
  },
  mapRef,
) {
  const onClick = (event: MapMouseEvent) => {
    if (selectedCrashFeature && selectedCrashCalloutIsOpen) {
      onCrashSelect(null);
      return;
    }

    if (isDrawingRoute) {
      const { lng, lat } = event.lngLat;
      onCrashSelect(null);
      onAddDrawnRouteVertex([lng, lat]);
      return;
    }

    const feature = event.features && event.features[0];
    if (feature?.geometry.type === "Point" && feature.properties) {
      onCrashSelect({
        type: "Feature",
        id: feature.id,
        geometry: feature.geometry,
        properties: feature.properties as Crash,
      });
      setFilters((prevState) => ({
        ...prevState,
        droppedPin: undefined,
      }));
    } else {
      if (filters.searchTool === "Draw Route") {
        return;
      }

      if (isLoading) {
        return;
      }

      const { lng, lat } = event.lngLat;
      onCrashSelect(null);
      onRadiusSearchPoint({ lng, lat });
    }
  };

  const radiusGeoJSON = filters.droppedPin
    ? createGeoJSONCircle(
        filters.droppedPin,
        (filters.bufferRadiusInFeet * FEET_TO_METERS) / 1000,
      )
    : null;

  const selectedPointProperties = selectedCrashFeature?.properties as
    | Crash
    | null
    | undefined;
  const selectedPointDotiRecordUrl = selectedPointProperties
    ? getCrashSourceLinks(selectedPointProperties).dotiRecordUrl
    : undefined;

  return (
    <div className="h-full w-full" style={{ height: "100vh", width: "100vw" }}>
      <ReactMap
        {...viewport}
        ref={mapRef}
        onMove={(evt) => setViewport(evt.viewState)}
        onClick={onClick}
        doubleClickZoom={!isDrawingRoute}
        interactiveLayerIds={[
          "incident-layer",
          "area-of-interest-incident-layer",
        ]}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v9"
      >
        {incidentGeoJson && (
          <Source id="incidents" type="geojson" data={incidentGeoJson}>
            <Layer
              id="incident-layer"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": [
                  "case",
                  [">", ["coalesce", ["get", "cdot_number_killed"], 0], 0],
                  severityConfig.K.dotColor, // Red (Tailwind red-500)
                  [">", ["get", "doti_fatalities"], 0],
                  severityConfig.K.dotColor, // Red (Tailwind red-500)
                  [">", ["get", "doti_serious_injuries"], 0],
                  severityConfig.A.dotColor, // Yellow (Tailwind yellow-400)
                  [">", ["coalesce", ["get", "cdot_injury_03"], 0], 0],
                  severityConfig.A.dotColor, // Yellow (Tailwind yellow-400)
                  severityConfig.O.dotColor, // Green
                ],
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        )}

        {areaOfInterestIncidentGeoJson && (
          <Source
            id="area-of-interest-incidents"
            type="geojson"
            data={areaOfInterestIncidentGeoJson}
          >
            <Layer
              id="area-of-interest-incident-layer"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": [
                  "case",
                  [">", ["coalesce", ["get", "cdot_number_killed"], 0], 0],
                  severityConfig.K.dotColor, // Red (Tailwind red-500)
                  [">", ["get", "doti_fatalities"], 0],
                  severityConfig.K.dotColor, // Red (Tailwind red-500)
                  [">", ["get", "doti_serious_injuries"], 0],
                  severityConfig.A.dotColor, // Yellow (Tailwind yellow-400)
                  [">", ["coalesce", ["get", "cdot_injury_03"], 0], 0],
                  severityConfig.A.dotColor, // Yellow (Tailwind yellow-400)
                  severityConfig.O.dotColor, // Green
                ],
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        )}

        {routeSearchArea && (
          <Source
            id="drawn-route-search-area-source"
            type="geojson"
            data={routeSearchArea}
          >
            <Layer
              id="drawn-route-search-area-fill"
              type="fill"
              paint={{
                "fill-color": "#7c3aed",
                "fill-opacity": 0.14,
              }}
            />
            <Layer
              id="drawn-route-search-area-outline"
              type="line"
              paint={{
                "line-color": "#6d28d9",
                "line-width": 2,
                "line-dasharray": [2, 2],
              }}
            />
          </Source>
        )}

        {routeGeometry && (
          <Source id="drawn-route-source" type="geojson" data={routeGeometry}>
            <Layer
              id="drawn-route-line"
              type="line"
              paint={{
                "line-color": "#5b21b6",
                "line-width": 4,
              }}
            />
          </Source>
        )}

        {drawnRoutePreview && (
          <Source
            id="drawn-route-preview-source"
            type="geojson"
            data={drawnRoutePreview}
          >
            <Layer
              id="drawn-route-preview-line"
              type="line"
              filter={["==", ["geometry-type"], "LineString"]}
              paint={{
                "line-color": "#f59e0b",
                "line-width": 3,
                "line-dasharray": [2, 1],
              }}
            />
            <Layer
              id="drawn-route-preview-vertices"
              type="circle"
              filter={["==", ["geometry-type"], "Point"]}
              paint={{
                "circle-color": "#f59e0b",
                "circle-radius": 5,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
              }}
            />
          </Source>
        )}

        {streetCenterlines && (
          <Source type="geojson" data={streetCenterlines}>
            <Layer
              id="street-centerline-layer"
              type="line"
              paint={{
                "line-width": 2,
                "line-color": [
                  "step",
                  ["get", "speedlimit"],
                  "#33ea2d", // Default color (for < 25)
                  26,
                  "#fafa37", // Yellow for 26-34
                  35,
                  "#ff8c00", // Orange for 36-44
                  45,
                  "#ff0000", // Red for 50+
                ],
              }}
            />
          </Source>
        )}

        {bufferedStreet && (
          <Source type="geojson" data={bufferedStreet}>
            {/* The background fill */}
            <Layer
              id="buffered-street-fill"
              type="fill"
              paint={{
                "fill-color": "#3b82f6",
                "fill-opacity": 0.1,
              }}
            />
            {/* The dashed border */}
            <Layer
              id="buffered-street-outline"
              type="line"
              paint={{
                "line-color": "#3b82f6",
                "line-width": 2,
                "line-dasharray": [2, 2],
              }}
            />
          </Source>
        )}

        {radiusGeoJSON && (
          <Source type="geojson" data={radiusGeoJSON}>
            <Layer
              id="radius-fill"
              type="fill"
              paint={{
                "fill-color": "#3b82f6",
                "fill-opacity": 0.1,
              }}
            />
            <Layer
              id="radius-outline"
              type="line"
              paint={{
                "line-color": "#3b82f6",
                "line-width": 2,
                "line-dasharray": [2, 2],
              }}
            />
          </Source>
        )}

        {selectedCrashFeature && (
          <Source
            id="selected-crash-source"
            type="geojson"
            data={selectedCrashFeature}
          >
            <Layer
              id="selected-crash-layer"
              type="circle"
              paint={{
                "circle-radius": 12,
                "circle-color": "#60a5fa",
                "circle-opacity": 0.3,
                "circle-stroke-width": 3,
                "circle-stroke-color": "#1d4ed8",
              }}
            />
          </Source>
        )}

        {selectedCrashFeature && selectedCrashCalloutIsOpen && (
          <Popup
            longitude={selectedCrashFeature.geometry.coordinates[0]}
            latitude={selectedCrashFeature.geometry.coordinates[1]}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            onClose={() => onCrashSelect(null)}
            maxWidth="none"
          >
            <div
              className="p-2 text-black"
              role="region"
              aria-label="Crash details"
              style={{
                maxHeight: "min(35dvh, 20rem)",
                overflowY: "auto",
                overscrollBehavior: "contain",
              }}
            >
              <button
                type="button"
                className="mapboxgl-popup-close-button"
                aria-label="Close popup"
                onClick={(event) => {
                  event.stopPropagation();
                  onCrashSelect(null);
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
              <h3 className="font-bold">Incident Info</h3>
              {selectedPointDotiRecordUrl && (
                <a
                  href={selectedPointDotiRecordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View DOTI source record for ${selectedPointProperties?.doti_incident_id || "this crash"} (opens in a new tab)`}
                  className="text-xs font-medium text-blue-700 underline"
                >
                  View DOTI source record
                </a>
              )}
              <pre className="text-xs">
                {JSON.stringify(selectedCrashFeature.properties, null, 2)}
              </pre>
            </div>
          </Popup>
        )}
      </ReactMap>
    </div>
  );
});
