import {
  Bar,
  BarChart,
  Legend,
  ReferenceArea,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RechartsDevtools } from "@recharts/devtools";
import { CrashSummary } from "@/app/lib/api-client";
import {
  SEVERITY_LABELS,
  severityConfig,
} from "@/app/components/LocationReport/CrashDetails";
import type { KABCO_SEVERITY_LEVEL } from "@/app/components/LocationReport/utils/area-crash-summary";
import { Text } from "@mantine/core";

type BarData = { year: number } & Partial<Record<string, number>>;

const HIGHLIGHT_COLOR = "#74c0fc";

// Stacked bottom to top, so the most severe levels sit on top. B, C and O share
// one color elsewhere in the app, so they get distinct colors here.
const BAR_SERIES: {
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

const SeverityBarChart = ({
  summaries,
  selectedDateRange,
}: {
  summaries: CrashSummary["annualSummary"];
  selectedDateRange?: { from?: string; to?: string };
}) => {
  const firstYear = summaries.at(0)?.year;
  const lastYear = summaries.at(-1)?.year;
  const selectedYears = getSelectedYears(selectedDateRange);
  const data = getBarData(summaries, selectedYears);
  const highlightedYears = getHighlightedYears(
    selectedYears,
    firstYear,
    lastYear,
  );

  return (
    <>
      <Text size="sm" mt="md" mb="0" fw={600}>
        Injury Severity Trends
      </Text>
      <Text size="xs" mt="0" mb="0" c="dimmed">
        People involved in crashes by KABCO injury level, per calendar year
        {highlightedYears
          ? "; blue highlighting marks where the selected report period overlaps the filtered data"
          : ""}
      </Text>
      <BarChart
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
        <XAxis dataKey="year" minTickGap={8} />
        <YAxis width={40} />
        <Tooltip
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
        {highlightedYears && (
          <ReferenceArea
            x1={highlightedYears.from}
            x2={highlightedYears.to}
            fill={HIGHLIGHT_COLOR}
            fillOpacity={0.3}
          />
        )}
        {BAR_SERIES.map((series) => (
          <Bar
            key={series.severity}
            dataKey={series.dataKey}
            stackId="kabco"
            fill={series.color}
          />
        ))}
        <RechartsDevtools />
      </BarChart>
    </>
  );
};

/**
 * One entry per calendar year, extended to cover the selected report period.
 * Years inside the history that have no crashes are plotted as zero; years
 * outside it are left empty, since there's no data for them.
 */
const getBarData = (
  summaries: CrashSummary["annualSummary"],
  selectedYears: { from: number; to: number } | null,
): BarData[] => {
  const firstYear = summaries.at(0)?.year;
  const lastYear = summaries.at(-1)?.year;
  if (firstYear === undefined || lastYear === undefined) {
    return [];
  }

  const summariesByYear = new Map(
    summaries.map((summary) => [summary.year, summary]),
  );
  const fromYear = Math.min(firstYear, selectedYears?.from ?? firstYear);
  const toYear = Math.max(lastYear, selectedYears?.to ?? lastYear);

  return Array.from({ length: toYear - fromYear + 1 }, (_, index) => {
    const year = fromYear + index;
    if (year < firstYear || year > lastYear) {
      return { year };
    }

    const summary = summariesByYear.get(year);
    return {
      year,
      ...Object.fromEntries(
        BAR_SERIES.map(({ severity, dataKey }) => [
          dataKey,
          summary?.kabcoSeverity[severity] ?? 0,
        ]),
      ),
    };
  });
};

const parseDate = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const getSelectedYears = (
  range: { from?: string; to?: string } | undefined,
) => {
  const from = parseDate(range?.from);
  const to = parseDate(range?.to);
  if (from === null || to === null || from > to) {
    return null;
  }

  return {
    from: new Date(from).getUTCFullYear(),
    to: new Date(to).getUTCFullYear(),
  };
};

/** The calendar years where the selected period overlaps the filtered data. */
const getHighlightedYears = (
  selectedYears: { from: number; to: number } | null,
  firstYear: number | undefined,
  lastYear: number | undefined,
) => {
  if (
    !selectedYears ||
    firstYear === undefined ||
    lastYear === undefined ||
    selectedYears.to < firstYear ||
    selectedYears.from > lastYear
  ) {
    return null;
  }

  return {
    from: Math.max(selectedYears.from, firstYear),
    to: Math.min(selectedYears.to, lastYear),
  };
};

export default SeverityBarChart;
