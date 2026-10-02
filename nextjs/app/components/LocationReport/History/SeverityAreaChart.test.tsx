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
  areaProps: [] as Record<string, unknown>[],
  data: null as unknown,
  xAxisProps: null as Record<string, unknown> | null,
}));

vi.mock("recharts", async () => {
  const React = await import("react");
  const NullComponent = () => null;

  return {
    Area: (props: Record<string, unknown>) => {
      chartHarness.areaProps.push(props);
      return null;
    },
    AreaChart: ({
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
    chartHarness.areaProps = [];
    chartHarness.data = null;
    chartHarness.xAxisProps = null;
  });

  it("plots every available year and confines highlighting to the area curves", () => {
    const summaries = Array.from({ length: 12 }, (_, index) =>
      summary(2013 + index),
    );

    const { container } = render(
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

    const gradients = container.querySelectorAll("linearGradient");
    expect(gradients).toHaveLength(3);
    expect(chartHarness.areaProps).toHaveLength(3);
    for (const area of chartHarness.areaProps) {
      expect(area.fill).toMatch(/^url\(#selected-period-.+\)$/);
    }

    const stops = gradients[0].querySelectorAll("stop");
    const dataStart = Date.UTC(2013, 6, 1);
    const dataEnd = Date.UTC(2024, 6, 1);
    const duration = dataEnd - dataStart;
    const expectedFrom =
      ((Date.parse("2020-03-15T00:00:00Z") - dataStart) / duration) * 100;
    const expectedTo =
      ((Date.parse("2022-08-21T00:00:00Z") - 1 - dataStart) / duration) * 100;

    expect(stops).toHaveLength(6);
    expect(
      Number.parseFloat(stops[1].getAttribute("offset") ?? ""),
    ).toBeCloseTo(expectedFrom);
    expect(
      Number.parseFloat(stops[2].getAttribute("offset") ?? ""),
    ).toBeCloseTo(expectedFrom);
    expect(
      Number.parseFloat(stops[3].getAttribute("offset") ?? ""),
    ).toBeCloseTo(expectedTo);
    expect(
      Number.parseFloat(stops[4].getAttribute("offset") ?? ""),
    ).toBeCloseTo(expectedTo);
    expect(stops[2]).toHaveAttribute("stop-color", "#74c0fc");
    expect(stops[3]).toHaveAttribute("stop-color", "#74c0fc");
    expect(
      screen.getByText(
        /blue highlighting marks where the selected report period overlaps available history/,
      ),
    ).toBeInTheDocument();
  });

  it("extends the timeline when the selected period is newer than the data", () => {
    const { container } = render(
      <MantineProvider>
        <SeverityAreaChart
          summaries={[summary(2021), summary(2024)]}
          selectedDateRange={{ from: "2025-08-28", to: "2026-08-28" }}
        />
      </MantineProvider>,
    );

    expect(chartHarness.xAxisProps?.domain).toEqual([
      Date.UTC(2021, 0, 1),
      Date.parse("2026-08-29T00:00:00Z") - 1,
    ]);
    expect(container.querySelectorAll("linearGradient")).toHaveLength(0);
    expect(chartHarness.areaProps.map((area) => area.fill)).toEqual([
      "#145480",
      "#eab308",
      "#ef4444",
    ]);
  });
});
