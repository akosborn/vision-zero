import { describe, expect, it } from "vitest";

import { Crash } from "@/app/lib/api-client";

import {
  CDOT_REPORT_REQUEST_URL,
  DOTI_FEATURE_LAYER_URL,
  getCrashSourceLinks,
  getSafeHttpsUrl,
} from "./crash-source-links";

const crash = (properties: Partial<Crash> = {}): Crash =>
  ({
    doti_incident_id: null,
    cdot_cuid: null,
    ...properties,
  }) as Crash;

describe("getCrashSourceLinks", () => {
  it.each([
    [304214148, "304214148", "DP2026473926"],
    [" 304298515 ", "304298515", "2018323"],
    [304348170, "304348170", "20133"],
  ])(
    "prefers an exact ArcGIS feature URL for verified object ID %j",
    (id, expected, incidentId) => {
      expect(
        getCrashSourceLinks(crash({ doti_incident_id: incidentId }), id)
          .dotiRecordUrl,
      ).toBe(`${DOTI_FEATURE_LAYER_URL}/${expected}`);
    },
  );

  it.each(["20256000001", "20196000002"])(
    "falls back to an official incident query for current or older ID %s",
    (incidentId) => {
      const recordUrl = getCrashSourceLinks(
        crash({ doti_incident_id: incidentId }),
      ).dotiRecordUrl;
      const url = new URL(recordUrl!);

      expect(`${url.origin}${url.pathname}`).toBe(
        `${DOTI_FEATURE_LAYER_URL}/query`,
      );
      expect(url.searchParams.get("where")).toBe(
        `incident_id = '${incidentId}'`,
      );
      expect(url.searchParams.get("outFields")).toBe("*");
      expect(url.searchParams.get("returnGeometry")).toBe("true");
      expect(url.searchParams.get("f")).toBe("pjson");
    },
  );

  it("trims and safely SQL-escapes the incident-ID query fallback", () => {
    const recordUrl = getCrashSourceLinks(
      crash({ doti_incident_id: " 2025'123 " }),
    ).dotiRecordUrl;
    const url = new URL(recordUrl!);

    expect(url.searchParams.get("where")).toBe("incident_id = '2025''123'");
  });

  it("uses a semantic query fallback that does not claim a non-unique incident ID is an exact record", () => {
    const recordUrl = getCrashSourceLinks(
      crash({ doti_incident_id: "DUPLICATED-INCIDENT-ID" }),
      "not-an-object-id",
    ).dotiRecordUrl;

    expect(recordUrl).toContain("/query?");
    expect(recordUrl).not.toContain("/DUPLICATED-INCIDENT-ID");
  });

  it.each([undefined, null, 0, -1, 1.5, "", "  ", "0", "12x"])(
    "omits the DOTI link when both object and incident identifiers are invalid: %j",
    (objectId) => {
      expect(
        getCrashSourceLinks(crash({ doti_incident_id: "   " }), objectId)
          .dotiRecordUrl,
      ).toBeUndefined();
    },
  );

  it("adds official report-request guidance only for a nonblank CDOT CUID", () => {
    expect(
      getCrashSourceLinks(crash({ cdot_cuid: "  CUID-123  " }))
        .cdotReportRequestUrl,
    ).toBe(CDOT_REPORT_REQUEST_URL);

    for (const cdotCuid of [null, "", "   "]) {
      expect(
        getCrashSourceLinks(crash({ cdot_cuid: cdotCuid }))
          .cdotReportRequestUrl,
      ).toBeUndefined();
    }
  });

  it("treats an explicit empty source-link model as authoritative", () => {
    expect(
      getCrashSourceLinks(
        crash({
          doti_incident_id: "20256000001",
          cdot_cuid: "CUID-123",
          sourceLinks: {},
        }),
        325,
      ),
    ).toEqual({});
  });

  it("keeps only safe HTTPS URLs from an explicit source-link model", () => {
    expect(
      getCrashSourceLinks(
        crash({
          sourceLinks: {
            dotiRecordUrl: "data:text/html,unsafe",
            cdotReportRequestUrl: "https://dmv.colorado.gov/reports",
          },
        }),
      ),
    ).toEqual({
      cdotReportRequestUrl: "https://dmv.colorado.gov/reports",
    });
  });
});

describe("getSafeHttpsUrl", () => {
  it("accepts an HTTPS URL without credentials", () => {
    expect(getSafeHttpsUrl("https://example.com/source?record=1")).toBe(
      "https://example.com/source?record=1",
    );
  });

  it.each([
    undefined,
    null,
    "",
    "not a URL",
    "http://example.com/source",
    "data:text/html,unsafe",
    "https://user:secret@example.com/source",
  ])("rejects an unsafe external URL: %j", (url) => {
    expect(getSafeHttpsUrl(url)).toBeUndefined();
  });
});
