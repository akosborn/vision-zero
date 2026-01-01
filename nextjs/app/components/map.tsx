'use client';

import {Map as ReactMap} from 'react-map-gl/mapbox-legacy';
import React from 'react';

export default function Map() {
  const [viewport, setViewport] = React.useState({
    latitude: 39.7392,
    longitude: -104.9903,
    zoom: 13,
  });

  return (
    <div className="h-screen w-screen">
      <ReactMap
        {...viewport}
        onMove={evt => setViewport(evt.viewState)}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v9"
      />
    </div>
  );
}
