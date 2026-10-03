import type { AnnualCrashSummary } from "@/app/lib/api-client";
import {
  SEVERITY_LABELS,
  severityConfig,
} from "@/app/components/LocationReport/CrashDetails";
import type { KABCO_SEVERITY_LEVEL } from "@/app/components/LocationReport/utils/area-crash-summary";

import AnnualBarChart, { AnnualBarSeries } from "./AnnualBarChart";

const severitySeries = (
  severity: KABCO_SEVERITY_LEVEL,
  color: string,
): AnnualBarSeries => ({
  label: SEVERITY_LABELS[severity],
  color,
  value: (summary) => summary.kabcoSeverity[severity],
});

// Stacked bottom to top, so the most severe levels sit on top. B, C and O share
// one color elsewhere in the app, so they get distinct colors here.
const SEVERITY_SERIES = [
  severitySeries("O", "#9ca3af"),
  severitySeries("C", "#14b8a6"),
  severitySeries("B", "#8b5cf6"),
  severitySeries("A", severityConfig.A.dotColor),
  severitySeries("K", severityConfig.K.dotColor),
];

const SeverityBarChart = (props: {
  summaries: AnnualCrashSummary[];
  selectedDateRange?: { from?: string; to?: string };
}) => (
  <AnnualBarChart
    title="Injury Severity Trends"
    description="People involved in crashes by KABCO injury level, per calendar year"
    series={SEVERITY_SERIES}
    stacked
    {...props}
  />
);

export default SeverityBarChart;
