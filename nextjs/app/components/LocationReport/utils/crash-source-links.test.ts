import { describe, expect, it } from "vitest";

import { Crash } from "@/app/lib/api-client";

import {
  DOTI_OPEN_DATASET_URL,
  getCrashSourceLinks,
  getSafeHttpsUrl,
} from "./crash-source-links";

const crash = (properties: Partial<Crash> = {}): Crash =>
  ({
    doti_incident_id: null,
    cdot_cuid: null,
    ...properties,
  }) as Crash;

const decodeBase64Utf8 = (value: string): string =>
  new TextDecoder().decode(
    Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
  );

const expectFilteredOpenDataUrl = (
  recordUrl: string | undefined,
  incidentId: string,
) => {
  const url = new URL(recordUrl!);
  expect(`${url.origin}${url.pathname}`).toBe(DOTI_OPEN_DATASET_URL);
  expect(url.searchParams.get("showTable")).toBe("true");
  expect(
    JSON.parse(decodeBase64Utf8(url.searchParams.get("filters")!)),
  ).toEqual({ incident_id: [incidentId] });
};

describe("getCrashSourceLinks", () => {
  it.each(["DP2026462495", "DP2026473926", "2018323", "20133"])(
    "uses a stable filtered Denver Open Data URL for incident ID %s",
    (incidentId) => {
      expectFilteredOpenDataUrl(
        getCrashSourceLinks(crash({ doti_incident_id: incidentId }))
          .dotiRecordUrl,
        incidentId,
      );
    },
  );

  it("trims and safely encodes the semantic incident ID", () => {
    const recordUrl = getCrashSourceLinks(
      crash({ doti_incident_id: " 2025-事故'123 " }),
    ).dotiRecordUrl;

    expectFilteredOpenDataUrl(recordUrl, "2025-事故'123");
  });

  it("omits the DOTI link when the semantic incident ID is missing", () => {
    expect(
      getCrashSourceLinks(crash({ doti_incident_id: "   " })).dotiRecordUrl,
    ).toBeUndefined();
  });

  it.each([
    { doti_incident_id: "DOTI-123", cdot_cuid: null },
    { doti_incident_id: "DOTI-123", cdot_cuid: "CDOT-456" },
    { doti_incident_id: null, cdot_cuid: "CDOT-ONLY" },
  ])("does not generate a broken report-request URL for $cdot_cuid", (ids) => {
    expect(
      getCrashSourceLinks(crash(ids)).cdotReportRequestUrl,
    ).toBeUndefined();
  });

  it("treats an explicit empty source-link model as authoritative", () => {
    expect(
      getCrashSourceLinks(
        crash({
          doti_incident_id: "20256000001",
          cdot_cuid: "CUID-123",
          sourceLinks: {},
        }),
      ),
    ).toEqual({});
  });

  it("keeps a safe explicit report URL for a CDOT-only record", () => {
    expect(
      getCrashSourceLinks(
        crash({
          cdot_cuid: "CDOT-ONLY",
          sourceLinks: {
            dotiRecordUrl: "data:text/html,unsafe",
            cdotReportRequestUrl: "https://example.com/cdot-report-guidance",
          },
        }),
      ),
    ).toEqual({
      cdotReportRequestUrl: "https://example.com/cdot-report-guidance",
    });
  });

  it("drops an explicit report URL from a DOTI record enriched by CDOT", () => {
    expect(
      getCrashSourceLinks(
        crash({
          doti_incident_id: "DOTI-123",
          cdot_cuid: "CDOT-456",
          sourceLinks: {
            dotiRecordUrl: "https://example.gov/doti-record",
            cdotReportRequestUrl: "https://example.com/cdot-report-guidance",
          },
        }),
      ),
    ).toEqual({ dotiRecordUrl: "https://example.gov/doti-record" });
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
