"use client";

import {
  CircleLayerSpecification,
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapboxGLMap,
  MapMouseEvent,
  SymbolLayerSpecification,
} from "mapbox-gl";
import {
  Layer,
  Map as ReactMap,
  MapRef,
  Popup,
  Source,
} from "react-map-gl/mapbox-legacy";
import React, { forwardRef, useCallback, useState } from "react";
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

const CLUSTER_MAX_ZOOM = 24;
const CLUSTER_RADIUS = 50;

// A cluster_id that can never match a real cluster, used to build a filter
// that matches nothing (i.e. "hide this layer entirely").
const NO_MATCH_CLUSTER_ID = -1;

// Reused so unclustered points and spiderfied ("fanned out") points look identical
const severityCircleColorExpression: ExpressionSpecification = [
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
];

const clusterCirclePaint: CircleLayerSpecification["paint"] = {
  "circle-color": [
    "step",
    ["get", "point_count"],
    "#60a5fa", // < 10 points: light blue
    10,
    "#3b82f6", // 10-49: blue
    50,
    "#1d4ed8", // 50+: dark blue
  ],
  "circle-radius": [
    "step",
    ["get", "point_count"],
    16, // < 10 points
    10,
    22, // 10-49
    50,
    28, // 50+
  ],
  "circle-stroke-width": 2,
  "circle-stroke-color": "#ffffff",
};

const clusterCountLayout: SymbolLayerSpecification["layout"] = {
  "text-field": ["get", "point_count_abbreviated"],
  "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
  "text-size": 12,
};

const clusterCountPaint: SymbolLayerSpecification["paint"] = {
  "text-color": "#ffffff",
};

// Small badge shown at the edge of every cluster bubble hinting that it's
// clickable. Shows "+" for clusters that will expand/fan out on click, and
// swaps to "×" for whichever cluster is currently fanned out, hinting that
// clicking it again will collapse it.
const clusterHintLayout: SymbolLayerSpecification["layout"] = {
  "text-field": "+",
  "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
  "text-size": 11,
  "text-offset": [0.95, -0.95],
  "text-allow-overlap": true,
  "text-ignore-placement": true,
};

const clusterCollapseHintLayout: SymbolLayerSpecification["layout"] = {
  ...clusterHintLayout,
  "text-field": "×",
};

const clusterHintPaint: SymbolLayerSpecification["paint"] = {
  "text-color": "#ffffff",
  "text-halo-color": "#1d4ed8",
  "text-halo-width": 1.5,
};

/**
 * Builds the pair of filters used to show the "+" hint on every cluster
 * except the one currently fanned out (if any), and the "×" hint on just
 * that one.
 */
const buildClusterHintFilters = (
  spiderfiedClusterId: number | null,
): {
  expandFilter: ExpressionSpecification;
  collapseFilter: ExpressionSpecification;
} => {
  if (spiderfiedClusterId == null) {
    return {
      expandFilter: ["has", "point_count"],
      // Matches no real cluster_id, so effectively hides this layer
      collapseFilter: ["==", ["get", "cluster_id"], NO_MATCH_CLUSTER_ID],
    };
  }

  return {
    expandFilter: [
      "all",
      ["has", "point_count"],
      ["!=", ["get", "cluster_id"], spiderfiedClusterId],
    ],
    collapseFilter: [
      "all",
      ["has", "point_count"],
      ["==", ["get", "cluster_id"], spiderfiedClusterId],
    ],
  };
};

/**
 * Given N points that all sit on (or very near) the same spot, returns pixel
 * offsets arranged in one or more concentric rings so each point gets its
 * own clickable position. Ring size grows as more points need to be placed.
 */
const computeSpiderLegOffsets = (
  count: number,
): { dx: number; dy: number }[] => {
  if (count <= 1) return [{ dx: 0, dy: 0 }];

  const offsets: { dx: number; dy: number }[] = [];
  const firstRingRadius = 42;
  const ringSpacing = 30;
  let ring = 0;
  let placed = 0;

  while (placed < count) {
    const radius = firstRingRadius + ring * ringSpacing;
    const pointsInRing = Math.min(
      count - placed,
      Math.max(6, Math.floor((2 * Math.PI * radius) / 28)),
    );
    const angleStep = (2 * Math.PI) / pointsInRing;
    // Stagger each ring's starting angle so rings don't line up radially
    const angleOffset = ring * 0.4;

    for (let i = 0; i < pointsInRing; i++) {
      const angle = angleStep * i + angleOffset;
      offsets.push({
        dx: radius * Math.cos(angle),
        dy: radius * Math.sin(angle),
      });
    }

    placed += pointsInRing;
    ring += 1;
  }

  return offsets.slice(0, count);
};

