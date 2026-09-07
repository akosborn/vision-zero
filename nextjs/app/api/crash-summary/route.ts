import type { FeatureCollection, Point } from "geojson";
import { NextRequest } from "next/server";

import { POST as getBufferedRouteIncidents } from "@/app/api/incidents/buffered-route/route";
import { GET as getBufferedStreetIncidents } from "@/app/api/incidents/buffered-street/route";
import { GET as getRadiusIncidents } from "@/app/api/incidents/route";
import type { Crash } from "@/app/lib/api-client";
import { invalidInputResponse } from "@/app/lib/api-responses";
import type { QueryDefinitionV1 } from "@/app/lib/query-definition";
import { parseQueryUrl } from "@/app/lib/query-url";
import {
  buildPublicCrashSummary,
  CRASH_SUMMARY_SCHEMA_VERSION,
} from "@/app/lib/public-crash-summary";

const jsonHeaders = { "Cache-Control": "no-store" };

const incidentsRequestForQuery = (
  request: NextRequest,
  query: QueryDefinitionV1,
): Promise<Response> => {
  const url = new URL("/api/incidents", request.nextUrl.origin);

  if (query.tool === "radius") {
    url.searchParams.set("startDate", query.dateRange.from);
    url.searchParams.set("endDate", query.dateRange.to);
    url.searchParams.set("lat", String(query.center.lat));
    url.searchParams.set("lng", String(query.center.lng));
    url.searchParams.set("radiusInFeet", String(query.radiusFeet));
    return getRadiusIncidents(new NextRequest(url));
  }

  if (query.tool === "street") {
    url.pathname = "/api/incidents/buffered-street";
    url.searchParams.set("fullStreetName", query.street);
    if (query.crossStreets) {
      url.searchParams.set("crossStreet1", query.crossStreets.from);
      url.searchParams.set("crossStreet2", query.crossStreets.to);
    }
    url.searchParams.set("bufferInFeet", String(query.bufferFeet));
    url.searchParams.set("startDate", query.dateRange.from);
    url.searchParams.set("endDate", query.dateRange.to);
    return getBufferedStreetIncidents(new NextRequest(url));
  }

  url.pathname = "/api/incidents/buffered-route";
  return getBufferedRouteIncidents(
    new NextRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: query.route,
        bufferInFeet: query.bufferFeet,
        startDate: query.dateRange.from,
        endDate: query.dateRange.to,
      }),
    }),
  );
};

export async function GET(request: NextRequest) {
  const parsedQuery = parseQueryUrl(request.nextUrl.searchParams);

  if (parsedQuery.status === "empty") {
    return invalidInputResponse("A crash query is required.");
  }
  if (parsedQuery.status === "error") {
    return invalidInputResponse(parsedQuery.message);
  }

  const incidentsResponse = await incidentsRequestForQuery(
    request,
    parsedQuery.query,
  );
  if (!incidentsResponse.ok) {
    return incidentsResponse;
  }

  const incidents = (await incidentsResponse.json()) as FeatureCollection<
    Point,
    Crash
  >;

  return Response.json(
    {
      schemaVersion: CRASH_SUMMARY_SCHEMA_VERSION,
      query: parsedQuery.query,
      summary: buildPublicCrashSummary(incidents.features),
    },
    { headers: jsonHeaders },
  );
}
