"use client";

import {GeoJSONFeature, Map, MapEvent, MapMouseEvent} from "mapbox-gl";
import {Layer, Map as ReactMap, MapRef, Popup, Source,} from "react-map-gl/mapbox-legacy";
import React, {forwardRef, useEffect} from "react";
import {FeatureCollection, GeoJSON, Point} from "geojson";
import {
  Crash,
  getBufferedStreetCenterlines,
  getIncidents,
  getIncidentsWithinBufferedStreet,
  getStreetCenterlines,
} from "@/app/lib/api-client";

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

export const defaultViewport = {
  latitude: 39.74,
  longitude: -104.9874,
  zoom: 13,
};

type Props = {
  incidentGeoJson?: FeatureCollection | null;
  setIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection<Point, Crash> | null>
  >;
  setStreetName: React.Dispatch<React.SetStateAction<string | null>>;
  areaOfInterestIncidentGeoJson?: FeatureCollection | null;
  setAreaOfInterestIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection<Point, Crash> | null>
  >;
  viewport: { latitude: number; longitude: number; zoom: number };
  setViewport: React.Dispatch<
    React.SetStateAction<{ latitude: number; longitude: number; zoom: number }>
  >;
  startDate?: string;
  endDate?: string;
  radiusFeet: number;
  droppedPin?: { lng: number; lat: number } | null;
  setDroppedPin: React.Dispatch<
    React.SetStateAction<{ lng: number; lat: number } | null>
  >;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  streetName: string | null;
  selectedStreetSegment: {
    fullName?: string;
    crossStreets?: { from?: string; to?: string };
  } | null;
  setSelectedStreetSegment: React.Dispatch<
    React.SetStateAction<{
      fullName?: string;
      crossStreets?: { from?: string; to?: string };
    } | null>
  >;
};

