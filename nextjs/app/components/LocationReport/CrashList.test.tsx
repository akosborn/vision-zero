import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { Feature, Point } from "geojson";
import { describe, expect, it, vi } from "vitest";

import { Crash } from "@/app/lib/api-client";

import CrashList from "./CrashList";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const feature = (
  properties: Partial<Crash>,
  id?: string | number,
): Feature<Point, Crash> => ({
  type: "Feature",
  id,
  geometry: { type: "Point", coordinates: [-104.9903, 39.7392] },
  properties: {
    doti_incident_id: "DP2026473926",
    doti_first_occurrence_date: "2026-08-25T13:34:00-06:00",
    doti_address: "E ANDREWS DR / N TITAN CT",
    doti_google_maps_url: "https://www.google.com/maps?q=39.7856,-104.8384",
    doti_fatalities: 0,
    doti_serious_injuries: 0,
    doti_bicycle_involved: false,
    doti_pedestrian_involved: false,
    doti_bicycle_count: 0,
    doti_pedestrian_count: 0,
    cdot_cuid: null,
    ...properties,
  } as Crash,
});

const renderCrashList = (crashFeatures: Feature<Point, Crash>[]) =>
  render(
    <MantineProvider>
      <CrashList crashFeatures={crashFeatures} />
    </MantineProvider>,
  );

const expectSafeExternalLink = (link: HTMLElement) => {
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
};

describe("CrashList source actions", () => {
  it("shows a stable DOTI source record without a Google Maps action", () => {
    renderCrashList([feature({}, 304214148)]);

    expect(screen.getByText("DP2026473926")).toBeInTheDocument();

    const sourceLink = screen.getByRole("link", {
      name: "View DOTI source record for DP2026473926 (opens in a new tab)",
    });
    const sourceUrl = new URL(sourceLink.getAttribute("href")!);
    expect(`${sourceUrl.origin}${sourceUrl.pathname}`).toBe(
      "https://opendata-geospatialdenver.hub.arcgis.com/datasets/db00bd99ea534d8987e0913a191ebe19_325/explore",
    );
    expect(JSON.parse(atob(sourceUrl.searchParams.get("filters")!))).toEqual({
      incident_id: ["DP2026473926"],
    });
    expectSafeExternalLink(sourceLink);

    expect(
      screen.queryByRole("link", { name: /Google Maps/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: /How to request the official report/,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows both source identifiers but no report guidance for a CDOT-enriched DOTI row", () => {
    renderCrashList([feature({ cdot_cuid: "CDOT-456" }, 304214148)]);

    expect(screen.getByText("DP2026473926")).toBeInTheDocument();
    expect(screen.getByText("CDOT-456")).toBeInTheDocument();
    expect(screen.getByText(/CDOT crash data ID \(CUID\)/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View DOTI source record/ }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: /official crash report/i }),
    ).not.toBeInTheDocument();
  });

  it("uses a safe explicit report URL only for a CDOT-only record", () => {
    renderCrashList([
      feature({
        doti_incident_id: null,
        cdot_cuid: "CDOT-456",
        sourceLinks: {
          cdotReportRequestUrl: "https://example.com/cdot-report-guidance",
        },
      }),
    ]);

    expect(
      screen.queryByText(/Denver DOTI Incident ID/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /View DOTI source record/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "How to obtain an official crash report (opens in a new tab)",
      }),
    ).toHaveAttribute("href", "https://example.com/cdot-report-guidance");
  });

  it("honors an explicit missing-link model", () => {
    renderCrashList([
      feature(
        {
          cdot_cuid: "CDOT-456",
          sourceLinks: {},
        },
        304214148,
      ),
    ]);

    expect(screen.getByText("DP2026473926")).toBeInTheDocument();
    expect(screen.getByText("CDOT-456")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /View DOTI source record/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: /How to request the official report/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Google Maps/ }),
    ).not.toBeInTheDocument();
  });
});
