import {
  Anchor,
  Paper,
  Text,
  Group,
  Badge,
  Stack,
  ThemeIcon,
} from "@mantine/core";
import {
  IconMapPin,
  IconCalendar,
  IconDatabase,
  IconExternalLink,
  IconUser,
} from "@tabler/icons-react";
import { DateTime } from "luxon";
import { KABCO_SEVERITY_LEVEL } from "@/app/components/LocationReport/utils/location-report";
import { getSafeHttpsUrl } from "@/app/components/LocationReport/utils/crash-source-links";
import { CrashSourceLinks } from "@/app/lib/api-client";

interface IncidentItemProps {
  dotiIncidentId?: string | null;
  cdotCuid?: string | null;
  sourceLinks?: CrashSourceLinks;
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
  dotiIncidentId,
  cdotCuid,
  sourceLinks,
  type,
  kabcoSeverityLevel,
  area,
  date,
  coordinates,
  onClick,
}: IncidentItemProps) {
  const { color, dotColor } = severityConfig[kabcoSeverityLevel];
  const normalizedDotiIncidentId = dotiIncidentId?.trim();
  const normalizedCdotCuid = cdotCuid?.trim();
  const dotiRecordUrl = getSafeHttpsUrl(sourceLinks?.dotiRecordUrl);
  const cdotReportRequestUrl = getSafeHttpsUrl(
    sourceLinks?.cdotReportRequestUrl,
  );
  const stopRowClick = (event: React.MouseEvent<HTMLAnchorElement>) =>
    event.stopPropagation();

  return (
    <Paper
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

        {normalizedDotiIncidentId && (
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
              Denver DOTI Incident ID <b>{normalizedDotiIncidentId}</b>
            </Text>
          </Group>
        )}

        {normalizedCdotCuid && (
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
              CDOT crash data ID (CUID) <b>{normalizedCdotCuid}</b>
            </Text>
          </Group>
        )}

        {(dotiRecordUrl || cdotReportRequestUrl) && (
          <Group gap="md" mt="xs" wrap="wrap">
            {dotiRecordUrl && (
              <Anchor
                href={dotiRecordUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="xs"
                aria-label={`View DOTI source record for ${normalizedDotiIncidentId || "this crash"} (opens in a new tab)`}
                onClick={stopRowClick}
              >
                View DOTI source record{" "}
                <IconExternalLink size={12} aria-hidden />
              </Anchor>
            )}

            {cdotReportRequestUrl && (
              <Anchor
                href={cdotReportRequestUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="xs"
                aria-label="How to request the official report on the Colorado DMV website (opens in a new tab)"
                onClick={stopRowClick}
              >
                How to request the official report{" "}
                <IconExternalLink size={12} aria-hidden />
              </Anchor>
            )}
          </Group>
        )}

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
