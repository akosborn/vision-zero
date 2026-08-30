import buffer from "@turf/buffer";
import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";

type DateRange = { from?: string; to?: string } | undefined;

export const prepareRouteSearch = (
  candidateRoute: FeatureCollection<Geometry | null, GeoJsonProperties>,
  bufferInFeet: number,
  dateRange: DateRange,
) => {
  const route: FeatureCollection<Geometry, GeoJsonProperties> = {
    type: "FeatureCollection",
    features: candidateRoute.features.filter(
      (feature): feature is Feature<Geometry, GeoJsonProperties> =>
        !!feature.geometry,
    ),
  };

  if (bufferInFeet < 0 || route.features.length === 0) {
    return null;
  }

  return {
    request: {
      route,
      bufferInFeet,
      startDate: dateRange?.from,
      endDate: dateRange?.to,
    },
    route,
    searchArea: buffer(route, bufferInFeet, { units: "feet" }) || null,
  };
};
