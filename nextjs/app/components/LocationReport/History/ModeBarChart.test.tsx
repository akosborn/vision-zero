import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnnualCrashSummary } from "@/app/lib/api-client";

import ModeBarChart from "./ModeBarChart";

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

describe("ModeBarChart", () => {
  beforeEach(() => {
    chartHarness.barProps = [];
    chartHarness.referenceAreaProps = [];
    chartHarness.data = null;
  });

  it("plots bicyclist and pedestrian crashes per year as grouped bars", () => {
    render(
      <MantineProvider>
        <ModeBarChart
          summaries={[
            summary(2023),
            { ...summary(2024), mode: { bicycle: 7, pedestrian: 0 } },
          ]}
          selectedDateRange={{ from: "2024-01-01", to: "2024-06-30" }}
        />
      </MantineProvider>,
    );

    expect(
      chartHarness.barProps.map(({ dataKey, stackId, fill }) => ({
        dataKey,
        stackId,
        fill,
      })),
    ).toEqual([
      { dataKey: "Bicyclist crashes", stackId: undefined, fill: "#f97316" },
      { dataKey: "Pedestrian crashes", stackId: undefined, fill: "#16a34a" },
    ]);
    expect(chartHarness.data).toEqual([
      { year: 2023, "Bicyclist crashes": 3, "Pedestrian crashes": 4 },
      { year: 2024, "Bicyclist crashes": 7, "Pedestrian crashes": 0 },
    ]);
    expect(chartHarness.referenceAreaProps).toEqual([
      expect.objectContaining({ x1: 2024, x2: 2024 }),
    ]);
  });
});
