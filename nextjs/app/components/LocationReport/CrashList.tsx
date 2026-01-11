import { Incident } from "@/app/components/Map";
import React from "react";
import { Feature, Geometry } from "geojson";
import { DateTime } from "luxon";
import { Container, em } from "@mantine/core";
import { CrashDetails } from "@/app/components/LocationReport/CrashDetails";
import { useMediaQuery } from "@mantine/hooks";

type Props = {
  incidentsFeatures: Feature<Geometry, Incident>[];
};

const CrashList: React.FC<Props> = ({ incidentsFeatures }) => {
  const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

  const mappedIncidents = incidentsFeatures.map(
    (feature) => feature.properties,
  );
  const sortedIncidents = mappedIncidents.toSorted((a, b) => {
    return (
      DateTime.fromISO(b.first_occurrence_date).toMillis() -
      DateTime.fromISO(a.first_occurrence_date).toMillis()
    );
  });

  return (
    <>
      {sortedIncidents.map((incident) => {
        const type = getType(
          incident.bicycle_involved,
          incident.pedestrian_involved,
        );
        const severity = getMaxSeverity(
          incident.fatalities,
          incident.serious_injuries,
        );

        return (
          <Container key={incident.incident_id} px={0} mb={"sm"}>
            <CrashDetails
              id={incident.incident_id}
              type={type}
              severity={severity}
              area={incident.address || ""}
              date={DateTime.fromISO(incident.first_occurrence_date, {
                zone: "America/Denver",
              }).toJSDate()}
              coordinates={{ lng: incident.geo_lon, lat: incident.geo_lat }}
            />
          </Container>
        );
      })}
    </>
  );
};

const getType = (bikeInvolved: boolean, pedestrianInvolved: boolean) => {
  if (bikeInvolved) {
    return "Bicycle";
  }

  if (pedestrianInvolved) {
    return "Pedestrian";
  }

  return "Vehicle";
};

const getMaxSeverity = (fatalities: number, seriousInjuries: number) => {
  if (fatalities > 0) {
    return "Fatal";
  }

  if (seriousInjuries > 0) {
    return "SBI";
  }

  return "Other";
};

export default CrashList;
