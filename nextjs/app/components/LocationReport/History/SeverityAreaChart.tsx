import { Area, AreaChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { RechartsDevtools } from "@recharts/devtools";
import { CrashSummary } from "@/app/lib/api-client";
import {
  SEVERITY_LABELS,
  severityConfig,
} from "@/app/components/LocationReport/CrashDetails";
import type { KABCO_SEVERITY_LEVEL } from "@/app/components/LocationReport/utils/area-crash-summary";
import { Text } from "@mantine/core";
import { useId } from "react";

type AreaData = { Date: number } & Record<string, number>;

const HIGHLIGHT_COLOR = "#74c0fc";

// Stacked bottom to top, so the most severe levels sit on top. B, C and O share
// one color elsewhere in the app, so they get distinct colors here.
const AREA_SERIES: {
  severity: KABCO_SEVERITY_LEVEL;
  dataKey: string;
  color: string;
}[] = [
  { severity: "O", dataKey: SEVERITY_LABELS.O, color: "#9ca3af" },
  { severity: "C", dataKey: SEVERITY_LABELS.C, color: "#14b8a6" },
  { severity: "B", dataKey: SEVERITY_LABELS.B, color: "#8b5cf6" },
  {
    severity: "A",
    dataKey: SEVERITY_LABELS.A,
    color: severityConfig.A.dotColor,
  },
  {
    severity: "K",
    dataKey: SEVERITY_LABELS.K,
    color: severityConfig.K.dotColor,
  },
];

const StackedAreaChart = ({
  summaries,
  selectedDateRange,
}: {
  summaries: CrashSummary["annualSummary"];
  selectedDateRange?: { from?: string; to?: string };
}) => {
  const gradientIdPrefix = `selected-period-${useId().replaceAll(":", "")}`;
  const data = summaries.map<AreaData>((summary) => ({
    Date: Date.UTC(summary.year, 6, 1),
    ...Object.fromEntries(
      AREA_SERIES.map(({ severity, dataKey }) => [
        dataKey,
        summary.kabcoSeverity[severity],
      ]),
    ),
  }));

  const firstYear = summaries.at(0)?.year;
  const lastYear = summaries.at(-1)?.year;
  const historyDomain =
    firstYear !== undefined && lastYear !== undefined
      ? ([Date.UTC(firstYear, 0, 1), Date.UTC(lastYear + 1, 0, 1) - 1] as const)
      : undefined;
  const selectedPeriod = getSelectedPeriod(selectedDateRange);
  const highlightedRange = getHighlightedRange(
    selectedPeriod,
    data.at(0)?.Date,
    data.at(-1)?.Date,
  );
  const chartDomain =
    historyDomain && selectedPeriod
      ? ([
          Math.min(historyDomain[0], selectedPeriod.from),
          Math.max(historyDomain[1], selectedPeriod.to),
        ] as const)
      : historyDomain;

  return (
    <>
      <Text size="sm" mt="md" mb="0" fw={600}>
        Injury Severity Trends
      </Text>
      <Text size="xs" mt="0" mb="0" c="dimmed">
        People involved in crashes by KABCO injury level, per calendar year
        {selectedPeriod
          ? "; blue highlighting marks where the selected report period overlaps available history"
          : ""}
      </Text>
      <AreaChart
        title="Crash severity by year"
        style={{
          width: "100%",
          maxWidth: "100%",
          height: 300,
          aspectRatio: 1.618,
        }}
        data={data}
        margin={{
          top: 20,
          right: 10,
          left: 0,
          bottom: 5,
        }}
      >
        <XAxis
          dataKey="Date"
          type="number"
          scale="time"
          domain={chartDomain}
          tickFormatter={(timestamp) =>
            new Date(timestamp as number).getUTCFullYear().toString()
          }
          minTickGap={24}
        />
        <YAxis width={40} />
        <Tooltip
          labelFormatter={(timestamp) =>
            new Date(timestamp as number).getUTCFullYear().toString()
          }
          contentStyle={{
            fontSize: "12px",
            padding: "5px 10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
          itemStyle={{ padding: "0px" }}
          labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
        />
        <Legend />
        {highlightedRange && (
          <defs>
            {AREA_SERIES.map((series) => (
              <linearGradient
                key={series.severity}
                id={`${gradientIdPrefix}-${series.severity}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor={series.color} />
                <stop
                  offset={`${highlightedRange.fromPercent}%`}
                  stopColor={series.color}
                />
                <stop
                  offset={`${highlightedRange.fromPercent}%`}
                  stopColor={HIGHLIGHT_COLOR}
                />
                <stop
                  offset={`${highlightedRange.toPercent}%`}
                  stopColor={HIGHLIGHT_COLOR}
                />
                <stop
                  offset={`${highlightedRange.toPercent}%`}
                  stopColor={series.color}
                />
                <stop offset="100%" stopColor={series.color} />
              </linearGradient>
            ))}
          </defs>
        )}
        {AREA_SERIES.map((series) => (
          <Area
            key={series.severity}
            type="monotone"
            dataKey={series.dataKey}
            stackId="1"
            stroke={series.color}
            fill={
              highlightedRange
                ? `url(#${gradientIdPrefix}-${series.severity})`
                : series.color
            }
          />
        ))}
        <RechartsDevtools />
      </AreaChart>
    </>
  );
};

const parseDate = (value: string | undefined, endOfDay = false) => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return endOfDay ? timestamp + 24 * 60 * 60 * 1000 - 1 : timestamp;
};

const getSelectedPeriod = (
  range: { from?: string; to?: string } | undefined,
) => {
  const from = parseDate(range?.from);
  const to = parseDate(range?.to, true);
  if (from === null || to === null || from > to) {
    return null;
  }

  return { from, to };
};

const getHighlightedRange = (
  selectedPeriod: { from: number; to: number } | null,
  dataStart: number | undefined,
  dataEnd: number | undefined,
) => {
  if (
    !selectedPeriod ||
    dataStart === undefined ||
    dataEnd === undefined ||
    dataStart >= dataEnd ||
    selectedPeriod.to < dataStart ||
    selectedPeriod.from > dataEnd
  ) {
    return null;
  }

  const duration = dataEnd - dataStart;
  return {
    fromPercent:
      ((Math.max(selectedPeriod.from, dataStart) - dataStart) / duration) * 100,
    toPercent:
      ((Math.min(selectedPeriod.to, dataEnd) - dataStart) / duration) * 100,
  };
};

export default StackedAreaChart;
