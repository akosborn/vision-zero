import { ZodError } from "zod";

import {
  DRAWN_ROUTE_PRECISION,
  decodeDrawnRouteLines,
  encodeDrawnRouteLines,
} from "@/app/lib/drawn-route-codec";
import {
  QUERY_TOOLS,
  QUERY_URL_VERSION,
  type QueryDefinitionV1,
  type QueryTool,
  validateQueryDefinition,
} from "@/app/lib/query-definition";

export const MAX_QUERY_URL_LENGTH = 2000;

type SearchParamsInput = URLSearchParams | ReadonlyURLSearchParams;

type ReadonlyURLSearchParams = Pick<
  URLSearchParams,
  "get" | "getAll" | "keys" | "toString"
>;

export type ParseQueryResult =
  | { status: "empty" }
  | { status: "success"; query: QueryDefinitionV1; legacy: boolean }
  | {
      status: "error";
      kind: "invalid" | "unsupported";
      message: string;
    };

export type ParseQueryUrlOptions = {
  enabledTools?: readonly QueryTool[];
};

const invalid = (message: string): ParseQueryResult => ({
  status: "error",
  kind: "invalid",
  message,
});

const unsupported = (message: string): ParseQueryResult => ({
  status: "error",
  kind: "unsupported",
  message,
});

const parseNumber = (value: string | null) => {
  if (value === null || value.trim() === "") {
    return Number.NaN;
  }
  return Number(value);
};

const hasDuplicateParameters = (params: SearchParamsInput) =>
  Array.from(new Set(Array.from(params.keys()))).some(
    (key) => params.getAll(key).length !== 1,
  );

const hasOnlyParameters = (
  params: SearchParamsInput,
  allowed: readonly string[],
) => {
  const allowedSet = new Set(allowed);
  return Array.from(params.keys()).every((key) => allowedSet.has(key));
};

const parseVersionOne = (
  params: SearchParamsInput,
  enabledTools: readonly QueryTool[],
): ParseQueryResult => {
  const tool = params.get("tool");
  if (!QUERY_TOOLS.includes(tool as QueryTool)) {
    return invalid("This query link uses an invalid search tool.");
  }
  if (!enabledTools.includes(tool as QueryTool)) {
    return unsupported(
      "This query link uses a search tool that is unavailable.",
    );
  }

  const common = {
    version: QUERY_URL_VERSION,
    dateRange: { from: params.get("from"), to: params.get("to") },
  };

  let candidate: unknown;
  if (tool === "radius") {
    if (
      !hasOnlyParameters(params, [
        "v",
        "tool",
        "from",
        "to",
        "lat",
        "lng",
        "radiusFeet",
      ])
    ) {
      return invalid("This radius query link contains unsupported parameters.");
    }
    candidate = {
      ...common,
      tool,
      center: {
        lat: parseNumber(params.get("lat")),
        lng: parseNumber(params.get("lng")),
      },
      radiusFeet: parseNumber(params.get("radiusFeet")),
    };
  } else if (tool === "street") {
    if (
      !hasOnlyParameters(params, [
        "v",
        "tool",
        "from",
        "to",
        "street",
        "crossFrom",
        "crossTo",
        "bufferFeet",
      ])
    ) {
      return invalid("This street query link contains unsupported parameters.");
    }
    const crossFrom = params.get("crossFrom");
    const crossTo = params.get("crossTo");
    if ((crossFrom === null) !== (crossTo === null)) {
      return invalid("Both cross streets must be included in a query link.");
    }
    candidate = {
      ...common,
      tool,
      street: params.get("street"),
      ...(crossFrom !== null && crossTo !== null
        ? { crossStreets: { from: crossFrom, to: crossTo } }
        : {}),
      bufferFeet: parseNumber(params.get("bufferFeet")),
    };
  } else {
    if (
      !hasOnlyParameters(params, [
        "v",
        "tool",
        "from",
        "to",
        "bufferFeet",
        "precision",
        "polyline",
        "polylines",
      ])
    ) {
      return invalid(
        "This drawn-route query link contains unsupported parameters.",
      );
    }
    if (params.get("precision") !== String(DRAWN_ROUTE_PRECISION)) {
      return invalid("This drawn-route query link uses an invalid precision.");
    }

    if (
      (params.get("polyline") === null) ===
      (params.get("polylines") === null)
    ) {
      return invalid(
        "This drawn-route query link must specify either polyline or polylines.",
      );
    }
    try {
      candidate = {
        ...common,
        tool,
        route: decodeDrawnRouteLines(
          params.get("polylines") !== null
            ? JSON.parse(params.get("polylines")!)
            : [params.get("polyline")],
        ),
        bufferFeet: parseNumber(params.get("bufferFeet")),
      };
    } catch {
      return invalid("This drawn-route query link contains an invalid route.");
    }
  }

  try {
    return {
      status: "success",
      query: validateQueryDefinition(candidate),
      legacy: false,
    };
  } catch (error) {
    const detail =
      error instanceof ZodError ? error.issues[0]?.message : undefined;
    return invalid(
      detail
        ? `This query link is invalid: ${detail}.`
        : "This query link is invalid.",
    );
  }
};

