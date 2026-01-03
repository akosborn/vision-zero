'use client';

import {Layer, Map as ReactMap, Popup, Source} from 'react-map-gl/mapbox-legacy';
import React, {useEffect} from 'react';
import {FeatureCollection, Point} from 'geojson';
import {GeoJSONFeature, MapMouseEvent} from 'mapbox-gl';

export default function Map() {
  const [viewport, setViewport] = React.useState({
    latitude: 39.7392,
    longitude: -104.9903,
    zoom: 13,
  });

    const [incidentGeoJson, setIncidentGeoJson] = React.useState<FeatureCollection | null>(null);
    const [selectedPoint, setSelectedPoint] = React.useState<GeoJSONFeature | null>(null);

    const fetchIncidents = React.useCallback((mapTarget: any) => {
        const bounds = mapTarget.getBounds();
        const bbox = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(',');

        console.log('fetching incidents for bbox:', bbox);
        fetch(`/api/incidents?bbox=${bbox}`).then((response) => {
            return response.json();
        }).then((json) => {
            setIncidentGeoJson(json);
        });
    }, []);

    const onMoveEnd = React.useCallback((event: any) => {
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
        <div className="h-screen w-screen">
            <ReactMap
                {...viewport}
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
