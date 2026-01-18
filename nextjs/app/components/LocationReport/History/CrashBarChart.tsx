import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { RechartsDevtools } from "@recharts/devtools";
import { AnnualCrashSummary } from "@/app/lib/api-client";
import { severityConfig } from "@/app/components/LocationReport/CrashDetails";
import { Text, Typography } from "@mantine/core";

type BarData = {
  Year: number;
  Fatalities: number;
  "Serious Injuries": number;
  "Minor Injury or Property Damage": number;
};

const StackedBarChart = ({ summaries }: { summaries: AnnualCrashSummary[] }) => {
  const data = summaries.slice(0, 10).map<BarData>((summary) => ({
    Year: summary.year,
    Fatalities: summary.fatalities,
    "Serious Injuries": summary.seriousInjuries,
    "Minor Injury or Property Damage":
      summary.crashes - summary.fatalities - summary.seriousInjuries,
  }));

  return (
    <>
      <Text size={'md'} mt={'md'} mb="0">Crash severity by year</Text>
      <BarChart
        title={'Crash severity by year'}
        style={{
          width: "100%",
          maxWidth: "700px",
          maxHeight: "70vh",
          aspectRatio: 1.618,
        }}
        responsive
        data={data}
        margin={{
          top: 20,
          right: 0,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="Year" />
        <YAxis width="auto" />
        <Tooltip />
        <Legend />
        <Bar dataKey="Fatalities" stackId="a" fill={severityConfig.K.dotColor} background />
        <Bar dataKey="Serious Injuries" stackId="a" fill={severityConfig.A.dotColor} background />
        <Bar dataKey="Minor Injury or Property Damage" stackId="a" fill={severityConfig.O.dotColor} background />
        <RechartsDevtools />
      </BarChart>
    </>
  );
};

export default StackedBarChart;
