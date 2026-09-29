import { crashSummarySchema, listCrashesSchema } from './input-schemas';

const lineString = {
  type: 'LineString',
  coordinates: [
    [-104.99, 39.74],
    [-104.98, 39.75],
  ],
};

const route = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: {}, geometry: lineString },
    { type: 'Feature', properties: {}, geometry: null },
  ],
};

describe('listCrashesSchema', () => {
  it('parses a date range without an area', () => {
    expect(
      listCrashesSchema.parse({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      }),
    ).toEqual({ startDate: '2025-01-01', endDate: '2025-12-31' });
  });

  it('parses a bounding box', () => {
    expect(
      listCrashesSchema.parse({
        area: { type: 'bbox', bbox: [-105, 39.6, -104.8, 39.8] },
      }).area,
    ).toEqual({ type: 'bbox', bbox: [-105, 39.6, -104.8, 39.8] });
  });

  it('parses a radius search', () => {
    expect(
      listCrashesSchema.parse({
        area: { type: 'radius', lat: 39.74, lng: -104.99, radiusInFeet: 35 },
      }).area,
    ).toEqual({ type: 'radius', lat: 39.74, lng: -104.99, radiusInFeet: 35 });
  });

  it('parses a buffered street segment', () => {
    expect(
      listCrashesSchema.parse({
        area: {
          type: 'street',
          fullStreetName: ' N Broadway ',
          crossStreets: ['E 1st Ave', 'E 6th Ave'],
          bufferInFeet: 50,
        },
      }).area,
    ).toEqual({
      type: 'street',
      fullStreetName: 'N Broadway',
      crossStreets: ['E 1st Ave', 'E 6th Ave'],
      bufferInFeet: 50,
    });
  });

  it('defaults the street buffer to 0', () => {
    expect(
      listCrashesSchema.parse({
        area: { type: 'street', fullStreetName: 'N Broadway' },
      }).area,
    ).toEqual({
      type: 'street',
      fullStreetName: 'N Broadway',
      bufferInFeet: 0,
    });
  });

  it('reduces a route to its non-null geometries', () => {
    expect(
      listCrashesSchema.parse({
        startDate: '2025-01-01',
        area: { type: 'route', route, bufferInFeet: 35 },
      }),
    ).toEqual({
      startDate: '2025-01-01',
      area: { type: 'route', route: [lineString], bufferInFeet: 35 },
    });
  });

  it.each([
    ['an unknown area type', { area: { type: 'city' } }],
    [
      'a partial radius',
      { area: { type: 'radius', lat: 39.74, lng: -104.99 } },
    ],
    [
      'a single cross street',
      {
        area: {
          type: 'street',
          fullStreetName: 'N Broadway',
          crossStreets: ['E 1st Ave'],
        },
      },
    ],
    [
      'a descending bbox',
      { area: { type: 'bbox', bbox: [-104.8, 39.6, -105, 39.8] } },
    ],
    [
      'a malformed bbox',
      { area: { type: 'bbox', bbox: [-105, 39.6, -104.8] } },
    ],
    [
      'an out of range buffer',
      {
        area: {
          type: 'street',
          fullStreetName: 'N Broadway',
          bufferInFeet: 10000,
        },
      },
    ],
    [
      'string numbers',
      {
        area: {
          type: 'radius',
          lat: '39.74',
          lng: '-104.99',
          radiusInFeet: '35',
        },
      },
    ],
    [
      'control characters',
      { area: { type: 'street', fullStreetName: 'N Broadway\u0000' } },
    ],
    [
      'a route without geometries',
      {
        area: {
          type: 'route',
          route: { type: 'FeatureCollection', features: [route.features[1]] },
        },
      },
    ],
    [
      'a non-FeatureCollection route',
      { area: { type: 'route', route: route.features[0] } },
    ],
    ['an invalid date', { startDate: '2025-02-30' }],
    ['reversed dates', { startDate: '2025-12-31', endDate: '2025-01-01' }],
  ])('rejects %s', (_, body) => {
    expect(listCrashesSchema.safeParse(body).success).toBe(false);
  });
});

describe('crashSummarySchema', () => {
  it('parses a radius search', () => {
    expect(
      crashSummarySchema.parse({
        area: { type: 'radius', lat: 39.74, lng: -104.99, radiusInFeet: 35 },
      }),
    ).toEqual({
      area: { type: 'radius', lat: 39.74, lng: -104.99, radiusInFeet: 35 },
    });
  });

  it('parses an entire street', () => {
    expect(
      crashSummarySchema.parse({
        area: { type: 'street', fullStreetName: 'N Broadway' },
      }),
    ).toEqual({
      area: { type: 'street', fullStreetName: 'N Broadway', bufferInFeet: 0 },
    });
  });

  it('parses a route', () => {
    expect(
      crashSummarySchema.parse({
        area: { type: 'route', route, bufferInFeet: 35 },
      }),
    ).toEqual({
      area: { type: 'route', route: [lineString], bufferInFeet: 35 },
    });
  });

  it.each([
    ['no area', {}],
    [
      'a bounding box',
      { area: { type: 'bbox', bbox: [-105, 39.6, -104.8, 39.8] } },
    ],
    [
      'a single cross street',
      {
        area: {
          type: 'street',
          fullStreetName: 'N Broadway',
          crossStreets: ['E 1st Ave'],
        },
      },
    ],
  ])('rejects %s', (_, body) => {
    expect(crashSummarySchema.safeParse(body).success).toBe(false);
  });
});
