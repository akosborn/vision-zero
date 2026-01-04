'use client';

import {Layer, Map as ReactMap, Popup, Source} from 'react-map-gl/mapbox-legacy';
import React, {useEffect} from 'react';
import {Feature, FeatureCollection, GeoJSON, Point} from 'geojson';
import {GeoJSONFeature, MapEvent, MapMouseEvent} from 'mapbox-gl';

const FEET_TO_METERS = 0.3048;

const createGeoJSONCircle = (center: {
  lng: number,
  lat: number
}, radiusInKm: number, points: number = 64): GeoJSON => {
  const coords = {
    latitude: center.lat,
    longitude: center.lng
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
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [ret]
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

const summarizeIncidents = (features: Feature<Point, Incident>[]): LocationSummary => {
  const aggregate = features.reduce((acc, f) => {
    let maxSeverity: keyof typeof COMPREHENSIVE_UNIT_COSTS_BY_KABCO_SEVERITY = 'O';

    const fatalities = f.properties.fatalities;
    const seriousInjuries = f.properties.serious_injuries;

    if (seriousInjuries > 0) {
      maxSeverity = 'A';
    }

    if (fatalities > 0) {
      maxSeverity = 'K';
    }

    acc.severityCounts['Fatalities'] += fatalities;
    acc.severityCounts['Serious Injuries'] += seriousInjuries;

    if (f.properties.fatalities + f.properties.serious_injuries === 0) {
      acc.severityCounts['Property Damage or Non-Serious Injuries'] += 1;
    }

    acc.comprehensiveCosts += COMPREHENSIVE_UNIT_COSTS_BY_KABCO_SEVERITY[maxSeverity];

    acc.bicyclesInvolved += f.properties.bicycle_count;
    acc.pedestriansInvolved += f.properties.pedestrian_count;

    return acc;
  }, {
    comprehensiveCosts: 0,
    bicyclesInvolved: 0,
    pedestriansInvolved: 0,
    severityCounts: {
      'Fatalities': 0,
      'Serious Injuries': 0,
      'Property Damage or Non-Serious Injuries': 0,
    },
  });

  return {
    totalIncidents: features.length,
    ...aggregate,
  };
};

export const defaultViewport = {
  latitude: 39.7400,
  longitude: -104.9874,
  zoom: 16,
};

export default function Map({
                              droppedPin,
                              locationSummary,
                              setLocationSummary,
                              setDroppedPin,
                              startDate,
                              endDate,
                              radiusFeet
                            }: {
  startDate?: string, endDate?: string, radiusFeet: number, droppedPin?: { lng: number, lat: number } | null;
  setDroppedPin: React.Dispatch<React.SetStateAction<{ lng: number, lat: number } | null>>
  locationSummary: LocationSummary | null;
  setLocationSummary: React.Dispatch<React.SetStateAction<LocationSummary | null>>,
}) {
  const [viewport, setViewport] = React.useState(defaultViewport);

  const [incidentGeoJson, setIncidentGeoJson] = React.useState<FeatureCollection | null>(null);
  const [selectedPoint, setSelectedPoint] = React.useState<GeoJSONFeature | null>(null);

  const loadAllIncidents = false;
  const displayStreetCenterlines = false;

  const [streetCenterlines, setStreetCenterlines] = React.useState<FeatureCollection | null>(null);

  const mapRef = React.useRef<any>(null);

  const fetchIncidents = React.useCallback((mapTarget: any) => {
    if (!mapTarget) {
      return;
    }

    const bounds = mapTarget.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ].join(',');

    if (loadAllIncidents) {
      fetch(`/api/incidents?bbox=${bbox}&startDate=${startDate}&endDate=${endDate}`).then((response) => {
        return response.json();
      }).then((json) => {
        setIncidentGeoJson(json);
      });
    }

    if (displayStreetCenterlines) {
      fetch(`/api/street-centerlines?bbox=${bbox}`).then((response) => {
        return response.json();
      }).then((json) => {
        setStreetCenterlines(json);
      });
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (mapRef.current) {
      fetchIncidents(mapRef.current.getMap());

      const radiusMeters = radiusFeet * FEET_TO_METERS;
      fetch(`/api/incidents?lat=${droppedPin.lat}&lng=${droppedPin.lng}&radius=${radiusMeters}&startDate=${startDate}&endDate=${endDate}`)
        .then(res => res.json())
        .then(data => {
          setIncidentGeoJson(data);
          setLocationSummary(summarizeIncidents(data.features));
        });
    }
  }, [startDate, endDate, fetchIncidents]);

  // useEffect(() => {
  //   if (!droppedPin) {
  //     return;
  //   }
  //
  //   if (!startDate || !endDate) {
  //     return;
  //   }
  //
  //   const lng = droppedPin.lng;
  //   const lat = droppedPin.lat;
  //   const radiusMeters = radiusFeet * FEET_TO_METERS;
  //
  //   setLocationSummary(null);
  //   fetch(`/api/incidents?lat=${lat}&lng=${lng}&radius=${radiusMeters}&startDate=${startDate}&endDate=${endDate}`)
  //     .then(res => res.json())
  //     .then(data => {
  //       setLocationSummary(summarizeIncidents(data.features));
  //     });
  // }, [startDate, endDate, radiusFeet, droppedPin]);

  const onMoveEnd = React.useCallback((event: MapMouseEvent) => {
    if (!loadAllIncidents) {
      return;
    }

    fetchIncidents(event.target);
  }, [fetchIncidents]);

  const onClick = (event: MapMouseEvent) => {
    const feature = event.features && event.features[0];
    if (feature) {
      setSelectedPoint(feature);
      setDroppedPin(null);
    } else {
      const {lng, lat} = event.lngLat;
      setDroppedPin({lng, lat});
      setSelectedPoint(null);

      const radiusMeters = radiusFeet * FEET_TO_METERS;

      fetch(`/api/incidents?lat=${lat}&lng=${lng}&radius=${radiusMeters}&startDate=${startDate}&endDate=${endDate}`)
        .then(res => res.json())
        .then(data => {
          setIncidentGeoJson(data);
          setLocationSummary(summarizeIncidents(data.features));
        });
    }
  };

  const radiusGeoJSON = droppedPin ? createGeoJSONCircle(droppedPin, (radiusFeet * FEET_TO_METERS) / 1000) : null;

  const onLoad = (event: MapEvent) => {
    if (!loadAllIncidents && droppedPin && radiusFeet > 0) {
      const radiusMeters = radiusFeet * FEET_TO_METERS;

      fetch(`/api/incidents?lat=${droppedPin.lat}&lng=${droppedPin.lng}&radius=${radiusMeters}&startDate=${startDate}&endDate=${endDate}`)
        .then(res => res.json())
        .then(data => {
          setIncidentGeoJson(data);
          setLocationSummary(summarizeIncidents(data.features));
        });
      return;
    }

    const map = event.target;
    fetchIncidents(map);
  };

  return (
    <div className="h-full w-full">
      <ReactMap
        {...viewport}
        ref={mapRef}
        onMove={evt => setViewport(evt.viewState)}
        onMoveEnd={onMoveEnd}
        onLoad={onLoad}
        onClick={onClick}
        interactiveLayerIds={['incident-layer']}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v9"
      >
        {incidentGeoJson &&
            <Source
                id="incidents"
                type="geojson"
                data={incidentGeoJson}
            >
                <Layer
                    id="incident-layer"
                    type="circle"
                    filter={['!', ['has', 'point_count']]}
                    paint={{
                      'circle-color': [
                        'case',
                        ['>', ['get', 'fatalities'], 0],
                        '#ef4444', // Red (Tailwind red-500)
                        ['>', ['get', 'serious_injuries'], 0],
                        '#facc15', // Yellow (Tailwind yellow-400)
                        '#22c55e'  // Green
                      ],
                      'circle-stroke-width': 1,
                      'circle-stroke-color': '#ffffff'
                    }}
                />
            </Source>
        }

        {streetCenterlines &&
            <Source type={'geojson'} data={streetCenterlines}>
                <Layer id="street-centerline-layer" type={'line'} paint={{
                  'line-width': 2,
                  'line-color': [
                    'step',
                    ['get', 'speedlimit'],
                    '#33ea2d', // Default color (for < 25)
                    26, '#fafa37', // Yellow for 26-34
                    35, '#ff8c00', // Orange for 36-44
                    45, '#ff0000'  // Red for 50+
                  ]
                }}/>
            </Source>
        }

        {radiusGeoJSON && (
          <Source type="geojson" data={radiusGeoJSON}>
            <Layer
              id="radius-fill"
              type="fill"
              paint={{
                'fill-color': '#3b82f6',
                'fill-opacity': 0.1
              }}
            />
            <Layer
              id="radius-outline"
              type="line"
              paint={{
                'line-color': '#3b82f6',
                'line-width': 2,
                'line-dasharray': [2, 2]
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
            maxWidth={'none'}
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
}

type Incident = {
  incident_id: string | number;
  first_occurrence_date: string | Date;
  address: string | null;
  google_maps_url: string | null;
  neighborhood_id: string | null;
  top_traffic_accident_offense: string | null;
  serious_injuries: number;
  fatalities: number;
  bicycle_involved: boolean;
  bicycle_count: number;
  pedestrian_involved: boolean;
  pedestrian_count: number;
  tu1_vehicle_movement: string | null;
  tu1_driver_action: string | null;
  tu1_driver_humancontribfactor: string | null;
  tu1_pedestrian_action: string | null;
  tu1_vehicle_type: string | null;
  tu1_travel_direction: string | null;
  harmful_event_seq_1: string | null;
  harmful_event_seq_2: string | null;
  harmful_event_seq_3: string | null;
  object_id: number;
  offense_id: string | number;
  offense_code: string | number;
  offense_code_extension: string | number;
  reported_date: string | Date;
  geo: any; // Typically GeoJSON or WKT string depending on driver
  geo_x: number | null;
  geo_y: number | null;
  geo_lon: number | null;
  geo_lat: number | null;
  district_id: string | null;
  precinct_id: string | null;
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
  data_notes: string | null;
};

export type LocationSummary = {
  totalIncidents: number;
  comprehensiveCosts: number;
  bicyclesInvolved: number;
  pedestriansInvolved: number;
  severityCounts: { Fatalities: number; 'Serious Injuries': number; 'Property Damage or Non-Serious Injuries': number },
};
