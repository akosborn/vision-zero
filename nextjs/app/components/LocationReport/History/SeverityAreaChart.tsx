import { Area, AreaChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { RechartsDevtools } from "@recharts/devtools";
import { AnnualCrashSummary } from "@/app/lib/api-client";
import { severityConfig } from "@/app/components/LocationReport/CrashDetails";
import { Text } from "@mantine/core";
import { useId } from "react";

type AreaData = {
  Date: number;
  Fatalities: number;
  "Serious Injuries": number;
  "Minor Injury or Property Damage": number;
};

const HIGHLIGHT_COLOR = "#74c0fc";
const AREA_SERIES = [
  {
    id: "minor-or-property-damage",
    dataKey: "Minor Injury or Property Damage",
    color: severityConfig.O.dotColor,
  },
  {
    id: "serious-injuries",
    dataKey: "Serious Injuries",
    color: severityConfig.A.dotColor,
  },
  {
    id: "fatalities",
    dataKey: "Fatalities",
    color: severityConfig.K.dotColor,
  },
] as const;

const StackedAreaChart = ({
  summaries,
  selectedDateRange,
}: {
  summaries: AnnualCrashSummary[];
  selectedDateRange?: { from?: string; to?: string };
}) => {
  const gradientIdPrefix = `selected-period-${useId().replaceAll(":", "")}`;
  const data = summaries.map<AreaData>((summary) => ({
    Date: Date.UTC(summary.year, 6, 1),
    Fatalities: summary.fatalities,
    "Serious Injuries": summary.seriousInjuries,
    "Minor Injury or Property Damage":
      summary.crashes - summary.fatalities - summary.seriousInjuries,
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
        Full-calendar-year crash outcomes
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
                key={series.id}
                id={`${gradientIdPrefix}-${series.id}`}
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
            key={series.id}
            type="monotone"
            dataKey={series.dataKey}
            stackId="1"
            stroke={series.color}
            fill={
              highlightedRange
                ? `url(#${gradientIdPrefix}-${series.id})`
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
