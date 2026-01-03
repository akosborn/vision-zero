'use client';

import {Layer, Map as ReactMap, Popup, Source} from 'react-map-gl/mapbox-legacy';
import React, {useEffect} from 'react';
import {FeatureCollection, Point} from 'geojson';
import {GeoJSONFeature, MapMouseEvent} from 'mapbox-gl';

export default function Map({ selectedYear }: { selectedYear: number }) {
  const [viewport, setViewport] = React.useState({
    latitude: 39.7392,
    longitude: -104.9903,
    zoom: 13,
  });

  const [incidentGeoJson, setIncidentGeoJson] = React.useState<FeatureCollection | null>(null);
  const [selectedPoint, setSelectedPoint] = React.useState<GeoJSONFeature | null>(null);

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

    fetch(`/api/incidents?bbox=${bbox}&year=${selectedYear}`).then((response) => {
      return response.json();
    }).then((json) => {
      setIncidentGeoJson(json);
    });

    fetch(`/api/street-centerlines?bbox=${bbox}`).then((response) => {
      return response.json();
    }).then((json) => {
      setStreetCenterlines(json);
    });
  }, [selectedYear]);

  useEffect(() => {
    if (mapRef.current) {
        fetchIncidents(mapRef.current.getMap());
    }
  }, [selectedYear, fetchIncidents]);

  const onMoveEnd = React.useCallback((event: MapMouseEvent) => {
    fetchIncidents(event.target);
  }, [fetchIncidents]);

  const onClick = (event: MapMouseEvent) => {
    const feature = event.features && event.features[0];
    if (feature) {
      setSelectedPoint(feature);
    } else {
      setSelectedPoint(null);
    }
  };

  return (
    <div className="h-full w-full">
      <ReactMap
        {...viewport}
        ref={mapRef}
        onMove={evt => setViewport(evt.viewState)}
        onMoveEnd={onMoveEnd}
        onLoad={evt => fetchIncidents(evt.target)}
        onClick={onClick}
        interactiveLayerIds={['incident-layer']}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v9"
      >
        {incidentGeoJson &&
          <Source type={'geojson'} data={incidentGeoJson}>
            <Layer id="incident-layer" type={'circle'} />
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
            }} />
          </Source>
        }

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
