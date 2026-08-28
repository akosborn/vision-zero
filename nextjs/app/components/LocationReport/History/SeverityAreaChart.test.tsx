import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnnualCrashSummary } from "@/app/lib/api-client";

import SeverityAreaChart from "./SeverityAreaChart";

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
  data: null as unknown,
  referenceAreaProps: null as Record<string, unknown> | null,
  xAxisProps: null as Record<string, unknown> | null,
}));

vi.mock("recharts", async () => {
  const React = await import("react");
  const NullComponent = () => null;

  return {
    Area: NullComponent,
    AreaChart: ({
      children,
      data,
    }: {
      children: React.ReactNode;
      data: unknown;
    }) => {
      chartHarness.data = data;
      return React.createElement("div", { "data-testid": "chart" }, children);
    },
    Legend: NullComponent,
    ReferenceArea: (props: Record<string, unknown>) => {
      chartHarness.referenceAreaProps = props;
      return null;
    },
    Tooltip: NullComponent,
    XAxis: (props: Record<string, unknown>) => {
      chartHarness.xAxisProps = props;
      return null;
    },
    YAxis: NullComponent,
  };
});

vi.mock("@recharts/devtools", () => ({
  RechartsDevtools: () => null,
}));

const summary = (year: number): AnnualCrashSummary => ({
  year,
  crashes: 10,
  fatalities: 1,
  seriousInjuries: 2,
  bicycleInvolvedCrashes: 3,
  pedestrianInvolvedCrashes: 4,
  maxSpeedMph: 35,
  crashesOverSpeedLimit: 1,
  crashesWithSpeedData: 5,
});

describe("SeverityAreaChart history period", () => {
  beforeEach(() => {
    chartHarness.data = null;
    chartHarness.referenceAreaProps = null;
    chartHarness.xAxisProps = null;
  });

  it("plots every available year and shades the exact selected dates", () => {
    const summaries = Array.from({ length: 12 }, (_, index) =>
      summary(2013 + index),
    );

    render(
      <MantineProvider>
        <SeverityAreaChart
          summaries={summaries}
          selectedDateRange={{ from: "2020-03-15", to: "2022-08-20" }}
        />
      </MantineProvider>,
    );

    expect(chartHarness.data).toHaveLength(12);
    expect(chartHarness.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ Date: Date.UTC(2013, 6, 1) }),
        expect.objectContaining({ Date: Date.UTC(2024, 6, 1) }),
      ]),
    );
    expect(chartHarness.xAxisProps?.domain).toEqual([
      Date.UTC(2013, 0, 1),
      Date.UTC(2025, 0, 1) - 1,
    ]);
    expect(chartHarness.referenceAreaProps).toMatchObject({
      x1: Date.parse("2020-03-15T00:00:00Z"),
      x2: Date.parse("2022-08-21T00:00:00Z") - 1,
      fill: "#228be6",
    });
    expect(
      screen.getByText(
        /Full-calendar-year crash outcomes; blue shading marks the selected report period/,
      ),
    ).toBeInTheDocument();
  });
});
