"use client";

import { Map } from "mapbox-gl";
import {
  Layer,
  Map as ReactMap,
  MapRef,
  Popup,
  Source,
} from "react-map-gl/mapbox-legacy";
import React, { forwardRef, useEffect } from "react";
import { Feature, FeatureCollection, GeoJSON, Point } from "geojson";
import { GeoJSONFeature, MapEvent, MapMouseEvent } from "mapbox-gl";
import {
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

const COMPREHENSIVE_UNIT_COSTS_BY_KABCO_SEVERITY = {
  K: 15988000,
  A: 1705100,
  B: 384000,
  C: 204600,
  O: 18100,
};

const summarizeIncidents = (
  features: Feature<Point, Incident>[],
): LocationSummary => {
  const aggregate = features.reduce(
    (acc, f) => {
      let maxSeverity: keyof typeof COMPREHENSIVE_UNIT_COSTS_BY_KABCO_SEVERITY =
        "O";

      const fatalities = f.properties.doti_fatalities;
      const seriousInjuries = f.properties.doti_serious_injuries;

      if (seriousInjuries > 0) {
        maxSeverity = "A";
      }

      if (fatalities > 0) {
        maxSeverity = "K";
      }

      acc.severityCounts["Fatalities"] += fatalities;
      acc.severityCounts["Serious Injuries"] += seriousInjuries;

      if (f.properties.doti_fatalities + f.properties.doti_serious_injuries === 0) {
        acc.severityCounts["Property Damage or Non-Serious Injuries"] += 1;
      }

      acc.comprehensiveCosts +=
        COMPREHENSIVE_UNIT_COSTS_BY_KABCO_SEVERITY[maxSeverity];

      acc.bicyclesInvolved += f.properties.doti_bicycle_count;
      acc.pedestriansInvolved += f.properties.doti_pedestrian_count;

      return acc;
    },
    {
      comprehensiveCosts: 0,
      bicyclesInvolved: 0,
      pedestriansInvolved: 0,
      severityCounts: {
        Fatalities: 0,
        "Serious Injuries": 0,
        "Property Damage or Non-Serious Injuries": 0,
      },
    },
  );

  return {
    totalIncidents: features.length,
    ...aggregate,
  };
};

export const defaultViewport = {
  latitude: 39.74,
  longitude: -104.9874,
  zoom: 13,
};

const API_PATH_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api`;

type Props = {
  incidentGeoJson?: FeatureCollection | null;
  setIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection | null>
  >;
  setStreetName: React.Dispatch<React.SetStateAction<string | null>>;
  areaOfInterestIncidentGeoJson?: FeatureCollection | null;
  setAreaOfInterestIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection | null>
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
  setLocationSummary: React.Dispatch<
    React.SetStateAction<LocationSummary | null>
  >;
  streetName: string | null;
};

export default forwardRef<MapRef | null, Props>(function Map(
  {
    areaOfInterestIncidentGeoJson,
    incidentGeoJson,
    setIncidentGeoJson,
    setAreaOfInterestIncidentGeoJson,
    droppedPin,
    setLocationSummary,
    setDroppedPin,
    startDate,
    endDate,
    radiusFeet,
    streetName,
    setStreetName,
    viewport,
    setViewport,
  },
  mapRef,
) {
  const [selectedPoint, setSelectedPoint] =
    React.useState<GeoJSONFeature | null>(null);

  const loadAllIncidents = false;
  const displayStreetCenterlines = true;

  const [streetCenterlines, setStreetCenterlines] =
    React.useState<FeatureCollection | null>(null);
  const [bufferedStreet, setBufferedStreet] =
    React.useState<FeatureCollection | null>(null);

  const fetchIncidents = React.useCallback(
    (mapTarget: Map) => {
      if (!mapTarget) {
        return;
      }

      const bounds = mapTarget.getBounds();
      if (!bounds) {
        throw new Error("Bounds undefined");
      }

      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ].join(",");

      if (loadAllIncidents) {
        getIncidents({ startDate, endDate, bbox }).then((json) => {
          setIncidentGeoJson(json);
        });
      }

      if (displayStreetCenterlines && streetName) {
        getStreetCenterlines(streetName).then((json) => {
          setStreetCenterlines(json);
        });
      }

      if (displayStreetCenterlines && streetName && radiusFeet >= 0) {
        getBufferedStreetCenterlines({
          streetName,
          bufferInFeet: radiusFeet,
        }).then((json) => {
          setBufferedStreet(json);
        });

        getIncidentsWithinBufferedStreet({
          streetName,
          bufferInFeet: radiusFeet,
          startDate,
          endDate,
        }).then((data) => {
          setAreaOfInterestIncidentGeoJson(data);
          setLocationSummary(summarizeIncidents(data.features));
        });
      }
    },
    [startDate, endDate, streetName, radiusFeet],
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
          setLocationSummary(summarizeIncidents(data.features));
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
      setLocationSummary(null);
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
        setLocationSummary(summarizeIncidents(data.features));
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
        setLocationSummary(summarizeIncidents(data.features));
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
                  [">", ["get", "fatalities"], 0],
                  "#ef4444", // Red (Tailwind red-500)
                  [">", ["get", "serious_injuries"], 0],
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
                  [">", ["get", "fatalities"], 0],
                  "#ef4444", // Red (Tailwind red-500)
                  [">", ["get", "serious_injuries"], 0],
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

export type Incident = {
  doti_incident_id: string | number;
  doti_first_occurrence_date: string;
  doti_address: string | null;
  doti_google_maps_url: string | null;
  doti_neighborhood_id: string | null;
  doti_top_traffic_accident_offense: string | null;
  doti_serious_injuries: number;
  doti_fatalities: number;
  doti_bicycle_involved: boolean;
  doti_bicycle_count: number;
  doti_pedestrian_involved: boolean;
  doti_pedestrian_count: number;

  doti_object_id: number;
  doti_geo: JSON;

  road_location: string | null;
  road_description: string | null;
  road_contour: string | null;
  road_condition: string | null;
  light_condition: string | null;
  tu2_vehicle_type: string | null;
  tu2_travel_direction: string | null;
  tu2_vehicle_movement: string | null;
  tu2_driver_action: string | null;
  tu2_driver_humancontribfactor: string | null;
  tu2_pedestrian_action: string | null;
  fatality_mode_1: string | null;
  fatality_mode_2: string | null;
  seriously_injured_mode_1: string | null;
  seriously_injured_mode_2: string | null;
  doti_data_notes: string | null;
};

export type LocationSummary = {
  totalIncidents: number;
  comprehensiveCosts: number;
  bicyclesInvolved: number;
  pedestriansInvolved: number;
  severityCounts: {
    Fatalities: number;
    "Serious Injuries": number;
    "Property Damage or Non-Serious Injuries": number;
  };
};
