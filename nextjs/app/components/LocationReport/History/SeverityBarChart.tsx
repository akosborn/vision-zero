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

// Stacked bottom to top with the most severe levels on the baseline, so K and A
// counts compare directly across years. No-injury (O) cases far outnumber the
// rest and would flatten the injury levels, so they're left out of the bars and
// totaled in a note instead. B and C share one color elsewhere in the
// app, so they get distinct colors here.
const SEVERITY_SERIES = [
  severitySeries("K", severityConfig.K.dotColor),
  severitySeries("A", severityConfig.A.dotColor),
  severitySeries("B", "#8b5cf6"),
  severitySeries("C", "#14b8a6"),
];

const SeverityBarChart = (props: {
  summaries: AnnualCrashSummary[];
  selectedDateRange?: { from?: string; to?: string };
}) => {
  const noInjuryCount = props.summaries.reduce(
    (total, summary) => total + summary.kabcoSeverity.O,
    0,
  );

  return (
    <AnnualBarChart
      title="Injury Severity Trends"
      description="People injured in crashes by KABCO injury level, per calendar year"
      note={`Not shown: ${noInjuryCount.toLocaleString("en-US")} No Injury, Property Damage (O) ${noInjuryCount === 1 ? "case" : "cases"}`}
      series={SEVERITY_SERIES}
      stacked
      {...props}
    />
  );
};

export default SeverityBarChart;
