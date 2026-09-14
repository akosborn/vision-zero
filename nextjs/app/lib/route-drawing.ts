import {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Position,
} from "geojson";

export type RouteDrawingState = {
  status: "idle" | "drawing";
  completedLines: Position[][];
  coordinates: Position[];
};

export type RouteDrawingAction =
  | { type: "start" }
  | { type: "new-line" }
  | { type: "add-vertex"; coordinate: Position }
  | { type: "undo" }
  | { type: "clear" }
  | { type: "cancel" };

export const INITIAL_ROUTE_DRAWING_STATE: RouteDrawingState = {
  status: "idle",
  completedLines: [],
  coordinates: [],
};

export const isValidRouteLine = (coordinates: Position[]): boolean => {
  const [first] = coordinates;
  return (
    coordinates.length >= 2 &&
    coordinates.some(
      (coordinate) => coordinate[0] !== first[0] || coordinate[1] !== first[1],
    )
  );
};

export const routeDrawingReducer = (
  state: RouteDrawingState,
  action: RouteDrawingAction,
): RouteDrawingState => {
  switch (action.type) {
    case "start":
      return { status: "drawing", completedLines: [], coordinates: [] };
    case "new-line":
      return state.status === "drawing" && isValidRouteLine(state.coordinates)
        ? {
            ...state,
            completedLines: [...state.completedLines, state.coordinates],
            coordinates: [],
          }
        : state;
    case "add-vertex":
      return state.status === "drawing"
        ? {
            ...state,
            coordinates: [...state.coordinates, [...action.coordinate]],
          }
        : state;
    case "undo":
      if (state.status !== "drawing") return state;
      if (state.coordinates.length > 0) {
        return { ...state, coordinates: state.coordinates.slice(0, -1) };
      }
      // Undo a line break by returning to the previous line for editing.
      return state.completedLines.length > 0
        ? {
            ...state,
            coordinates: state.completedLines[state.completedLines.length - 1],
            completedLines: state.completedLines.slice(0, -1),
          }
        : state;
    case "clear":
      return state.status === "drawing"
        ? { ...state, completedLines: [], coordinates: [] }
        : state;
    case "cancel":
      return INITIAL_ROUTE_DRAWING_STATE;
  }
};

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
  const features: Feature<Point | LineString>[] = [];
  if (state.status === "drawing") {
    features.push(...state.completedLines.map(lineStringFeature));
    if (state.coordinates.length === 1) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [...state.coordinates[0]] },
      });
    } else if (state.coordinates.length > 1) {
      features.push(lineStringFeature(state.coordinates));
    }
  }
  return { type: "FeatureCollection", features };
};

export const createFinalRoute = (
  state: RouteDrawingState,
): FeatureCollection<LineString> | null => {
  if (state.status !== "drawing") return null;
  const lines = [...state.completedLines];
  if (state.coordinates.length > 0) lines.push(state.coordinates);
  if (lines.length === 0 || !lines.every(isValidRouteLine)) return null;
  return { type: "FeatureCollection", features: lines.map(lineStringFeature) };
};
