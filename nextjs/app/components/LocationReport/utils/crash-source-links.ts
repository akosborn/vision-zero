import { Crash, CrashSourceLinks } from "@/app/lib/api-client";

export const DOTI_OPEN_DATASET_URL =
  "https://opendata-geospatialdenver.hub.arcgis.com/datasets/db00bd99ea534d8987e0913a191ebe19_325/explore";

/**
 * Returns an HTTPS URL safe to use as an external link, or undefined for
 * malformed URLs, other protocols, and URLs containing credentials.
 */
export const getSafeHttpsUrl = (
  value: string | null | undefined,
): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
};

/**
 * Resolves the external source links for a crash.
 *
 * A supplied sourceLinks object, including an empty object, is authoritative,
 * but report guidance is accepted only for a CDOT-only record. Otherwise the
 * semantic incident ID produces a filtered Denver Open Data URL. ArcGIS object
 * IDs are intentionally not used because they are system-managed and can
 * change when the official dataset is refreshed.
 */
export const getCrashSourceLinks = (crash: Crash): CrashSourceLinks => {
  const dotiIncidentId = crash.doti_incident_id?.trim();
  const cdotCuid = crash.cdot_cuid?.trim();
  const isCdotOnly = Boolean(cdotCuid) && !dotiIncidentId;

  if (crash.sourceLinks !== undefined) {
    return sanitizedSourceLinks(crash.sourceLinks, isCdotOnly);
  }

  const dotiRecordUrl = getDotiRecordUrl(dotiIncidentId);

  return {
    ...(dotiRecordUrl ? { dotiRecordUrl } : {}),
  };
};

const sanitizedSourceLinks = (
  sourceLinks: CrashSourceLinks,
  includeCdotReportRequest: boolean,
): CrashSourceLinks => {
  const dotiRecordUrl = getSafeHttpsUrl(sourceLinks.dotiRecordUrl);
  const cdotReportRequestUrl = includeCdotReportRequest
    ? getSafeHttpsUrl(sourceLinks.cdotReportRequestUrl)
    : undefined;

  return {
    ...(dotiRecordUrl ? { dotiRecordUrl } : {}),
    ...(cdotReportRequestUrl ? { cdotReportRequestUrl } : {}),
  };
};

const getDotiRecordUrl = (
  dotiIncidentId: string | null | undefined,
): string | undefined => {
  const incidentId = dotiIncidentId?.trim();
  if (!incidentId) {
    return undefined;
  }

  const searchParams = new URLSearchParams({
    filters: encodeBase64Utf8(
      JSON.stringify({
        incident_id: [incidentId],
      }),
    ),
    showTable: "true",
  });

  return `${DOTI_OPEN_DATASET_URL}?${searchParams.toString()}`;
};

const encodeBase64Utf8 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};
