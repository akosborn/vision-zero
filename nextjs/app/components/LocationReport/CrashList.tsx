import React from "react";
import { Feature, Geometry, Point } from "geojson";
import { DateTime } from "luxon";
import { Container } from "@mantine/core";
import { CrashDetails } from "@/app/components/LocationReport/CrashDetails";
import { Crash } from "@/app/lib/api-client";
import { getMaxSeverity } from "@/app/components/LocationReport/utils/location-report";
import { getCrashSourceLinks } from "@/app/components/LocationReport/utils/crash-source-links";

type Props = {
  crashFeatures: Feature<Geometry, Crash>[];
};

const CrashList: React.FC<Props> = ({ crashFeatures }) => {
  const sortedFeatures = crashFeatures.toSorted((a, b) => {
    return (
      DateTime.fromISO(b.properties.doti_first_occurrence_date).toMillis() -
      DateTime.fromISO(a.properties.doti_first_occurrence_date).toMillis()
    );
  });

  return (
    <>
      {sortedFeatures.map(({ id: featureId, geometry, properties }) => {
        const type = getType(
          properties.doti_bicycle_involved,
          properties.doti_pedestrian_involved,
        );
        const severity = getMaxSeverity(properties);

        const [lng, lat] = (geometry as Point).coordinates;
        const sourceLinks = getCrashSourceLinks(properties, featureId);
        const rowKey =
          featureId ??
          properties.doti_incident_id ??
          properties.cdot_cuid ??
          `${lng},${lat},${properties.doti_first_occurrence_date}`;

        return (
          <Container key={rowKey} px={0} mb="sm">
            <CrashDetails
              dotiIncidentId={properties.doti_incident_id}
              cdotCuid={properties.cdot_cuid}
              sourceLinks={sourceLinks}
              googleMapsUrl={properties.doti_google_maps_url}
              type={type}
              kabcoSeverityLevel={severity}
              area={properties.doti_address || ""}
              date={DateTime.fromISO(properties.doti_first_occurrence_date, {
                zone: "America/Denver",
              }).toJSDate()}
              coordinates={{ lat, lng }}
              // @ts-ignore
              demographics={[
                properties.cdot_tu_1_age && properties.cdot_tu_1_sex
                  ? {
                      age: properties.cdot_tu_1_age,
                      sex: properties.cdot_tu_1_sex,
                    }
                  : null,
                properties.cdot_tu_2_age && properties.cdot_tu_2_sex
                  ? {
                      age: properties.cdot_tu_2_age,
                      sex: properties.cdot_tu_2_sex,
                    }
                  : null,
              ].filter((d) => d)}
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
