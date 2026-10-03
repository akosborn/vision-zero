import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnnualCrashSummary } from "@/app/lib/api-client";

import SeverityBarChart from "./SeverityBarChart";

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

const chartHarness = vi.hoisted(() => ({
  barProps: [] as Record<string, unknown>[],
  referenceAreaProps: [] as Record<string, unknown>[],
  data: null as unknown,
}));

vi.mock("recharts", async () => {
  const React = await import("react");
  const NullComponent = () => null;

  return {
    Bar: (props: Record<string, unknown>) => {
      chartHarness.barProps.push(props);
      return null;
    },
    BarChart: ({
      children,
      data,
    }: {
      children: React.ReactNode;
      data: unknown;
    }) => {
      chartHarness.data = data;
      return React.createElement("svg", { "data-testid": "chart" }, children);
    },
    Legend: NullComponent,
    ReferenceArea: (props: Record<string, unknown>) => {
      chartHarness.referenceAreaProps.push(props);
      return null;
    },
    Tooltip: NullComponent,
    XAxis: NullComponent,
    YAxis: NullComponent,
  };
});

vi.mock("@recharts/devtools", () => ({
  RechartsDevtools: () => null,
}));

const summary = (year: number): AnnualCrashSummary => ({
  year,
  count: 10,
  kabcoSeverity: { K: 1, A: 2, B: 3, C: 4, O: 5 },
  mode: { bicycle: 3, pedestrian: 4 },
  maxSpeedMph: 35,
  crashesOverSpeedLimit: 1,
  crashesWithSpeedData: 5,
});

const years = () =>
  (chartHarness.data as { year: number }[]).map(({ year }) => year);

const HIGHLIGHT_TEXT =
  /blue highlighting marks where the selected report period overlaps the filtered history/;

describe("SeverityBarChart", () => {
  beforeEach(() => {
    chartHarness.barProps = [];
    chartHarness.referenceAreaProps = [];
    chartHarness.data = null;
  });

  it("plots people at each KABCO level as stacked bars, least severe at the bottom", () => {
    render(
      <MantineProvider>
        <SeverityBarChart summaries={[summary(2024)]} />
      </MantineProvider>,
    );

    expect(
      chartHarness.barProps.map(({ dataKey, stackId, fill }) => ({
        dataKey,
        stackId,
        fill,
      })),
    ).toEqual([
      {
        dataKey: "No Injury, Property Damage (O)",
        stackId: "kabco",
        fill: "#9ca3af",
      },
      { dataKey: "Complaint of Injury (C)", stackId: "kabco", fill: "#14b8a6" },
      {
        dataKey: "Non-Incapacitating Injury (B)",
        stackId: "kabco",
        fill: "#8b5cf6",
      },
      {
        dataKey: "Incapacitating Injury (A)",
        stackId: "kabco",
        fill: "#eab308",
      },
      { dataKey: "Fatal (K)", stackId: "kabco", fill: "#ef4444" },
    ]);
    expect(chartHarness.data).toEqual([
      {
        year: 2024,
        "Fatal (K)": 1,
        "Incapacitating Injury (A)": 2,
        "Non-Incapacitating Injury (B)": 3,
        "Complaint of Injury (C)": 4,
        "No Injury, Property Damage (O)": 5,
      },
    ]);
  });

  it("plots every year in the history, with zeros for years without crashes", () => {
    render(
      <MantineProvider>
        <SeverityBarChart summaries={[summary(2020), summary(2023)]} />
      </MantineProvider>,
    );

    expect(years()).toEqual([2020, 2021, 2022, 2023]);
    expect((chartHarness.data as Record<string, number>[])[1]).toEqual({
      year: 2021,
      "Fatal (K)": 0,
      "Incapacitating Injury (A)": 0,
      "Non-Incapacitating Injury (B)": 0,
      "Complaint of Injury (C)": 0,
      "No Injury, Property Damage (O)": 0,
    });
    expect(chartHarness.referenceAreaProps).toHaveLength(0);
    expect(screen.queryByText(HIGHLIGHT_TEXT)).not.toBeInTheDocument();
  });

  it("highlights the years the selected period overlaps", () => {
    const summaries = Array.from({ length: 12 }, (_, index) =>
      summary(2013 + index),
    );

    render(
      <MantineProvider>
        <SeverityBarChart
          summaries={summaries}
          selectedDateRange={{ from: "2020-03-15", to: "2022-08-20" }}
        />
      </MantineProvider>,
    );

    expect(years()).toEqual(summaries.map(({ year }) => year));
    expect(chartHarness.referenceAreaProps).toEqual([
      expect.objectContaining({ x1: 2020, x2: 2022, fill: "#74c0fc" }),
    ]);
    expect(screen.getByText(HIGHLIGHT_TEXT)).toBeInTheDocument();
  });

  it("extends the timeline when the selected period is newer than the data", () => {
    render(
      <MantineProvider>
        <SeverityBarChart
          summaries={[summary(2021), summary(2024)]}
          selectedDateRange={{ from: "2025-08-28", to: "2026-08-28" }}
        />
      </MantineProvider>,
    );

    expect(years()).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
    // No data exists for the added years, so they have no bars at all
    expect((chartHarness.data as object[]).slice(-2)).toEqual([
      { year: 2025 },
      { year: 2026 },
    ]);
    expect(chartHarness.referenceAreaProps).toHaveLength(0);
    expect(screen.queryByText(HIGHLIGHT_TEXT)).not.toBeInTheDocument();
  });

  it("highlights only the overlap when the selected period runs past the data", () => {
    render(
      <MantineProvider>
        <SeverityBarChart
          summaries={[summary(2021), summary(2024)]}
          selectedDateRange={{ from: "2023-01-01", to: "2025-12-31" }}
        />
      </MantineProvider>,
    );

    expect(years()).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(chartHarness.referenceAreaProps).toEqual([
      expect.objectContaining({ x1: 2023, x2: 2024 }),
    ]);
  });
});
