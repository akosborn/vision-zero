import { decode, encode } from "@googlemaps/polyline-codec";
import type { FeatureCollection, LineString, Position } from "geojson";

export const DRAWN_ROUTE_PRECISION = 6;
export const MAX_DRAWN_ROUTE_VERTICES = 1000;
export const MAX_ENCODED_POLYLINE_LENGTH = 2000;

export class DrawnRouteCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawnRouteCodecError";
  }
}

const validateCoordinate = (coordinate: Position, index: number) => {
  if (coordinate.length !== 2) {
    throw new DrawnRouteCodecError(
      `Route coordinate ${index + 1} must contain longitude and latitude`,
    );
  }

  const [longitude, latitude] = coordinate;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new DrawnRouteCodecError(
      `Route coordinate ${index + 1} has an invalid longitude`,
    );
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new DrawnRouteCodecError(
      `Route coordinate ${index + 1} has an invalid latitude`,
    );
  }

  return [longitude, latitude] as const;
};

const validateCoordinates = (coordinates: Position[]) => {
  if (coordinates.length < 2) {
    throw new DrawnRouteCodecError(
      "A drawn route must contain at least two coordinates",
    );
  }
  if (coordinates.length > MAX_DRAWN_ROUTE_VERTICES) {
    throw new DrawnRouteCodecError(
      `A drawn route cannot exceed ${MAX_DRAWN_ROUTE_VERTICES} coordinates`,
    );
  }

  const validated = coordinates.map(validateCoordinate);
  const [first] = validated;
  if (
    !validated.some(
      ([longitude, latitude]) =>
        longitude !== first[0] || latitude !== first[1],
    )
  ) {
    throw new DrawnRouteCodecError(
      "A drawn route must contain at least two distinct coordinates",
    );
  }

  return validated;
};

export const encodeDrawnRoute = (
  route: FeatureCollection<LineString>,
): string => {
  if (
    route.type !== "FeatureCollection" ||
    route.features.length !== 1 ||
    route.features[0]?.geometry?.type !== "LineString"
  ) {
    throw new DrawnRouteCodecError(
      "A drawn route must contain exactly one LineString",
    );
  }

  const coordinates = validateCoordinates(
    route.features[0].geometry.coordinates,
  );
  const encoded = encode(
    coordinates.map(([longitude, latitude]) => [latitude, longitude]),
    DRAWN_ROUTE_PRECISION,
  );

  if (encoded.length > MAX_ENCODED_POLYLINE_LENGTH) {
    throw new DrawnRouteCodecError(
      `Encoded route cannot exceed ${MAX_ENCODED_POLYLINE_LENGTH} characters`,
    );
  }
  return encoded;
};

export const decodeDrawnRoute = (
  encodedRoute: string,
): FeatureCollection<LineString> => {
  if (encodedRoute.length === 0) {
    throw new DrawnRouteCodecError("Encoded route must not be empty");
  }
  if (encodedRoute.length > MAX_ENCODED_POLYLINE_LENGTH) {
    throw new DrawnRouteCodecError(
      `Encoded route cannot exceed ${MAX_ENCODED_POLYLINE_LENGTH} characters`,
    );
  }

  let decoded: [number, number][];
  try {
    decoded = decode(encodedRoute, DRAWN_ROUTE_PRECISION);
  } catch {
    throw new DrawnRouteCodecError("Encoded route is invalid");
  }

  const coordinates = validateCoordinates(
    decoded.map(([latitude, longitude]) => [longitude, latitude]),
  );
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coordinates.map((coordinate) => [...coordinate]),
        },
      },
    ],
  };
};
