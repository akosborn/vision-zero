'use client';

import React, {useEffect, useState} from 'react';
import Map, {defaultViewport, LocationSummary} from './components/map';
import {DateTime} from 'luxon';
import 'flatpickr/dist/themes/dark.css';
import {Calendar} from '@/components/ui/calendar';
import {Button} from '@/components/ui/button';
import {AlertCircleIcon, CalendarIcon, LocateFixedIcon, PopcornIcon} from 'lucide-react';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {Slider} from '@/components/ui/slider';
import {Field, FieldLabel} from '@/components/ui/field';
import {Separator} from '@/components/ui/separator';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {FeatureCollection} from 'geojson';
import {LngLatBounds} from 'mapbox-gl';
import {MapRef} from 'react-map-gl/mapbox-legacy';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';

const STREET_NAMES_OPTIONS = [
  { id: '7THAVE', label: '7th Ave' },
  { id: '29THAVE', label: '29th Ave' },
  { id: 'ALAMEDAAVE', label: 'Alameda Ave' },
  { id: 'COLFAXAVE', label: 'Colfax Ave' },
  { id: 'COLORADOBLVD', label: 'Colorado Blvd' },
  { id: 'FEDERALBLVD', label: 'Federal Blvd' },
  { id: 'LARIMERST', label: 'Larimer St' },
  { id: 'SPEERBLVD', label: 'Speer Blvd' },
  { id: 'TEJONST', label: 'Tejon St' },
  { id: 'YORKST', label: 'York St' },
];

