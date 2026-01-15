import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import React from "react";
import {FeatureCollection, Point} from "geojson";
import {DatePickerInput} from "@mantine/dates";
import {Flex, NumberInput, Select} from "@mantine/core";
import {Crash, getStreets} from "@/app/lib/api-client";
import {Street} from "@/app/api/streets/route";

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
  selectedStreetSegment: {
    fullName?: string;
    crossStreets?: { from?: string; to?: string };
  } | null;
  setSelectedStreetSegment: React.Dispatch<
    React.SetStateAction<
      | {
          fullName?: string;
          crossStreets?: { from?: string; to?: string };
        }
      | null
    >
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
  selectedStreetSegment,
  setSelectedStreetSegment,
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

  const crossStreetsToDisplay = React.useMemo(() => {
    if (!selectedStreetSegment?.fullName) {
      return [];
    }

    const street = streets.find(
      ({ fullName }) => fullName === selectedStreetSegment.fullName,
    );
    return street?.crossingStreets || [];
  }, [streets, selectedStreetSegment?.fullName]);

  const fromCrossStreetsToDisplay = crossStreetsToDisplay.filter(
    (crossStreet) => crossStreet !== selectedStreetSegment?.crossStreets?.to,
  );
  const toCrossStreetsToDisplay = crossStreetsToDisplay.filter(
    (crossStreet) =>
      crossStreet !== selectedStreetSegment?.crossStreets?.from,
  );

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
        label={"Street"}
        placeholder={"Search for a street"}
        disabled={isLoading}
        searchable
        data={streets.map(({ fullName }) => fullName)}
        limit={20}
        value={selectedStreetSegment?.fullName || null}
        onChange={(value) => {
          // @TODO: This is probably not necessary
          setIncidentGeoJson(null);
          setAreaOfInterestIncidentGeoJson(null);
          setDroppedPin(null);
          setStreetName(value);
          setSelectedStreetSegment({ fullName: value || undefined });
        }}
        style={{ width: 200 }}
      />

      <Select
        label={"From Cross street"}
        disabled={isLoading || !selectedStreetSegment?.fullName}
        searchable
        data={fromCrossStreetsToDisplay}
        limit={20}
        value={selectedStreetSegment?.crossStreets?.from || null}
        onChange={(value) => {
          // @TODO: This is probably not necessary
          setIncidentGeoJson(null);
          setAreaOfInterestIncidentGeoJson(null);
          setDroppedPin(null);
          setStreetName(value);
          setSelectedStreetSegment((prev) => ({
            ...prev,
            crossStreets: { from: value || undefined },
          }));
        }}
        style={{ width: 200 }}
      />

      <Select
        label={"To Cross street"}
        disabled={isLoading || !selectedStreetSegment?.fullName}
        searchable
        data={toCrossStreetsToDisplay}
        limit={20}
        value={selectedStreetSegment?.crossStreets?.to || null}
        onChange={(value) => {
          // @TODO: This is probably not necessary
          setIncidentGeoJson(null);
          setAreaOfInterestIncidentGeoJson(null);
          setDroppedPin(null);
          setStreetName(value);
          setSelectedStreetSegment((prev) => ({
            ...prev,
            crossStreets: {
              ...prev?.crossStreets,
              to: value || undefined,
            },
          }));
        }}
        style={{ width: 200 }}
      />
    </Flex>
  );
};

export default FilterPanel;
