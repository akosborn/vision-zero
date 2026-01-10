import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import React from "react";
import { FeatureCollection } from "geojson";
import { LocationSummary } from "@/app/components/Map";
import { DatePickerInput } from "@mantine/dates";
import { Flex, Select } from "@mantine/core";

export const STREET_NAMES_OPTIONS = [
  { id: "7THAVE", label: "7th Ave" },
  { id: "29THAVE", label: "29th Ave" },
  { id: "ALAMEDAAVE", label: "Alameda Ave" },
  { id: "COLFAXAVE", label: "Colfax Ave" },
  { id: "COLORADOBLVD", label: "Colorado Blvd" },
  { id: "FEDERALBLVD", label: "Federal Blvd" },
  { id: "LARIMERST", label: "Larimer St" },
  { id: "SPEERBLVD", label: "Speer Blvd" },
  { id: "TEJONST", label: "Tejon St" },
  { id: "YORKST", label: "York St" },
];

type Props = {
  dateRange: { from?: string; to?: string } | undefined;
  setDateRange: React.Dispatch<
    React.SetStateAction<{ from?: string; to?: string } | undefined>
  >;
  streetName: string | null;
  setStreetName: React.Dispatch<React.SetStateAction<string | null>>;
  setAreaOfInterestIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection | null>
  >;
  incidentGeoJson: FeatureCollection | null;
  setIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection | null>
  >;
  setLocationSummary: React.Dispatch<
    React.SetStateAction<LocationSummary | null>
  >;
  droppedPin: { lng: number; lat: number } | null;
  setDroppedPin: React.Dispatch<
    React.SetStateAction<{ lng: number; lat: number } | null>
  >;
};

const FilterPanel: React.FC<Props> = ({
  dateRange,
  setDateRange,
  streetName,
  setStreetName,
  setIncidentGeoJson,
  setAreaOfInterestIncidentGeoJson,
  setLocationSummary,
  setDroppedPin,
}) => {
  return (
    <Flex
      gap={"sm"}
      justify={"flex-start"}
      align={"flex-start"}
    >
      <DatePickerInput
        type={"range"}
        label={"Date range"}
        className={"bg-background"}
        value={[dateRange?.from || null, dateRange?.to || null]}
        onChange={(values) => {
          setDateRange({
            from: values[0] || undefined,
            to: values[1] || undefined,
          });
        }}
      />

      <Select
        label={"Area of interest"}
        placeholder={"Select an area of interest"}
        searchable
        data={STREET_NAMES_OPTIONS.map((option) => ({
          value: option.id,
          label: option.label,
        }))}
        value={streetName || ""}
        onChange={(value) => {
          // @TODO: This is probably not necessary
          setIncidentGeoJson(null);
          setAreaOfInterestIncidentGeoJson(null);
          setLocationSummary(null);
          setDroppedPin(null);
          setStreetName(value);
        }}
      />
    </Flex>
  );
};

export default FilterPanel;
