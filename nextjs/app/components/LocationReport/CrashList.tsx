import React from "react";
import { Feature, Geometry } from "geojson";
import { DateTime } from "luxon";
import { Container, em } from "@mantine/core";
import { CrashDetails } from "@/app/components/LocationReport/CrashDetails";
import { useMediaQuery } from "@mantine/hooks";
import { Crash } from "@/app/lib/api-client";
import { getMaxSeverity } from "@/app/components/LocationReport/utils/location-report";

type Props = {
  crashFeatures: Feature<Geometry, Crash>[];
};

const CrashList: React.FC<Props> = ({ crashFeatures }) => {
  const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

  const sortedFeatures = crashFeatures.toSorted((a, b) => {
    return (
      DateTime.fromISO(b.properties.doti_first_occurrence_date).toMillis() -
      DateTime.fromISO(a.properties.doti_first_occurrence_date).toMillis()
    );
  });

  return (
    <>
      {sortedFeatures.map(({ properties }) => {
        const type = getType(
          properties.doti_bicycle_involved,
          properties.doti_pedestrian_involved,
        );
        const severity = getMaxSeverity(properties);

        return (
          <Container key={properties.doti_incident_id} px={0} mb={"sm"}>
            <CrashDetails
              id={properties.cdot_cuid || properties.doti_incident_id}
              dataSource={properties.cdot_cuid ? 'CDOT' : 'DOTI'}
              type={type}
              kabcoSeverityLevel={severity}
              area={properties.doti_address || ""}
              date={DateTime.fromISO(properties.doti_first_occurrence_date, {
                zone: "America/Denver",
              }).toJSDate()}
              // coordinates={{ lng: (crash.cdot_geo || crash.doti_geo)!['lon'], lat: crash.geo_lat }}
              coordinates={{ lng: 0, lat: 0 }}
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

export default CrashList;
