import { describe, expect, it } from "vitest";

import {
  createFinalRoute,
  createRoutePreview,
  INITIAL_ROUTE_DRAWING_STATE,
  routeDrawingReducer,
  RouteDrawingState,
} from "./route-drawing";

const firstCoordinate = [-104.99, 39.74];
const secondCoordinate = [-104.98, 39.75];

const drawingState = (...coordinates: number[][]): RouteDrawingState => ({
  status: "drawing",
  coordinates,
  completedLines: [],
});

describe("route drawing state", () => {
  it("starts an empty drawing explicitly", () => {
    expect(
      routeDrawingReducer(drawingState(firstCoordinate, secondCoordinate), {
        type: "start",
      }),
    ).toEqual({ status: "drawing", coordinates: [], completedLines: [] });
  });

  it("adds copied vertices in order only while drawing", () => {
    const coordinate = [...firstCoordinate];
    const started = routeDrawingReducer(INITIAL_ROUTE_DRAWING_STATE, {
      type: "start",
    });
    const withFirstVertex = routeDrawingReducer(started, {
      type: "add-vertex",
      coordinate,
    });
    const withSecondVertex = routeDrawingReducer(withFirstVertex, {
      type: "add-vertex",
      coordinate: secondCoordinate,
    });

    coordinate[0] = 0;

    expect(withSecondVertex).toEqual(
      drawingState(firstCoordinate, secondCoordinate),
    );
    expect(
      routeDrawingReducer(INITIAL_ROUTE_DRAWING_STATE, {
        type: "add-vertex",
        coordinate: firstCoordinate,
      }),
    ).toBe(INITIAL_ROUTE_DRAWING_STATE);
  });

  it("undoes the most recent vertex without leaving drawing mode", () => {
    const state = drawingState(firstCoordinate, secondCoordinate);

    expect(routeDrawingReducer(state, { type: "undo" })).toEqual(
      drawingState(firstCoordinate),
    );
    expect(routeDrawingReducer(drawingState(), { type: "undo" })).toEqual(
      drawingState(),
    );
  });

  it("clears vertices without leaving drawing mode", () => {
    expect(
      routeDrawingReducer(drawingState(firstCoordinate), { type: "clear" }),
    ).toEqual(drawingState());
    expect(
      routeDrawingReducer(INITIAL_ROUTE_DRAWING_STATE, { type: "clear" }),
    ).toBe(INITIAL_ROUTE_DRAWING_STATE);
  });

  it("cancels the draft and returns to idle", () => {
    expect(
      routeDrawingReducer(drawingState(firstCoordinate), { type: "cancel" }),
    ).toBe(INITIAL_ROUTE_DRAWING_STATE);
  });
});

describe("route drawing GeoJSON", () => {
  it("provides an empty preview before the first vertex", () => {
    expect(createRoutePreview(drawingState())).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });

  it("previews a single vertex as a Point", () => {
    expect(createRoutePreview(drawingState(firstCoordinate))).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: firstCoordinate },
        },
      ],
    });
  });

  it("previews two or more vertices as a LineString", () => {
    expect(
      createRoutePreview(drawingState(firstCoordinate, secondCoordinate)),
    ).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [firstCoordinate, secondCoordinate],
          },
        },
      ],
    });
  });

  it("creates a final LineString only with two distinct coordinate pairs", () => {
    expect(createFinalRoute(drawingState())).toBeNull();
    expect(createFinalRoute(drawingState(firstCoordinate))).toBeNull();
    expect(
      createFinalRoute(drawingState(firstCoordinate, firstCoordinate)),
    ).toBeNull();
    expect(
      createFinalRoute(
        drawingState(firstCoordinate, firstCoordinate, secondCoordinate),
      ),
    ).not.toBeNull();
    expect(
      createFinalRoute(drawingState(firstCoordinate, secondCoordinate)),
    ).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [firstCoordinate, secondCoordinate],
          },
        },
      ],
    });
  });
});

describe("separate route lines", () => {
  const firstLine = [firstCoordinate, secondCoordinate];
  const thirdCoordinate = [-104.9, 39.8];
  const fourthCoordinate = [-104.89, 39.81];
  const afterBreak = () =>
    routeDrawingReducer(drawingState(...firstLine), { type: "new-line" });

  it("keeps completed lines visible and never connects the next line", () => {
    const state = afterBreak();
    expect(state.coordinates).toEqual([]);
    expect(
      createRoutePreview(state).features.map(
        (feature) => feature.geometry.coordinates,
      ),
    ).toEqual([firstLine]);
    expect(createFinalRoute(state)?.features).toHaveLength(1);
    const withPoint = routeDrawingReducer(state, {
      type: "add-vertex",
      coordinate: thirdCoordinate,
    });
    expect(
      createRoutePreview(withPoint).features.map(
        (feature) => feature.geometry.type,
      ),
    ).toEqual(["LineString", "Point"]);
    expect(createFinalRoute(withPoint)).toBeNull();
    const complete = routeDrawingReducer(withPoint, {
      type: "add-vertex",
      coordinate: fourthCoordinate,
    });
    const expected = [firstLine, [thirdCoordinate, fourthCoordinate]];
    expect(
      createRoutePreview(complete).features.map(
        (feature) => feature.geometry.coordinates,
      ),
    ).toEqual(expected);
    expect(
      createFinalRoute(complete)?.features.map(
        (feature) => feature.geometry.coordinates,
      ),
    ).toEqual(expected);
  });

  it("requires a valid current line before starting another", () => {
    for (const state of [
      INITIAL_ROUTE_DRAWING_STATE,
      drawingState(),
      drawingState(firstCoordinate),
      drawingState(firstCoordinate, firstCoordinate),
      afterBreak(),
    ]) {
      expect(routeDrawingReducer(state, { type: "new-line" })).toBe(state);
    }
  });

  it("undoes new vertices and then the line break, and clears or cancels every line", () => {
    const state = routeDrawingReducer(afterBreak(), {
      type: "add-vertex",
      coordinate: thirdCoordinate,
    });
    const undonePoint = routeDrawingReducer(state, { type: "undo" });
    expect(undonePoint).toEqual(afterBreak());
    const undoneBreak = routeDrawingReducer(undonePoint, { type: "undo" });
    expect(undoneBreak).toEqual(drawingState(...firstLine));
    expect(routeDrawingReducer(undoneBreak, { type: "undo" })).toEqual(
      drawingState(firstCoordinate),
    );
    expect(routeDrawingReducer(state, { type: "clear" })).toEqual(
      drawingState(),
    );
    expect(routeDrawingReducer(state, { type: "cancel" })).toBe(
      INITIAL_ROUTE_DRAWING_STATE,
    );
    expect(routeDrawingReducer(state, { type: "start" })).toEqual(
      drawingState(),
    );
  });
});
