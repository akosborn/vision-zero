import { describe, expect, it } from "vitest";

import { Crash } from "@/app/lib/api-client";

import {
  CDOT_REPORT_REQUEST_URL,
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
