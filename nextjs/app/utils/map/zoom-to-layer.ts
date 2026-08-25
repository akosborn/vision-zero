// Function to zoom to a specific GeoJSON data object
import { FeatureCollection, Position } from "geojson";
import { MapInstance } from "react-map-gl/mapbox-legacy";
import { LngLatBounds } from "mapbox-gl";
import _ from "lodash";

const zoomToLayer = (
  map: MapInstance,
  featureCollection?: FeatureCollection | null,
  isMobile?: boolean,
) => {
  if (!featureCollection || !featureCollection.features.length || !map) {
    return;
  }

  const bounds = new LngLatBounds();

  featureCollection.features.forEach((feature) => {
    if (feature.geometry.type === "Point") {
      bounds.extend(feature.geometry.coordinates as [number, number]);
    } else if (feature.geometry.type === "LineString") {
      feature.geometry.coordinates.forEach((coordinate) =>
        bounds.extend(coordinate as [number, number]),
      );
    } else if (feature.geometry.type === "Polygon") {
      const flattened = _.flatten(feature.geometry.coordinates as Position[][]);
      flattened.forEach((coordinate) =>
        bounds.extend(coordinate as [number, number]),
      );
    }
  });

  const padding = isMobile ? MOBILE_PADDING : 40;

  map.fitBounds(bounds, {
    padding,
    duration: 1000,
  });
};

const MOBILE_PADDING = { top: 40, bottom: 400, left: 20, right: 20 };

export default zoomToLayer;
