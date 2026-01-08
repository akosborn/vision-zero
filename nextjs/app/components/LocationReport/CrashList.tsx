import DataTable from "@/app/components/LocationReport/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Incident } from "@/app/components/Map";
import React from "react";
import { Feature, Geometry } from "geojson";
import { DateTime } from "luxon";

const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: "incident_id",
    header: "Incident ID",
  },
  {
    accessorKey: "first_occurrence_date",
    header: "Date",
    cell: ({ cell }) => {
      return DateTime.fromISO(cell.getValue() as string, {
        zone: "America/Denver",
      }).toLocaleString(DateTime.DATETIME_MED);
    },
  },
  {
    accessorKey: "top_traffic_accident_offense",
    header: "Top Traffic Accident Offense",
  },
  {
    accessorKey: "address",
    header: "Address",
  },
  {
    accessorKey: "fatalities",
    header: "Fatalities",
  },
  {
    accessorKey: "serious_injuries",
    header: "Serious Injuries",
  },
  {
    accessorKey: "pedestrian_count",
    header: "Pedestrians Involved",
  },
  {
    accessorKey: "bicycle_count",
    header: "Bikers Involved",
  },
];

type Props = {
  incidentsFeatures: Feature<Geometry, Incident>[];
};

const CrashList: React.FC<Props> = ({ incidentsFeatures }) => {
  const mappedIncidents = incidentsFeatures.map(
    (feature) => feature.properties,
  );
  const sortedIncidents = mappedIncidents.toSorted((a, b) => {
    return (
      DateTime.fromISO(b.first_occurrence_date).toMillis() -
      DateTime.fromISO(a.first_occurrence_date).toMillis()
    );
  });
  return <DataTable columns={columns} data={sortedIncidents} />;
};

export default CrashList;
