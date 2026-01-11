import { Paper, Text, Group, Badge, Stack, ThemeIcon } from "@mantine/core";
import { IconMapPin, IconCalendar } from "@tabler/icons-react";
import { DateTime } from "luxon";

interface IncidentItemProps {
  id: string | number;
  type: string;
  severity: "Fatal" | "SBI" | "Other";
  area: string;
  date: Date;
  coordinates: {
    lat?: number | null;
    lng?: number | null;
  };
  onClick?: () => void;
}

const SEVERITY_LABELS: Record<IncidentItemProps["severity"], string> = {
  Fatal: "Fatal",
  SBI: "Serious Bodily Injury",
  Other: "Prop. Damage or Minor Injury",
};

export function CrashDetails({
  id,
  type,
  severity,
  area,
  date,
  coordinates,
  onClick,
}: IncidentItemProps) {
  const severityConfig = {
    Fatal: { color: "red", dotColor: "#ef4444" },
    SBI: { color: "yellow", dotColor: "#eab308" },
    Other: { color: "green", dotColor: "#22c55e" },
  };

  const { color, dotColor } = severityConfig[severity];

  return (
    <Paper
      key={id}
      p="md"
      radius="md"
      withBorder
      style={{ cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
      className="hover:shadow-md transition-shadow"
    >
      <Group justify="space-between" align="flex-start" mb="xs">
        <Group gap="xs" pl={"2px"}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: dotColor,
              flexShrink: 0,
            }}
          />
          <Text size="sm" fw={600}>
            {type}
          </Text>
        </Group>

        <Badge color={color} variant="light" size="sm">
          {SEVERITY_LABELS[severity]}
        </Badge>
      </Group>

      <Stack gap={2}>
        <Group gap="xs">
          <ThemeIcon
            size="sm"
            variant="subtle"
            color="gray"
            styles={{
              root: { justifyContent: "flex-start" },
            }}
          >
            <IconMapPin size={14} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            {area}
          </Text>
        </Group>

        <Group gap="xs">
          <ThemeIcon
            size="sm"
            variant="subtle"
            color="gray"
            styles={{
              root: { justifyContent: "flex-start" },
            }}
          >
            <IconCalendar size={14} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            {DateTime.fromJSDate(date).toLocaleString(DateTime.DATETIME_MED)}
          </Text>
        </Group>

        {!!(coordinates.lat && coordinates.lng) && (
          <Text size="xs" c="dimmed" mt="xs">
            Coordinates: {coordinates.lat.toFixed(4)},{" "}
            {coordinates.lng.toFixed(4)}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
