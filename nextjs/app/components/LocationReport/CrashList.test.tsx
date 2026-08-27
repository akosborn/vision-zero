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
  it("shows an exact DOTI source record and separate Google Maps action", () => {
    renderCrashList([feature({}, 304214148)]);

    expect(screen.getByText("DP2026473926")).toBeInTheDocument();

    const sourceLink = screen.getByRole("link", {
      name: "View DOTI source record for DP2026473926 (opens in a new tab)",
    });
    expect(sourceLink).toHaveAttribute(
      "href",
      "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325/304214148",
    );
    expectSafeExternalLink(sourceLink);

    const mapsLink = screen.getByRole("link", {
      name: "View crash location in Google Maps (opens in a new tab)",
    });
    expect(mapsLink).toHaveAttribute(
      "href",
      "https://www.google.com/maps?q=39.7856,-104.8384",
    );
    expectSafeExternalLink(mapsLink);
    expect(
      screen.queryByRole("link", {
        name: /How to request the official report/,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows both source identifiers and honest report guidance for a CDOT-enriched row", () => {
    renderCrashList([feature({ cdot_cuid: "CDOT-456" }, 304214148)]);

    expect(screen.getByText("DP2026473926")).toBeInTheDocument();
    expect(screen.getByText("CDOT-456")).toBeInTheDocument();
    expect(screen.getByText(/CDOT crash data ID \(CUID\)/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View DOTI source record/ }),
    ).toBeInTheDocument();

    const reportGuidanceLink = screen.getByRole("link", {
      name: "How to request the official report on the Colorado DMV website (opens in a new tab)",
    });
    expect(reportGuidanceLink).toHaveAttribute(
      "href",
      "https://dmv.colorado.gov/obtaining-crash-reports-or-ticket-information",
    );
    expectSafeExternalLink(reportGuidanceLink);
    expect(
      screen.queryByRole("link", { name: /View report/i }),
    ).not.toBeInTheDocument();
  });

  it("omits the DOTI identifier and action when both official identifiers are missing", () => {
    renderCrashList([
      feature({ doti_incident_id: null, cdot_cuid: "CDOT-456" }),
    ]);

    expect(
      screen.queryByText(/Denver DOTI Incident ID/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /View DOTI source record/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /How to request the official report/,
      }),
    ).toBeInTheDocument();
  });

  it("honors an explicit missing-link model while preserving the separate Maps action", () => {
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
      screen.getByRole("link", {
        name: "View crash location in Google Maps (opens in a new tab)",
      }),
    ).toBeInTheDocument();
  });

  it("omits an unsafe Google Maps URL", () => {
    renderCrashList([
      feature({ doti_google_maps_url: "data:text/html,unsafe" }, 1),
    ]);

    expect(
      screen.queryByRole("link", { name: /Google Maps/ }),
    ).not.toBeInTheDocument();
  });
});
