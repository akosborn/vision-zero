import { Paper, Text, Group, Badge, Stack, ThemeIcon } from "@mantine/core";
import {
  IconMapPin,
  IconCalendar,
  IconDatabase,
  IconUser,
} from "@tabler/icons-react";
import { DateTime } from "luxon";
import { KABCO_SEVERITY_LEVEL } from "@/app/components/LocationReport/utils/location-report";

interface IncidentItemProps {
  id: string | number;
  dataSource: "DOTI" | "CDOT";
  type: string;
  kabcoSeverityLevel: KABCO_SEVERITY_LEVEL;
  area: string;
  date: Date;
  demographics: { age: number; sex: string }[];
  coordinates: {
    lat?: number | null;
    lng?: number | null;
  };
  onClick?: () => void;
}

export const SEVERITY_LABELS: Record<
  IncidentItemProps["kabcoSeverityLevel"],
  string
> = {
  K: "Fatal (K)",
  A: "Incapacitating Injury (A)",
  B: "Non-Incapacitating Injury (B)",
  C: "Complaint of Injury (C)",
  O: "No Injury, Property Damage (O)",
};

export const severityConfig = {
  K: { color: "red", dotColor: "#ef4444" },
  A: { color: "yellow", dotColor: "#eab308" },
  B: { color: "blue", dotColor: "#145480" },
  C: { color: "blue", dotColor: "#145480" },
  O: { color: "blue", dotColor: "#145480" },
};

export function CrashDetails({
  demographics,
  id,
  dataSource,
  type,
  kabcoSeverityLevel,
  area,
  date,
  coordinates,
  onClick,
}: IncidentItemProps) {
  const { color, dotColor } = severityConfig[kabcoSeverityLevel];

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
        <Group gap="xs" pl="2px">
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
          {SEVERITY_LABELS[kabcoSeverityLevel]}
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

        {demographics.length > 0 && (
          <Group gap="xs">
            <ThemeIcon
              size="sm"
              variant="subtle"
              color="gray"
              styles={{
                root: { justifyContent: "flex-start" },
              }}
            >
              <IconUser size={14} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {demographics.map(({ age, sex }) => `${age}${sex}`)}
            </Text>
          </Group>
        )}

        <Group gap="xs">
          <ThemeIcon
            size="sm"
            variant="subtle"
            color="gray"
            styles={{
              root: { justifyContent: "flex-start" },
            }}
          >
            <IconDatabase size={14} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            {dataSource === "CDOT" ? (
              <>
                CO Dept. of Transportation CUID <b>{id}</b>
              </>
            ) : (
              <>
                Denver DOTI Incident ID <b>{id}</b>
              </>
            )}
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
