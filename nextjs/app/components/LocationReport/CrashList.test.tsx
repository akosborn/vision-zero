import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Feature, Point } from "geojson";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Crash } from "@/app/lib/api-client";

import CrashList, { DEFAULT_CRASH_LIST_FILTERS } from "./CrashList";

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

Element.prototype.scrollIntoView = vi.fn();

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

const TestCrashList = ({
  crashFeatures,
}: {
  crashFeatures: Feature<Point, Crash>[];
}) => {
  const [filters, setFilters] = React.useState(DEFAULT_CRASH_LIST_FILTERS);

  return (
    <CrashList
      crashFeatures={crashFeatures}
      filters={filters}
      onFiltersChange={setFilters}
    />
  );
};

const renderCrashList = (crashFeatures: Feature<Point, Crash>[]) =>
  render(
    <MantineProvider env="test">
      <TestCrashList crashFeatures={crashFeatures} />
    </MantineProvider>,
  );

const cdotFeature = (
  cdotCuid: string,
  properties: Partial<Crash>,
): Feature<Point, Crash> =>
  feature({
    doti_incident_id: null,
    cdot_cuid: cdotCuid,
    cdot_mhe: null,
    cdot_injury_00: 0,
    cdot_injury_01: 0,
    cdot_injury_02: 0,
    cdot_injury_03: 0,
    cdot_injury_04: 0,
    cdot_tu_1_nm_type: null,
    cdot_tu_2_nm_type: null,
    ...properties,
  });

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

describe("CrashList filters", () => {
  const severityFeatures = [
    cdotFeature("CDOT-K", { cdot_injury_04: 1 }),
    cdotFeature("CDOT-A", { cdot_injury_03: 1 }),
    cdotFeature("CDOT-B", { cdot_injury_02: 1 }),
    cdotFeature("CDOT-C", { cdot_injury_01: 1 }),
    cdotFeature("CDOT-O", { cdot_injury_00: 1 }),
  ];

  it.each([
    ["Fatal (K)", "CDOT-K"],
    ["Incapacitating Injury (A)", "CDOT-A"],
    ["Non-Incapacitating Injury (B)", "CDOT-B"],
    ["Complaint of Injury (C)", "CDOT-C"],
    ["No Injury, Property Damage (O)", "CDOT-O"],
  ])("filters the list to %s crashes", async (label, expectedCuid) => {
    const user = userEvent.setup();
    renderCrashList(severityFeatures);

    await user.click(screen.getByRole("textbox", { name: "Crash severity" }));
    await user.click(screen.getByRole("option", { name: label }));

    for (const feature of severityFeatures) {
      const cuid = feature.properties.cdot_cuid!;
      if (cuid === expectedCuid) {
        expect(screen.getByText(cuid)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(cuid)).not.toBeInTheDocument();
      }
    }
  });

  it("filters pedestrian and bicyclist crashes using CDOT involvement data", async () => {
    const user = userEvent.setup();
    renderCrashList([
      cdotFeature("CDOT-PEDESTRIAN", {
        cdot_tu_1_nm_type: "Pedestrian",
      }),
      cdotFeature("CDOT-BICYCLE", { cdot_tu_1_nm_type: "Bicyclist" }),
      cdotFeature("CDOT-VEHICLE", {}),
    ]);

    await user.click(screen.getByRole("textbox", { name: "Road user" }));
    await user.click(
      screen.getByRole("option", { name: "Pedestrian crashes" }),
    );

    expect(screen.getByText("CDOT-PEDESTRIAN")).toBeInTheDocument();
    expect(screen.queryByText("CDOT-BICYCLE")).not.toBeInTheDocument();
    expect(screen.queryByText("CDOT-VEHICLE")).not.toBeInTheDocument();

    await user.click(screen.getByRole("textbox", { name: "Road user" }));
    await user.click(screen.getByRole("option", { name: "Bicyclist crashes" }));

    expect(screen.queryByText("CDOT-PEDESTRIAN")).not.toBeInTheDocument();
    expect(screen.getByText("CDOT-BICYCLE")).toBeInTheDocument();
    expect(screen.queryByText("CDOT-VEHICLE")).not.toBeInTheDocument();
  });

  it("combines severity and road-user filters and explains empty results", async () => {
    const user = userEvent.setup();
    renderCrashList([
      cdotFeature("CDOT-FATAL-BICYCLE", {
        cdot_injury_04: 1,
        cdot_tu_1_nm_type: "Bicycle",
      }),
      cdotFeature("CDOT-FATAL-PEDESTRIAN", {
        cdot_injury_04: 1,
        cdot_tu_1_nm_type: "Pedestrian",
      }),
    ]);

    await user.click(screen.getByRole("textbox", { name: "Crash severity" }));
    await user.click(
      screen.getByRole("option", { name: "Incapacitating Injury (A)" }),
    );
    await user.click(screen.getByRole("textbox", { name: "Road user" }));
    await user.click(
      screen.getByRole("option", { name: "Pedestrian crashes" }),
    );

    expect(
      screen.getByText("No crashes match the selected filters."),
    ).toBeInTheDocument();
  });
});
