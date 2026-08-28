import {
  Area,
  AreaChart,
  Legend,
  ReferenceArea,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RechartsDevtools } from "@recharts/devtools";
import { AnnualCrashSummary } from "@/app/lib/api-client";
import { severityConfig } from "@/app/components/LocationReport/CrashDetails";
import { Text } from "@mantine/core";

type AreaData = {
  Date: number;
  Fatalities: number;
  "Serious Injuries": number;
  "Minor Injury or Property Damage": number;
};

const StackedAreaChart = ({
  summaries,
  selectedDateRange,
}: {
  summaries: AnnualCrashSummary[];
  selectedDateRange?: { from?: string; to?: string };
}) => {
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
          ? "; blue shading marks the selected report period"
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
        {selectedPeriod && (
          <ReferenceArea
            x1={selectedPeriod.from}
            x2={selectedPeriod.to}
            fill="#228be6"
            fillOpacity={0.16}
            strokeOpacity={0}
            ifOverflow="hidden"
          />
        )}
        <Area
          type="monotone"
          dataKey="Minor Injury or Property Damage"
          stackId="1"
          stroke={severityConfig.O.dotColor}
          fill={severityConfig.O.dotColor}
        />
        <Area
          type="monotone"
          dataKey="Serious Injuries"
          stackId="1"
          stroke={severityConfig.A.dotColor}
          fill={severityConfig.A.dotColor}
        />
        <Area
          type="monotone"
          dataKey="Fatalities"
          stackId="1"
          stroke={severityConfig.K.dotColor}
          fill={severityConfig.K.dotColor}
        />
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

export default StackedAreaChart;
