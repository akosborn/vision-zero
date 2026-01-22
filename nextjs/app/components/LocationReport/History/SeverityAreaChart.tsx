import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { RechartsDevtools } from "@recharts/devtools";
import { AnnualCrashSummary } from "@/app/lib/api-client";
import { severityConfig } from "@/app/components/LocationReport/CrashDetails";
import { Text } from "@mantine/core";

type AreaData = {
  Year: number;
  Fatalities: number;
  "Serious Injuries": number;
  "Minor Injury or Property Damage": number;
};

const StackedAreaChart = ({ summaries }: { summaries: AnnualCrashSummary[] }) => {
  const data = summaries.slice(summaries.length - 10, summaries.length).map<AreaData>((summary) => ({
    Year: summary.year,
    Fatalities: summary.fatalities,
    "Serious Injuries": summary.seriousInjuries,
    "Minor Injury or Property Damage":
      summary.crashes - summary.fatalities - summary.seriousInjuries,
  }));

  return (
    <>
      <Text size={"sm"} mt={"md"} mb="0" fw={600}>
        Injury Severity Trends
      </Text>
      <Text size={"xs"} mt={"0"} mb="0" c="dimmed">
        Crash victim outcomes by year
      </Text>
      <AreaChart
        title={"Crash severity by year"}
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
        <XAxis dataKey="Year" />
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

export default StackedAreaChart;
