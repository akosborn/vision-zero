import { Crash, CrashSourceLinks } from "@/app/lib/api-client";

export const DOTI_FEATURE_LAYER_URL =
  "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325";

export const CDOT_REPORT_REQUEST_URL =
  "https://dmv.colorado.gov/obtaining-crash-reports-or-ticket-information";

type DotiObjectId = string | number | null | undefined;

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
 * A supplied sourceLinks object, including an empty object, is authoritative.
 * Otherwise the ArcGIS object ID produces an exact feature URL. Incident IDs
 * are not unique, so the incident-ID fallback intentionally opens an official
 * query that may contain more than one matching record.
 */
export const getCrashSourceLinks = (
  crash: Crash,
  dotiObjectId?: DotiObjectId,
): CrashSourceLinks => {
  if (crash.sourceLinks !== undefined) {
    return sanitizedSourceLinks(crash.sourceLinks);
  }

  const dotiRecordUrl = getDotiRecordUrl(dotiObjectId, crash.doti_incident_id);
  const cdotCuid = crash.cdot_cuid?.trim();

  return {
    ...(dotiRecordUrl ? { dotiRecordUrl } : {}),
    ...(cdotCuid ? { cdotReportRequestUrl: CDOT_REPORT_REQUEST_URL } : {}),
  };
};

const sanitizedSourceLinks = (
  sourceLinks: CrashSourceLinks,
): CrashSourceLinks => {
  const dotiRecordUrl = getSafeHttpsUrl(sourceLinks.dotiRecordUrl);
  const cdotReportRequestUrl = getSafeHttpsUrl(
    sourceLinks.cdotReportRequestUrl,
  );

  return {
    ...(dotiRecordUrl ? { dotiRecordUrl } : {}),
    ...(cdotReportRequestUrl ? { cdotReportRequestUrl } : {}),
  };
};

const getDotiRecordUrl = (
  dotiObjectId: DotiObjectId,
  dotiIncidentId: string | null,
): string | undefined => {
  const objectId = normalizedObjectId(dotiObjectId);
  if (objectId) {
    return `${DOTI_FEATURE_LAYER_URL}/${objectId}`;
  }

  const incidentId = dotiIncidentId?.trim();
  if (!incidentId) {
    return undefined;
  }

  const searchParams = new URLSearchParams({
    where: `incident_id = '${incidentId.replaceAll("'", "''")}'`,
    outFields: "*",
    returnGeometry: "true",
    f: "pjson",
  });

  return `${DOTI_FEATURE_LAYER_URL}/query?${searchParams.toString()}`;
};

const normalizedObjectId = (value: DotiObjectId): string | undefined => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return /^[1-9]\d*$/.test(trimmedValue) ? trimmedValue : undefined;
};
