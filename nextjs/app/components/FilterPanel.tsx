import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import React from "react";
import { FeatureCollection, Point } from "geojson";
import { DatePickerInput } from "@mantine/dates";
import { Flex, NumberInput, Select } from "@mantine/core";
import { Crash, getStreets } from "@/app/lib/api-client";
import { Street } from "@/app/api/streets/route";

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
  radiusFeet: number;
  setRadiusFeet: React.Dispatch<React.SetStateAction<number>>;
  setDateRange: React.Dispatch<
    React.SetStateAction<{ from?: string; to?: string } | undefined>
  >;
  streetName: string | null;
  setStreetName: React.Dispatch<React.SetStateAction<string | null>>;
  setAreaOfInterestIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection<Point, Crash> | null>
  >;
  incidentGeoJson: FeatureCollection<Point, Crash> | null;
  setIncidentGeoJson: React.Dispatch<
    React.SetStateAction<FeatureCollection<Point, Crash> | null>
  >;
  droppedPin: { lng: number; lat: number } | null;
  setDroppedPin: React.Dispatch<
    React.SetStateAction<{ lng: number; lat: number } | null>
  >;
};

const FilterPanel: React.FC<Props> = ({
  dateRange,
  radiusFeet,
  setDateRange,
  streetName,
  setRadiusFeet,
  setStreetName,
  setIncidentGeoJson,
  setAreaOfInterestIncidentGeoJson,
  setDroppedPin,
}) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [streets, setStreets] = React.useState<Street[]>([]);

  React.useEffect(() => {
    setIsLoading(true);

    (async () => {
      const streets = await getStreets();
      setStreets(streets);
      setIsLoading(false);
    })();
  }, []);

  return (
    <Flex gap={"sm"} justify={"flex-start"} align={"flex-start"} wrap={"wrap"}>
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
        valueFormat={"MMM D, YYYY"}
      />

      <NumberInput
        label={`${streetName ? "Buffer" : "Radius"} (ft)`}
        placeholder={`${streetName ? "Buffer" : "Radius"} in feet`}
        value={radiusFeet}
        onChange={(value) => setRadiusFeet(value as number)}
        min={5}
        max={500}
        step={10}
        style={{ width: 100 }}
      />

      <Select
        label={"Area of interest"}
        placeholder={"Select an area"}
        disabled={isLoading}
        searchable
        data={streets.map((street) => ({
          value: street.street,
          label: street.street,
        }))}
        // data={STREET_NAMES_OPTIONS.map((option) => ({
        //   value: option.id,
        //   label: option.label,
        // }))}
        value={streetName || ""}
        onChange={(value) => {
          // @TODO: This is probably not necessary
          setIncidentGeoJson(null);
          setAreaOfInterestIncidentGeoJson(null);
          setDroppedPin(null);
          setStreetName(value);
        }}
        style={{ width: 200 }}
      />
    </Flex>
  );
};

export default FilterPanel;