export default forwardRef<MapRef | null, Props>(function Map(
  {
    areaOfInterestIncidentGeoJson,
    incidentGeoJson,
    setIncidentGeoJson,
    setIsLoading,
    setAreaOfInterestIncidentGeoJson,
    droppedPin,
    setDroppedPin,
    startDate,
    endDate,
    radiusFeet,
    streetName,
    setStreetName,
    viewport,
    setViewport,
    selectedStreetSegment,
    setSelectedStreetSegment,
  },
  mapRef,
) {
  const [selectedPoint, setSelectedPoint] =
    React.useState<GeoJSONFeature | null>(null);

  const loadAllIncidents = false;

  const [streetCenterlines, setStreetCenterlines] =
    React.useState<FeatureCollection | null>(null);
  const [bufferedStreet, setBufferedStreet] =
    React.useState<FeatureCollection | null>(null);

  const fetchIncidents = React.useCallback(
    async (mapTarget: Map) => {
      if (!mapTarget) {
        return;
      }

      if (radiusFeet >= 0 && selectedStreetSegment && selectedStreetSegment.fullName) {
        setIsLoading(true);
        const centerlines = await getStreetCenterlines(selectedStreetSegment);
        setStreetCenterlines(centerlines);

        const fullName = selectedStreetSegment.fullName

        const buffer = await getBufferedStreetCenterlines({
          ...selectedStreetSegment,
          fullName,
          bufferInFeet: radiusFeet,
        });
        setBufferedStreet(buffer);

        const incidentsInBuffer = await getIncidentsWithinBufferedStreet({
          ...selectedStreetSegment,
          fullStreetName: fullName,
          bufferInFeet: radiusFeet,
          startDate,
          endDate,
        });
        setAreaOfInterestIncidentGeoJson(incidentsInBuffer);
        setIsLoading(false);
      }
    },
    [startDate, endDate, selectedStreetSegment, radiusFeet],
  );

  useEffect(() => {
    if (mapRef && "current" in mapRef && mapRef.current) {
      fetchIncidents(mapRef.current.getMap());

      if (droppedPin) {
        getIncidents({
          startDate,
          endDate,
          lat: droppedPin.lat,
          lng: droppedPin.lng,
          radiusInFeet: radiusFeet,
        }).then((data) => {
          setIncidentGeoJson(data);
        });
      }
    }
  }, [startDate, endDate, fetchIncidents]);

  const onMoveEnd = React.useCallback(
    (event: MapMouseEvent) => {
      if (!loadAllIncidents) {
        return;
      }

      fetchIncidents(event.target);
    },
    [fetchIncidents],
  );

  const onClick = (event: MapMouseEvent) => {
    const feature = event.features && event.features[0];
    if (feature) {
      setSelectedPoint(feature);
      setDroppedPin(null);
    } else {
      setStreetName("");
      setAreaOfInterestIncidentGeoJson(null);
      setIncidentGeoJson(null);
      setStreetCenterlines(null);
      setBufferedStreet(null);
      const { lng, lat } = event.lngLat;
      setDroppedPin({ lng, lat });
      setSelectedPoint(null);

      getIncidents({
        startDate,
        endDate,
        lat,
        lng,
        radiusInFeet: radiusFeet,
      }).then((data) => {
        setIncidentGeoJson(data);
      });
    }
  };

  const radiusGeoJSON = droppedPin
    ? createGeoJSONCircle(droppedPin, (radiusFeet * FEET_TO_METERS) / 1000)
    : null;

  const onLoad = (event: MapEvent) => {
    if (!loadAllIncidents && droppedPin && radiusFeet > 0) {
      getIncidents({
        startDate,
        endDate,
        lat: droppedPin.lat,
        lng: droppedPin.lng,
        radiusInFeet: radiusFeet,
      }).then((data) => {
        setIncidentGeoJson(data);
      });
      return;
    }

    const map = event.target;
    fetchIncidents(map);
  };

  return (
    <div className="h-full w-full" style={{ height: "100vh", width: "100vw" }}>
      <ReactMap
        {...viewport}
        ref={mapRef}
        onMove={(evt) => setViewport(evt.viewState)}
        onMoveEnd={onMoveEnd}
        onLoad={onLoad}
        onClick={onClick}
        interactiveLayerIds={["incident-layer"]}
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
                  "#ef4444", // Red (Tailwind red-500)
                  [">", ["get", "doti_fatalities"], 0],
                  "#ef4444", // Red (Tailwind red-500)
                  [">", ["get", "doti_serious_injuries"], 0],
                  "#facc15", // Yellow (Tailwind yellow-400)
                  [">", ["coalesce", ["get", "cdot_number_injured"], 0], 0],
                  "#facc15", // Yellow (Tailwind yellow-400)
                  "#22c55e", // Green
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
                  "#ef4444", // Red (Tailwind red-500)
                  [">", ["get", "doti_fatalities"], 0],
                  "#ef4444", // Red (Tailwind red-500)
                  [">", ["get", "doti_serious_injuries"], 0],
                  "#facc15", // Yellow (Tailwind yellow-400)
                  [">", ["coalesce", ["get", "cdot_number_injured"], 0], 0],
                  "#facc15", // Yellow (Tailwind yellow-400)
                  "#22c55e", // Green
                ],
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        )}

        {streetCenterlines && (
          <Source type={"geojson"} data={streetCenterlines}>
            <Layer
              id="street-centerline-layer"
              type={"line"}
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
          <Source type={"geojson"} data={bufferedStreet}>
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

        {selectedPoint && (
          <Popup
            longitude={(selectedPoint.geometry as Point).coordinates[0]}
            latitude={(selectedPoint.geometry as Point).coordinates[1]}
            anchor="bottom"
            onClose={() => setSelectedPoint(null)}
            maxWidth={"none"}
          >
            <div className="p-2 text-black">
              <h3 className="font-bold">Incident Info</h3>
              <pre className="text-xs">
                {JSON.stringify(selectedPoint.properties, null, 2)}
              </pre>
            </div>
          </Popup>
        )}
      </ReactMap>
    </div>
  );
});
