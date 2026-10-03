import { NextRequest } from "next/server";

import type { CrashSearchResult } from "@/app/lib/api-client";
import {
  databaseFailureResponse,
  invalidInputResponse,
} from "@/app/lib/api-responses";
import type { QueryDefinitionV1 } from "@/app/lib/query-definition";
import { parseQueryUrl } from "@/app/lib/query-url";
import {
  buildPublicCrashSummary,
  CRASH_SUMMARY_SCHEMA_VERSION,
} from "@/app/lib/public-crash-summary";

const jsonHeaders = { "Cache-Control": "no-store" };

const backendUrl = () => process.env.VZ_BACKEND_URL || "http://localhost:4000";

/** Translates a saved query into a vz-backend `POST /crashes/search` body. */
const searchRequestForQuery = (query: QueryDefinitionV1) => {
  const dateRange = {
    startDate: query.dateRange.from,
    endDate: query.dateRange.to,
  };

  if (query.tool === "radius") {
    return {
      ...dateRange,
      area: {
        type: "radius",
        lat: query.center.lat,
        lng: query.center.lng,
        radiusInFeet: query.radiusFeet,
      },
    };
  }

  if (query.tool === "street") {
    return {
      ...dateRange,
      area: {
        type: "street",
        fullStreetName: query.street,
        crossStreets: query.crossStreets
          ? [query.crossStreets.from, query.crossStreets.to]
          : undefined,
        bufferInFeet: query.bufferFeet,
      },
    };
  }

  return {
    ...dateRange,
    area: {
      type: "route",
      route: query.route,
      bufferInFeet: query.bufferFeet,
    },
  };
};

/**
 * Nest reports validation failures as `{ message: string | { message }[] }`.
 * This API has always returned `{ error: string }`, so flatten it to that.
 */
const backendErrorMessage = async (response: Response) => {
  const body = (await response.json().catch(() => null)) as {
    message?: string | { path?: string; message: string }[];
  } | null;
  const message = body?.message;

  if (Array.isArray(message)) {
    return message
      .map(({ path, message }) => (path ? `${path}: ${message}` : message))
      .join("; ");
  }

  return message || "Invalid crash query.";
};

export async function GET(request: NextRequest) {
  const parsedQuery = parseQueryUrl(request.nextUrl.searchParams);

  if (parsedQuery.status === "empty") {
    return invalidInputResponse("A crash query is required.");
  }
  if (parsedQuery.status === "error") {
    return invalidInputResponse(parsedQuery.message);
  }

  let searchResponse: Response;
  try {
    searchResponse = await fetch(`${backendUrl()}/api/v1/crashes/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchRequestForQuery(parsedQuery.query)),
      cache: "no-store",
    });
  } catch {
    return databaseFailureResponse();
  }

  if (searchResponse.status >= 400 && searchResponse.status < 500) {
    return invalidInputResponse(await backendErrorMessage(searchResponse));
  }
  if (!searchResponse.ok) {
    return databaseFailureResponse();
  }

  const { summary } = (await searchResponse.json()) as CrashSearchResult;

  return Response.json(
    {
      schemaVersion: CRASH_SUMMARY_SCHEMA_VERSION,
      query: parsedQuery.query,
      summary: buildPublicCrashSummary(summary),
    },
    { headers: jsonHeaders },
  );
}