const parseLegacyStreet = (
  params: SearchParamsInput,
  enabledTools: readonly QueryTool[],
): ParseQueryResult => {
  if (!enabledTools.includes("street")) {
    return unsupported(
      "This query link uses a search tool that is unavailable.",
    );
  }
  if (params.get("tool") !== "Street Search") {
    return invalid("This legacy query link is incomplete or unsupported.");
  }
  if (
    !hasOnlyParameters(params, [
      "tool",
      "fromDate",
      "toDate",
      "r",
      "street",
      "crossStreet1",
      "crossStreet2",
    ])
  ) {
    return invalid("This legacy query link contains unsupported parameters.");
  }

  const crossFrom = params.get("crossStreet1");
  const crossTo = params.get("crossStreet2");
  if ((crossFrom === null) !== (crossTo === null)) {
    return invalid("Both cross streets must be included in a query link.");
  }

  const candidate = {
    version: QUERY_URL_VERSION,
    tool: "street" as const,
    dateRange: {
      from: params.get("fromDate"),
      to: params.get("toDate"),
    },
    street: params.get("street"),
    ...(crossFrom !== null && crossTo !== null
      ? { crossStreets: { from: crossFrom, to: crossTo } }
      : {}),
    bufferFeet: parseNumber(params.get("r")),
  };

  try {
    return {
      status: "success",
      query: validateQueryDefinition(candidate),
      legacy: true,
    };
  } catch {
    return invalid("This legacy query link is incomplete or invalid.");
  }
};

export const parseQueryUrl = (
  params: SearchParamsInput,
  options: ParseQueryUrlOptions = {},
): ParseQueryResult => {
  if (params.toString() === "") {
    return { status: "empty" };
  }
  if (params.toString().length > MAX_QUERY_URL_LENGTH) {
    return invalid("This query link is too long.");
  }
  if (hasDuplicateParameters(params)) {
    return invalid("This query link contains duplicate parameters.");
  }

  const enabledTools = options.enabledTools ?? QUERY_TOOLS;
  const version = params.get("v");
  if (version === null) {
    return parseLegacyStreet(params, enabledTools);
  }
  if (version !== String(QUERY_URL_VERSION)) {
    return unsupported("This query link uses an unsupported version.");
  }
  return parseVersionOne(params, enabledTools);
};

export const serializeQueryUrl = (
  unvalidatedQuery: QueryDefinitionV1,
): URLSearchParams => {
  const query = validateQueryDefinition(unvalidatedQuery);
  const params = new URLSearchParams();
  params.set("v", String(query.version));
  params.set("tool", query.tool);
  params.set("from", query.dateRange.from);
  params.set("to", query.dateRange.to);

  if (query.tool === "radius") {
    params.set("lat", String(query.center.lat));
    params.set("lng", String(query.center.lng));
    params.set("radiusFeet", String(query.radiusFeet));
  } else if (query.tool === "street") {
    params.set("street", query.street);
    if (query.crossStreets) {
      params.set("crossFrom", query.crossStreets.from);
      params.set("crossTo", query.crossStreets.to);
    }
    params.set("bufferFeet", String(query.bufferFeet));
  } else {
    params.set("bufferFeet", String(query.bufferFeet));
    params.set("precision", String(DRAWN_ROUTE_PRECISION));
    const lines = encodeDrawnRouteLines(query.route);
    if (lines.length === 1) {
      params.set("polyline", lines[0]);
    } else {
      params.set("polylines", JSON.stringify(lines));
    }
  }

  return params;
};

export const createCanonicalQueryPath = (
  query: QueryDefinitionV1,
  pathname = "/map",
) => `${pathname}?${serializeQueryUrl(query).toString()}`;

export const isCanonicalQueryUrlShareable = (
  query: QueryDefinitionV1,
  pathname = "/map",
) => {
  try {
    return (
      createCanonicalQueryPath(query, pathname).length <= MAX_QUERY_URL_LENGTH
    );
  } catch {
    return false;
  }
};
