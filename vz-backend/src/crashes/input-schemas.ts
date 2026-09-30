import { z } from 'zod';

const MAX_STREET_NAME_LENGTH = 200;

const MAX_BUFFER_IN_FEET = 5280;

const containsControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });

const streetNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_STREET_NAME_LENGTH)
  .refine((value) => !containsControlCharacter(value), {
    message: 'must not contain control characters',
  });

const distanceInFeetSchema = z.number().min(0).max(MAX_BUFFER_IN_FEET);
const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);

const geometrySchema = z.looseObject({
  type: z.enum([
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection',
  ]),
});

// A GeoJSON FeatureCollection, reduced to the geometries of its features.
const routeSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.looseObject({ geometry: geometrySchema.nullish() })),
  })
  .transform(({ features }) =>
    features.flatMap((feature) => (feature.geometry ? [feature.geometry] : [])),
  )
  .refine((geometries) => geometries.length > 0, {
    message: 'route must contain at least one feature with a geometry',
  });

/**
 * Areas to search for crashes within
 */

const boundingBoxAreaSchema = z.object({
  type: z.literal('bbox'),
  // [minLongitude, minLatitude, maxLongitude, maxLatitude]
  bbox: z
    .tuple([longitudeSchema, latitudeSchema, longitudeSchema, latitudeSchema])
    .refine(
      ([minLongitude, minLatitude, maxLongitude, maxLatitude]) =>
        minLongitude < maxLongitude && minLatitude < maxLatitude,
      { message: 'bbox bounds must be in ascending order' },
    ),
});

export type BoundingBoxArea = z.infer<typeof boundingBoxAreaSchema>;

const radiusAreaSchema = z.object({
  type: z.literal('radius'),
  lat: latitudeSchema,
  lng: longitudeSchema,
  radiusInFeet: distanceInFeetSchema,
});

export type RadiusArea = z.infer<typeof radiusAreaSchema>;

const streetAreaSchema = z.object({
  type: z.literal('street'),
  fullStreetName: streetNameSchema,
  // Omit to search the entire street
  crossStreets: z.tuple([streetNameSchema, streetNameSchema]).optional(),
  bufferInFeet: distanceInFeetSchema.default(0),
});

export type StreetArea = z.infer<typeof streetAreaSchema>;

const routeAreaSchema = z.object({
  type: z.literal('route'),
  route: routeSchema,
  bufferInFeet: distanceInFeetSchema.default(0),
});

export type RouteArea = z.infer<typeof routeAreaSchema>;

export const listCrashesSchema = z
  .object({
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    area: z
      .discriminatedUnion('type', [
        boundingBoxAreaSchema,
        radiusAreaSchema,
        streetAreaSchema,
        routeAreaSchema,
      ])
      .optional(),
  })
  .refine(
    ({ startDate, endDate }) => !startDate || !endDate || startDate <= endDate,
    { path: ['startDate'], message: 'startDate must be on or before endDate' },
  );

export type ListCrashesParams = z.infer<typeof listCrashesSchema>;

export type DateRange = Pick<ListCrashesParams, 'startDate' | 'endDate'>;

/**
 * POST /crashes/summary
 *
 * Summarizes crashes within an area.
 */
export const crashSummarySchema = z.object({
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  area: z.discriminatedUnion('type', [
    radiusAreaSchema,
    streetAreaSchema,
    routeAreaSchema,
  ]),
});

export type CrashSummaryParams = z.infer<typeof crashSummarySchema>;
