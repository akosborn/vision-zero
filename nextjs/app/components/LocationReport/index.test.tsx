import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Feature, Point } from "geojson";
import { describe, expect, it, vi } from "vitest";

import { Crash } from "@/app/lib/api-client";

import LocationReport from ".";
import { downloadCrashCsv } from "./utils/crash-csv";

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

vi.mock("./utils/crash-csv", () => ({
  downloadCrashCsv: vi.fn(),
}));

const crashFeature: Feature<Point, Crash> = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [-104.9903, 39.7392] },
  properties: {
    doti_incident_id: "DOTI-123",
    doti_fatalities: 0,
    doti_serious_injuries: 0,
    doti_bicycle_count: 0,
    doti_pedestrian_count: 0,
    cdot_cuid: null,
  } as Crash,
};

const renderReport = ({
  crashFeatures = [crashFeature],
  isLoading = false,
}: {
  crashFeatures?: Feature<Point, Crash>[];
  isLoading?: boolean;
} = {}) =>
  render(
    <MantineProvider>
      <LocationReport
        crashSummaryHistory={null}
        isLoading={isLoading}
        searchTool="Street Search"
        crashFeatures={crashFeatures}
        setViewport={vi.fn()}
        zoomToLayer={vi.fn()}
      />
    </MantineProvider>,
  );

describe("LocationReport CSV export", () => {
  it("exports the crash features with the active search tool", async () => {
    const user = userEvent.setup();
    renderReport();

    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(downloadCrashCsv).toHaveBeenCalledWith([crashFeature], {
      searchTool: "Street Search",
      date: expect.any(Date),
    });
  });

  it.each([
    ["while loading", { isLoading: true }],
    ["without crashes", { crashFeatures: [] }],
  ])("disables export %s", (_description, props) => {
    renderReport(props);

    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });
});