const CLUSTERED_SOURCE_IDS = [
  "incidents",
  "area-of-interest-incidents",
] as const;
type ClusteredSourceId = (typeof CLUSTERED_SOURCE_IDS)[number];

type SpiderfyState = {
  sourceId: ClusteredSourceId;
  clusterId: number;
  anchor: [number, number];
  legs: { feature: Feature<Point, Crash>; position: [number, number] }[];
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

export default forwardRef<MapRef | null, Props>(function MapComponent(
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
  const [spiderfy, setSpiderfy] = useState<SpiderfyState | null>(null);

  // Track the geojson currently reflected in `spiderfy`, so that if the
  // underlying data changes (new filters, refetch, etc.) we can collapse any
  // fanned-out points during render rather than in an effect.
  const [spiderfySourceIncidentGeoJson, setSpiderfySourceIncidentGeoJson] =
    useState(incidentGeoJson);
  const [
    spiderfySourceAreaOfInterestGeoJson,
    setSpiderfySourceAreaOfInterestGeoJson,
  ] = useState(areaOfInterestIncidentGeoJson);

  if (
    incidentGeoJson !== spiderfySourceIncidentGeoJson ||
    areaOfInterestIncidentGeoJson !== spiderfySourceAreaOfInterestGeoJson
  ) {
    setSpiderfySourceIncidentGeoJson(incidentGeoJson);
    setSpiderfySourceAreaOfInterestGeoJson(areaOfInterestIncidentGeoJson);
    setSpiderfy(null);
  }

  const spiderfyAt = useCallback(
    (
      map: MapboxGLMap,
      sourceId: ClusteredSourceId,
      clusterId: number,
      anchor: [number, number],
      leaves: Feature<Point, Crash>[],
    ) => {
      const centerPx = map.project(anchor);
      const offsets = computeSpiderLegOffsets(leaves.length);

      const legs = leaves.map((leaf, i) => {
        const { dx, dy } = offsets[i];
        const { lng, lat } = map.unproject([centerPx.x + dx, centerPx.y + dy]);
        return { feature: leaf, position: [lng, lat] as [number, number] };
      });

      setSpiderfy({ sourceId, clusterId, anchor, legs });
    },
    [],
  );

  // Shows a pointer cursor over anything clickable (points, clusters, and
  // fanned-out leaves) as a lightweight hint that these respond to clicks.
  const onMouseEnter = (event: MapMouseEvent) => {
    event.target.getCanvas().style.cursor = "pointer";
  };
  const onMouseLeave = (event: MapMouseEvent) => {
    event.target.getCanvas().style.cursor = "";
  };

  const onClick = (event: MapMouseEvent) => {
    const map = event.target;

    if (selectedCrashFeature && selectedCrashCalloutIsOpen) {
      onCrashSelect(null);
      return;
    }

    if (isDrawingRoute) {
      const { lng, lat } = event.lngLat;
      onCrashSelect(null);
      setSpiderfy(null);
      onAddDrawnRouteVertex([lng, lat]);
      return;
    }

    const features = event.features ?? [];

    // 1. Clicked one of the fanned-out ("spiderfied") points
    const spiderfyLeafFeature = features.find(
      (f) => f.layer?.id === "spiderfy-leaf-layer",
    );
    if (
      spiderfyLeafFeature?.geometry.type === "Point" &&
      spiderfyLeafFeature.properties
    ) {
      onCrashSelect({
        type: "Feature",
        id: spiderfyLeafFeature.id,
        geometry: spiderfyLeafFeature.geometry,
        properties: spiderfyLeafFeature.properties as Crash,
      });
      setFilters((prevState) => ({ ...prevState, droppedPin: undefined }));
      setSpiderfy(null);
      return;
    }

    // 2. Clicked a cluster bubble
    const clusterFeature = features.find((f) => f.properties?.cluster);
    if (clusterFeature && clusterFeature.geometry.type === "Point") {
      const clusterId = clusterFeature.properties?.cluster_id as number;
      const sourceId = clusterFeature.layer?.source as
        | ClusteredSourceId
        | undefined;
      const clusterCenter = clusterFeature.geometry.coordinates as [
        number,
        number,
      ];

      if (!sourceId) return;

      // Clicking the cluster that's already fanned out collapses it —
      // this is the toggle-off gesture, matching the "×" hint badge.
      if (
        spiderfy &&
        spiderfy.sourceId === sourceId &&
        spiderfy.clusterId === clusterId
      ) {
        setSpiderfy(null);
        return;
      }

      const source = map.getSource(sourceId) as GeoJSONSource | undefined;
      const pointCount =
        (clusterFeature.properties?.point_count as number) ?? 0;

      if (!source) return;

      source.getClusterExpansionZoom(clusterId, (err, expansionZoom) => {
        if (err) return;
        const currentZoom = map.getZoom();
        const maxZoom = map.getMaxZoom();

        const cannotZoomFurther =
          expansionZoom == null ||
          expansionZoom > maxZoom ||
          expansionZoom <= currentZoom + 0.1;

        if (cannotZoomFurther) {
          // Zooming in further wouldn't break this cluster apart any more
          // (we're already at the map's max zoom, or the points are stacked at
          // literally the same coordinates) — fan them out instead.
          source.getClusterLeaves(
            clusterId,
            Math.min(pointCount, 60),
            0,
            (leavesErr, leaves) => {
              if (leavesErr || !leaves) return;
              spiderfyAt(
                map,
                sourceId,
                clusterId,
                clusterCenter,
                leaves as Feature<Point, Crash>[],
              );
            },
          );
          return;
        }

        setSpiderfy(null);
        map.easeTo({
          center: clusterCenter,
          zoom: Math.min(expansionZoom, maxZoom),
          duration: 400,
        });
      });
      return;
    }

    // 3. Clicked what looks like a single point — check whether other points
    //    are stacked at essentially the same spot, and fan them out if so.
    const pointFeature = features.find(
      (f) =>
        f.geometry.type === "Point" && f.properties && !f.properties.cluster,
    );

    if (pointFeature && pointFeature.geometry.type === "Point") {
      const nearby = map.queryRenderedFeatures(
        [
          [event.point.x - 10, event.point.y - 10],
          [event.point.x + 10, event.point.y + 10],
        ],
        { layers: ["incident-layer", "area-of-interest-incident-layer"] },
      ) as unknown as Feature<Point, Crash>[];

      const uniqueNearby = Array.from(
        new Map(
          nearby.map((f) => [f.id ?? JSON.stringify(f.geometry), f]),
        ).values(),
      ) as unknown as Feature<Point, Crash>[];

      if (uniqueNearby.length > 1) {
        const sourceId = pointFeature.layer?.source as
          | ClusteredSourceId
          | undefined;
        if (sourceId) {
          spiderfyAt(
            map,
            sourceId,
            NO_MATCH_CLUSTER_ID, // not a real cluster — no toggle hint applies
            pointFeature.geometry.coordinates as [number, number],
            uniqueNearby,
          );
          return;
        }
      }

      setSpiderfy(null);
      onCrashSelect({
        type: "Feature",
        id: pointFeature.id,
        geometry: pointFeature.geometry,
        properties: pointFeature.properties as Crash,
      });
      setFilters((prevState) => ({ ...prevState, droppedPin: undefined }));
      return;
    }

    // 4. Clicked empty map
    setSpiderfy(null);

    if (filters.searchTool === "Draw Route") {
      return;
    }

    if (isLoading) {
      return;
    }

    const { lng, lat } = event.lngLat;
    onCrashSelect(null);
    onRadiusSearchPoint({ lng, lat });
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
  const selectedPointPopupProperties = selectedPointProperties
    ? Object.fromEntries(
        Object.entries(selectedPointProperties).filter(
          ([key]) => key !== "line",
        ),
      )
    : null;

  const spiderfyLegsGeoJSON: FeatureCollection | null = spiderfy
    ? {
        type: "FeatureCollection",
        features: spiderfy.legs.map(({ feature, position }, i) => ({
          type: "Feature",
          id: feature.id ?? i,
          geometry: { type: "Point", coordinates: position },
          properties: feature.properties,
        })),
      }
    : null;

  const spiderfyLinesGeoJSON: FeatureCollection | null = spiderfy
    ? {
        type: "FeatureCollection",
        features: spiderfy.legs.map(({ position }, i) => ({
          type: "Feature",
          id: i,
          geometry: {
            type: "LineString",
            coordinates: [spiderfy.anchor, position],
          },
          properties: {},
        })),
      }
    : null;

  const incidentSpiderfiedClusterId =
    spiderfy && spiderfy.sourceId === "incidents" ? spiderfy.clusterId : null;
  const areaOfInterestSpiderfiedClusterId =
    spiderfy && spiderfy.sourceId === "area-of-interest-incidents"
      ? spiderfy.clusterId
      : null;

  const {
    expandFilter: incidentExpandHintFilter,
    collapseFilter: incidentCollapseHintFilter,
  } = buildClusterHintFilters(incidentSpiderfiedClusterId);
  const {
    expandFilter: areaOfInterestExpandHintFilter,
    collapseFilter: areaOfInterestCollapseHintFilter,
  } = buildClusterHintFilters(areaOfInterestSpiderfiedClusterId);

  return (
    <div className="h-full w-full" style={{ height: "100vh", width: "100vw" }}>
      <ReactMap
        {...viewport}
        ref={mapRef}
        onMove={(evt) => setViewport(evt.viewState)}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        doubleClickZoom={!isDrawingRoute}
        interactiveLayerIds={[
          "incident-layer",
          "incident-cluster-layer",
          "area-of-interest-incident-layer",
          "area-of-interest-incident-cluster-layer",
          "spiderfy-leaf-layer",
        ]}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v9"
        maxZoom={22}
      >
        {incidentGeoJson && (
          <Source
            id="incidents"
            type="geojson"
            data={incidentGeoJson}
            cluster
            clusterMaxZoom={CLUSTER_MAX_ZOOM}
            clusterRadius={CLUSTER_RADIUS}
          >
            <Layer
              id="incident-layer"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": severityCircleColorExpression,
                "circle-radius": 6,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
              }}
            />
            <Layer
              id="incident-cluster-layer"
              type="circle"
              filter={["has", "point_count"]}
              paint={clusterCirclePaint}
            />
            <Layer
              id="incident-cluster-count-layer"
              type="symbol"
              filter={["has", "point_count"]}
              layout={clusterCountLayout}
              paint={clusterCountPaint}
            />
            <Layer
              id="incident-cluster-expand-hint-layer"
              type="symbol"
              filter={incidentExpandHintFilter}
              layout={clusterHintLayout}
              paint={clusterHintPaint}
            />
            <Layer
              id="incident-cluster-collapse-hint-layer"
              type="symbol"
              filter={incidentCollapseHintFilter}
              layout={clusterCollapseHintLayout}
              paint={clusterHintPaint}
            />
          </Source>
        )}

        {areaOfInterestIncidentGeoJson && (
          <Source
            id="area-of-interest-incidents"
            type="geojson"
            data={areaOfInterestIncidentGeoJson}
            cluster
            clusterMaxZoom={CLUSTER_MAX_ZOOM}
            clusterRadius={CLUSTER_RADIUS}
          >
            <Layer
              id="area-of-interest-incident-layer"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": severityCircleColorExpression,
                "circle-radius": 6,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
              }}
            />
            <Layer
              id="area-of-interest-incident-cluster-layer"
              type="circle"
              filter={["has", "point_count"]}
              paint={clusterCirclePaint}
            />
            <Layer
              id="area-of-interest-incident-cluster-count-layer"
              type="symbol"
              filter={["has", "point_count"]}
              layout={clusterCountLayout}
              paint={clusterCountPaint}
            />
            <Layer
              id="area-of-interest-incident-cluster-expand-hint-layer"
              type="symbol"
              filter={areaOfInterestExpandHintFilter}
              layout={clusterHintLayout}
              paint={clusterHintPaint}
            />
            <Layer
              id="area-of-interest-incident-cluster-collapse-hint-layer"
              type="symbol"
              filter={areaOfInterestCollapseHintFilter}
              layout={clusterCollapseHintLayout}
              paint={clusterHintPaint}
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

        {spiderfyLinesGeoJSON && (
          <Source
            id="spiderfy-lines-source"
            type="geojson"
            data={spiderfyLinesGeoJSON}
          >
            <Layer
              id="spiderfy-lines-layer"
              type="line"
              paint={{
                "line-color": "#6b7280",
                "line-width": 1.5,
                "line-dasharray": [1, 1],
              }}
            />
          </Source>
        )}

        {spiderfyLegsGeoJSON && (
          <Source
            id="spiderfy-leaves-source"
            type="geojson"
            data={spiderfyLegsGeoJSON}
          >
            <Layer
              id="spiderfy-leaf-layer"
              type="circle"
              paint={{
                "circle-color": severityCircleColorExpression,
                "circle-radius": 7,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
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
            maxWidth="min(24rem, calc(100vw - 2rem))"
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
              <pre
                className="text-xs"
                style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {JSON.stringify(selectedPointPopupProperties, null, 2)}
              </pre>
            </div>
          </Popup>
        )}
      </ReactMap>
    </div>
  );
});
