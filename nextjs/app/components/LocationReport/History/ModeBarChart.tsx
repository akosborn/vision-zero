import type { AnnualCrashSummary } from "@/app/lib/api-client";

import AnnualBarChart, { AnnualBarSeries } from "./AnnualBarChart";

// Grouped rather than stacked: these are separate counts, and a crash can
// occasionally involve both a bicyclist and a pedestrian.
const MODE_SERIES: AnnualBarSeries[] = [
  {
    label: "Bicyclist crashes",
    color: "#97a6c4",
    value: (summary) => summary.mode.bicycle,
  },
  {
    label: "Pedestrian crashes",
    color: "#384860",
    value: (summary) => summary.mode.pedestrian,
  },
];

const ModeBarChart = (props: {
  summaries: AnnualCrashSummary[];
  selectedDateRange?: { from?: string; to?: string };
}) => (
  <AnnualBarChart
    title="Vulnerable Road User Crashes"
    description="Crashes involving a bicyclist or pedestrian, per calendar year"
    series={MODE_SERIES}
    stacked={false}
    {...props}
  />
);

export default ModeBarChart;
