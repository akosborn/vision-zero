import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Feature, Point } from "geojson";
import { describe, expect, it, vi } from "vitest";

import { Crash } from "@/app/lib/api-client";

import LocationReport, { ExportCsvButton } from ".";
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

const renderExportButton = ({
  crashFeatures = [crashFeature],
  isLoading = false,
}: {
  crashFeatures?: Feature<Point, Crash>[];
  isLoading?: boolean;
} = {}) =>
  render(
    <MantineProvider>
      <ExportCsvButton
        isLoading={isLoading}
        searchTool="Street Search"
        crashFeatures={crashFeatures}
      />
    </MantineProvider>,
  );

describe("LocationReport CSV export", () => {
  it("exports the crash features with the active search tool", async () => {
    const user = userEvent.setup();
    renderExportButton();

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
    renderExportButton(props);

    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });
});

describe("LocationReport history availability", () => {
  const renderReport = (historyAvailable: boolean) =>
    render(
      <MantineProvider>
        <LocationReport
          isLoading={false}
          crashFeatures={[]}
          setViewport={vi.fn()}
          zoomToLayer={vi.fn()}
          crashSummaryHistory={[]}
          historyAvailable={historyAvailable}
        />
      </MantineProvider>,
    );

  it("disables History when the active search has no annual history", () => {
    renderReport(false);

    expect(screen.getByRole("radio", { name: "History" })).toBeDisabled();
  });

  it("returns to Summary when History becomes unavailable", async () => {
    const user = userEvent.setup();
    const { rerender } = renderReport(true);

    await user.click(screen.getByText("History"));
    expect(screen.getByRole("radio", { name: "History" })).toBeChecked();

    rerender(
      <MantineProvider>
        <LocationReport
          isLoading={false}
          crashFeatures={[]}
          setViewport={vi.fn()}
          zoomToLayer={vi.fn()}
          crashSummaryHistory={[]}
          historyAvailable={false}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole("radio", { name: "Summary" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "History" })).toBeDisabled();
  });
});
