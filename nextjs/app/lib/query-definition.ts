import type { FeatureCollection, LineString } from "geojson";
import { z } from "zod";

export const QUERY_URL_VERSION = 1 as const;
export const MAX_QUERY_DISTANCE_FEET = 5280;
export const MAX_STREET_NAME_LENGTH = 200;

export const QUERY_TOOLS = ["radius", "street", "draw"] as const;
export type QueryTool = (typeof QUERY_TOOLS)[number];

export type QueryDateRange = { from: string; to: string };

export type QueryDefinitionV1 =
  | {
      version: 1;
      tool: "radius";
      dateRange: QueryDateRange;
      center: { lat: number; lng: number };
      radiusFeet: number;
    }
  | {
      version: 1;
      tool: "street";
      dateRange: QueryDateRange;
      street: string;
      crossStreets?: { from: string; to: string };
      bufferFeet: number;
    }
  | {
      version: 1;
      tool: "draw";
      dateRange: QueryDateRange;
      route: FeatureCollection<LineString>;
      bufferFeet: number;
    };

const isCanonicalDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const canonicalDateSchema = z
  .string()
  .refine(isCanonicalDate, "Date must use a real YYYY-MM-DD calendar date");

const dateRangeSchema = z
  .object({
    from: canonicalDateSchema,
    to: canonicalDateSchema,
  })
  .strict()
  .refine(({ from, to }) => from <= to, {
    message: "Start date must be on or before end date",
    path: ["from"],
  });

const distanceSchema = z.number().finite().min(0).max(MAX_QUERY_DISTANCE_FEET);

const streetNameSchema = z
  .string()
  .min(1)
  .max(MAX_STREET_NAME_LENGTH)
  .refine((value) => value === value.trim(), "Street names must not be padded")
  .refine(
    (value) =>
      !Array.from(value).some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint < 32 || codePoint === 127;
      }),
    "Street names must not contain control characters",
  );

const routeSchema = z.custom<FeatureCollection<LineString>>(
  (value) => {
    if (
      !value ||
      typeof value !== "object" ||
      (value as FeatureCollection).type !== "FeatureCollection"
    ) {
      return false;
    }

    const features = (value as FeatureCollection).features;
    return (
      Array.isArray(features) &&
      features.length > 0 &&
      features.every((feature) => feature?.geometry?.type === "LineString")
    );
  },
  { message: "Drawn routes must contain one or more LineStrings" },
);

const baseQuerySchema = {
  version: z.literal(QUERY_URL_VERSION),
  dateRange: dateRangeSchema,
};

export const queryDefinitionV1Schema: z.ZodType<QueryDefinitionV1> =
  z.discriminatedUnion("tool", [
    z
      .object({
        ...baseQuerySchema,
        tool: z.literal("radius"),
        center: z
          .object({
            lat: z.number().finite().min(-90).max(90),
            lng: z.number().finite().min(-180).max(180),
          })
          .strict(),
        radiusFeet: distanceSchema,
      })
      .strict(),
    z
      .object({
        ...baseQuerySchema,
        tool: z.literal("street"),
        street: streetNameSchema,
        crossStreets: z
          .object({ from: streetNameSchema, to: streetNameSchema })
          .strict()
          .optional(),
        bufferFeet: distanceSchema,
      })
      .strict(),
    z
      .object({
        ...baseQuerySchema,
        tool: z.literal("draw"),
        route: routeSchema,
        bufferFeet: distanceSchema,
      })
      .strict(),
  ]);

export const validateQueryDefinition = (query: unknown): QueryDefinitionV1 =>
  queryDefinitionV1Schema.parse(query);
