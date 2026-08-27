import {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Position,
} from "geojson";

export type RouteDrawingState = {
  status: "idle" | "drawing";
  coordinates: Position[];
};

export type RouteDrawingAction =
  | { type: "start" }
  | { type: "add-vertex"; coordinate: Position }
  | { type: "undo" }
  | { type: "clear" }
  | { type: "cancel" };

export const INITIAL_ROUTE_DRAWING_STATE: RouteDrawingState = {
  status: "idle",
  coordinates: [],
};

export const routeDrawingReducer = (
  state: RouteDrawingState,
  action: RouteDrawingAction,
): RouteDrawingState => {
  switch (action.type) {
    case "start":
      return { status: "drawing", coordinates: [] };
    case "add-vertex":
      return state.status === "drawing"
        ? {
            ...state,
            coordinates: [...state.coordinates, [...action.coordinate]],
          }
        : state;
    case "undo":
      return state.status === "drawing" && state.coordinates.length > 0
        ? { ...state, coordinates: state.coordinates.slice(0, -1) }
        : state;
    case "clear":
      return state.status === "drawing" ? { ...state, coordinates: [] } : state;
    case "cancel":
      return INITIAL_ROUTE_DRAWING_STATE;
  }
};

const featureCollection = <G extends Point | LineString>(
  feature?: Feature<G>,
): FeatureCollection<G> => ({
  type: "FeatureCollection",
  features: feature ? [feature] : [],
});

const lineStringFeature = (coordinates: Position[]): Feature<LineString> => ({
  type: "Feature",
  properties: {},
  geometry: {
    type: "LineString",
    coordinates: coordinates.map((coordinate) => [...coordinate]),
  },
});

export const createRoutePreview = (
  state: RouteDrawingState,
): FeatureCollection<Point | LineString> => {
  if (state.status !== "drawing" || state.coordinates.length === 0) {
    return featureCollection();
  }

  if (state.coordinates.length === 1) {
    return featureCollection({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: [...state.coordinates[0]],
      },
    });
  }

  return featureCollection(lineStringFeature(state.coordinates));
};

export const createFinalRoute = (
  state: RouteDrawingState,
): FeatureCollection<LineString> | null => {
  const [firstCoordinate] = state.coordinates;
  const hasDistinctCoordinate = state.coordinates.some(
    (coordinate) =>
      coordinate[0] !== firstCoordinate?.[0] ||
      coordinate[1] !== firstCoordinate?.[1],
  );

  if (state.coordinates.length < 2 || !hasDistinctCoordinate) {
    return null;
  }

  return featureCollection(lineStringFeature(state.coordinates));
};