export default function Home() {
  const mapRef = React.useRef<MapRef | null>(null);

  const [viewport, setViewport] = React.useState(defaultViewport);

  const [dateRange, setDateRange] = useState<{ from?: string; to?: string } | undefined>({
    from: DateTime.now().setZone('America/Denver').minus({months: 12}).toFormat('yyyy-MM-dd'),
    to: DateTime.now().setZone('America/Denver').toFormat('yyyy-MM-dd'),
  });
  const [radiusFeet, setRadiusFeet] = useState(20);

  const [streetName, setStreetName] = useState<string | null>(null);
  const [areaOfInterestIncidentGeoJson, setAreaOfInterestIncidentGeoJson] = React.useState<FeatureCollection | null>(null);

  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [droppedPin, setDroppedPin] = React.useState<{ lng: number, lat: number } | null>({
    lng: defaultViewport.longitude,
    lat: defaultViewport.latitude,
  });
  const [incidentGeoJson, setIncidentGeoJson] = React.useState<FeatureCollection | null>(null);

  const [locationSummary, setLocationSummary] = React.useState<LocationSummary | null>(null);

  // Function to zoom to a specific GeoJSON data object
  const zoomToLayer = (data: FeatureCollection | null) => {
    if (!data || !data.features.length || !mapRef.current) {
      return;
    }

    const bounds = new LngLatBounds();

    data.features.forEach((feature) => {
      if (feature.geometry.type === 'Point') {
        bounds.extend(feature.geometry.coordinates as [number, number]);
      } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'Polygon') {
        // For lines/polygons, we need to iterate through the nested coordinates
        const coords = (feature.geometry as any).coordinates;
        const flatten = (arr: any[]): any[] => arr.reduce((acc, val) =>
          Array.isArray(val[0]) ? acc.concat(flatten(val)) : acc.concat([val]), []);

        flatten(coords).forEach(coord => bounds.extend(coord));
      }
    });

    mapRef.current.getMap().fitBounds(bounds, {
      padding: 40,
      duration: 1000
    });
  };

  useEffect(() => {
    if (!streetName || !areaOfInterestIncidentGeoJson?.features.length) {
      return;
    }

    zoomToLayer(areaOfInterestIncidentGeoJson);
  }, [streetName, areaOfInterestIncidentGeoJson]);

  return (
    <main className="relative flex h-screen w-screen overflow-hidden">
      {/* Map Area */}
      <div className="absolute inset-0">
        <Map droppedPin={droppedPin} setLocationSummary={setLocationSummary}
             setDroppedPin={setDroppedPin} startDate={dateRange?.from} endDate={dateRange?.to} radiusFeet={radiusFeet} streetName={streetName}
             viewport={viewport} setViewport={setViewport} ref={mapRef}
             areaOfInterestIncidentGeoJson={areaOfInterestIncidentGeoJson} setAreaOfInterestIncidentGeoJson={setAreaOfInterestIncidentGeoJson}
             setStreetName={setStreetName}
             incidentGeoJson={incidentGeoJson} setIncidentGeoJson={setIncidentGeoJson}
        />
      </div>

      {/* Top Filter Panel Overlay */}
      <div className={'absolute top-4 left-4 right-4 md:top-6 md:left-6 md:right-auto z-10 flex items-start flex-col gap-2'}>
        <div className="flex items-center w-full md:w-auto">
          <Alert className="py-2 px-3">
            <AlertDescription className="text-xs md:text-sm">
              To get started, select an area of interest or click anywhere on the map.
            </AlertDescription>
          </Alert>
        </div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-6 p-3 md:p-4 rounded-lg shadow-xl bg-background text-foreground w-full md:w-auto">
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
                    ? `${DateTime.fromISO(dateRange?.from, {zone: 'America/Denver'}).toLocaleString(DateTime.DATE_MED)} - ${DateTime.fromISO(dateRange.to, {zone: 'America/Denver'}).toLocaleString(DateTime.DATE_MED)}`
                    : 'Select dates'}
                  <CalendarIcon size={14}/>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                  className={'pointer-events-auto'}
                  mode="range"
                  defaultMonth={dateRange?.from ? DateTime.fromISO(dateRange.from).toJSDate() : undefined}
                  selected={{
                    from: dateRange?.from ? DateTime.fromISO(dateRange.from).toJSDate() : undefined,
                    to: dateRange?.to ? DateTime.fromISO(dateRange.to).toJSDate() : undefined
                  }}
                  onSelect={(range) => {
                    if (!range) {
                      setDateRange(undefined);
                    }

                    setDateRange({
                      from: range?.from ? DateTime.fromJSDate(range.from).toISODate()! : undefined,
                      to: range?.to ? DateTime.fromJSDate(range.to).toISODate()! : undefined
                    });
                  }}
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className={'flex flex-col gap-2'}>
            <FieldLabel htmlFor={'area-of-interest'} className="text-xs md:text-sm">Jump to area of interest</FieldLabel>
            <Select value={streetName || ''} onValueChange={(value) => {
              setIncidentGeoJson(null);
              setAreaOfInterestIncidentGeoJson(null);
              setLocationSummary(null);
              setDroppedPin(null);
              setStreetName(value)
            }}>
              <SelectTrigger id={'area-of-interest'} className="w-full md:w-45 text-xs md:text-sm">
                <SelectValue placeholder="Select an area" />
              </SelectTrigger>
              <SelectContent>
                {STREET_NAMES_OPTIONS.map(({ id, label }) => (
                  <SelectItem key={id} value={id}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Location Summary Overlay */}
      <div className="absolute bottom-0 left-0 right-0 md:bottom-6 md:left-6 md:right-auto md:max-w-xs max-h-[40vh] md:max-h-[70vh] overflow-y-auto z-10 flex flex-col p-4 rounded-t-xl md:rounded-lg shadow-2xl bg-background text-foreground border-t md:border-none">
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-4 md:hidden" />
        <div>
          <h3 className={'font-semibold uppercase text-xs md:text-sm mb-2'}>
            {streetName ? 'Area of Interest' : 'Pinned Location' } Report
          </h3>
          <div className="flex items-center gap-4 mb-2">
            <div className={'cursor-pointer p-1'}
                 onClick={() => {
                   if (droppedPin) {
                     if (incidentGeoJson?.features.length) {
                       zoomToLayer(incidentGeoJson);
                     } else {
                       setViewport({zoom: 17, longitude: droppedPin.lng, latitude: droppedPin.lat})
                     }
                   }

                   if (streetName && areaOfInterestIncidentGeoJson) {
                     zoomToLayer(areaOfInterestIncidentGeoJson);
                   }
                 }}>
              <LocateFixedIcon size={18} className={'text-foreground'} />
            </div>
            <div className="overflow-hidden">
              <p className={'text-xs font-light truncate'}>
                {streetName && (<>{STREET_NAMES_OPTIONS.find((option) => option.id === streetName)?.label}</>)}
                {droppedPin?.lng && droppedPin?.lat && (<>{droppedPin.lng.toFixed(4)}, {droppedPin.lat.toFixed(4)}</>)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Field className="w-full">
              <FieldLabel htmlFor={'radius-feet'} className="text-xs">
                {streetName ? 'Buffer' : 'Radius'}: {radiusFeet} ft
              </FieldLabel>
              <Slider id={'radius-feet'} min={10}
                      step={10}
                      max={500}
                      value={[radiusFeet]}
                      onValueChange={(values) => setRadiusFeet(values[0])}
                      className={'h-6'}
              />
            </Field>
          </div>

          <Separator className={'my-3 md:my-4'}/>

          {locationSummary ?
            <div className="grid grid-cols-2 md:grid-cols-1 gap-x-4">
              <div className="mb-2 col-span-1">
                <span className={'text-[10px] md:text-sm uppercase tracking-tight text-muted-foreground'}>Total Crashes</span>
                <h4 className={'font-bold text-lg md:text-xl'}>{locationSummary.totalIncidents}</h4>
              </div>

              <div className="mb-2 col-span-1">
                <div className="flex items-center gap-1">
                  <span className={'text-[10px] md:text-sm uppercase tracking-tight text-muted-foreground'}>Comprehensive Cost</span>
                  <a
                    href="https://highways.dot.gov/sites/fhwa.dot.gov/files/2025-10/CrashCostFactSheet_508_OCT2025.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-500 transition-colors"
                    title="Comprehensive crash cost estimates based on KABCO Crash Costs in 2024 dollars"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 16v-4"/>
                      <path d="M12 8h.01"/>
                    </svg>
                  </a>
                </div>
                <h4 className={'font-bold text-lg md:text-xl'}>{usdFormatter.format(locationSummary.comprehensiveCosts)}</h4>
              </div>

              <Separator className="col-span-2 hidden md:block my-2" />

              {Object.entries(locationSummary.severityCounts).map(([severity, count]) => {
                if (count === 0) return null;
                return (
                  <div key={severity} className="mb-2">
                    <span className={'text-[10px] md:text-sm uppercase tracking-tight text-muted-foreground'}>{severity}</span>
                    <h4 className={'font-bold text-lg md:text-xl'}>{count}</h4>
                  </div>
                );
              })}
            </div>
            : <div className="text-sm italic">Loading report...</div>}
        </div>
      </div>

      {/* Legend Overlay - Hidden on very small screens or moved */}
      <div className="hidden sm:block absolute bottom-6 right-6 z-10 p-3 md:p-4 rounded-lg shadow-xl bg-background text-foreground border md:border-none">
        <h3 className="text-[10px] md:text-xs font-semibold mb-2 md:mb-3 tracking-wider uppercase">Crash Severity</h3>
        <div className="space-y-1 md:space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white/20"></span>
            <span className="text-sm">Fatality</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#facc15] border border-white/20"></span>
            <span className="text-sm">Serious Injury</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#22c55e] border border-white/20"></span>
            <span className="text-sm">Minor Injury or Only Property Damage</span>
          </div>
        </div>
      </div>
    </main>
  );
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
