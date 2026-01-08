import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DateTime } from "luxon";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React from "react";
import { FeatureCollection } from "geojson";
import { LocationSummary } from "@/app/components/map";

const STREET_NAMES_OPTIONS = [
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
  calendarOpen: boolean;
  setCalendarOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
  calendarOpen,
  setCalendarOpen,
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
    <>
      <div className="flex flex-col gap-2 md:border-r md:pr-6">
        <FieldLabel htmlFor="date" className="text-xs md:text-sm">
          Date range
        </FieldLabel>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id="date"
              className="w-full md:w-60 justify-between font-normal text-xs md:text-sm"
            >
              {dateRange?.from && dateRange.to
                ? `${DateTime.fromISO(dateRange?.from, { zone: "America/Denver" }).toLocaleString(DateTime.DATE_MED)} - ${DateTime.fromISO(dateRange.to, { zone: "America/Denver" }).toLocaleString(DateTime.DATE_MED)}`
                : "Select dates"}
              <CalendarIcon size={14} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              className={"pointer-events-auto"}
              mode="range"
              defaultMonth={
                dateRange?.from
                  ? DateTime.fromISO(dateRange.from).toJSDate()
                  : undefined
              }
              selected={{
                from: dateRange?.from
                  ? DateTime.fromISO(dateRange.from).toJSDate()
                  : undefined,
                to: dateRange?.to
                  ? DateTime.fromISO(dateRange.to).toJSDate()
                  : undefined,
              }}
              onSelect={(range) => {
                if (!range) {
                  setDateRange(undefined);
                }

                setDateRange({
                  from: range?.from
                    ? DateTime.fromJSDate(range.from).toISODate()!
                    : undefined,
                  to: range?.to
                    ? DateTime.fromJSDate(range.to).toISODate()!
                    : undefined,
                });
              }}
              captionLayout="dropdown"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className={"flex flex-col gap-2 flex-grow-1"}>
        <FieldLabel htmlFor={"area-of-interest"} className="text-xs md:text-sm">
          Jump to area of interest
        </FieldLabel>
        <Select
          value={streetName || ""}
          onValueChange={(value) => {
            setIncidentGeoJson(null);
            setAreaOfInterestIncidentGeoJson(null);
            setLocationSummary(null);
            setDroppedPin(null);
            setStreetName(value);
          }}
        >
          <SelectTrigger
            id={"area-of-interest"}
            className="w-full md:w-45 text-xs md:text-sm"
          >
            <SelectValue placeholder="Select an area" />
          </SelectTrigger>
          <SelectContent>
            {STREET_NAMES_OPTIONS.map(({ id, label }) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
};

export default FilterPanel;
