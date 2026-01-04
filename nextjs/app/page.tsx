'use client';

import React, {useState} from 'react';
import Map, {defaultViewport, LocationSummary} from './components/map';
import {DateTime} from 'luxon';
import 'flatpickr/dist/themes/dark.css';
import {Calendar} from '@/components/ui/calendar';
import {Button} from '@/components/ui/button';
import {CalendarIcon} from 'lucide-react';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {Slider} from '@/components/ui/slider';
import {Field, FieldLabel} from '@/components/ui/field';
import {Separator} from '@/components/ui/separator';

export default function Home() {
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string } | undefined>({
    from: DateTime.now().setZone('America/Denver').minus({months: 12}).toFormat('yyyy-MM-dd'),
    to: DateTime.now().setZone('America/Denver').toFormat('yyyy-MM-dd'),
  });
  const [radiusFeet, setRadiusFeet] = useState(100);

  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [droppedPin, setDroppedPin] = React.useState<{ lng: number, lat: number } | null>({
    lng: defaultViewport.longitude,
    lat: defaultViewport.latitude,
  });
  const [locationSummary, setLocationSummary] = React.useState<LocationSummary | null>(null);

  return (
    <main className="relative flex h-screen w-screen overflow-hidden">
      {/* Map Area */}
      <div className="absolute inset-0">
        <Map droppedPin={droppedPin} locationSummary={locationSummary} setLocationSummary={setLocationSummary}
             setDroppedPin={setDroppedPin} startDate={dateRange?.from} endDate={dateRange?.to} radiusFeet={radiusFeet}/>
      </div>

      {/* Top Filter Panel Overlay */}
      <div
        className="absolute top-6 left-6 z-10 flex items-center gap-6 p-4 rounded-lg shadow-xl bg-background text-foreground">
        <div className="flex items-center gap-4 border-r pr-6">
          <div className="flex flex-col gap-3">
            <FieldLabel htmlFor="date">
              Date range
            </FieldLabel>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  id="date"
                  className="w-60 justify-between font-normal"
                >
                  {dateRange?.from && dateRange.to
                    ? `${DateTime.fromISO(dateRange?.from, {zone: 'America/Denver'}).toLocaleString(DateTime.DATE_MED)} to ${DateTime.fromISO(dateRange.to, {zone: 'America/Denver'}).toLocaleString(DateTime.DATE_MED)}`
                    : 'Select dates'}
                  <CalendarIcon size={3.5}/>
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
        </div>

        <div className="flex items-center gap-4">
          <Field>
            <FieldLabel htmlFor={'radius-feet'}>
              Location summary radius: {radiusFeet} ft
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
      </div>

      {/* Location Summary Overlay */}
      {droppedPin !== null && (
        <div
          className="absolute bottom-6 left-6 z-10 flex items-center gap-6 p-4 rounded-lg shadow-xl bg-background text-foreground">
          {dateRange?.from && dateRange.to && locationSummary ? (
            <div>
              <h3 className={'font-semibold uppercase'}>Location Summary</h3>
              <p className={'text-sm font-light mb-2'}>{droppedPin.lng}, {droppedPin.lat}</p>

              <div>
                <span className={'text-sm'}>Total Crashes</span>
                <h4 className={'mb-2 font-bold text-xl'}>{locationSummary.totalIncidents}</h4>
              </div>

              <div>
                <div className="flex items-center gap-1">
                  <span className={'text-sm'}>Total Comprehensive Cost</span>
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
                <h4 className={'mb-2 font-bold text-xl'}>{usdFormatter.format(locationSummary.comprehensiveCosts)}</h4>
              </div>

              <Separator />

              {Object.entries(locationSummary.severityCounts).map(([severity, count]) => {
                if (count === 0) {
                  return null;
                }

                return (
                  <div key={severity}>
                    <span className={'text-sm'}>{severity}</span>
                    <h4 className={'mb-2 font-bold text-xl'}>{count}</h4>
                  </div>
                );
              })}

              <Separator />

              {locationSummary.bicyclesInvolved ?
                  <div>
                      <span className={'text-sm'}>Bicyclists Involved</span>
                      <h4 className={'mb-2 font-bold text-xl'}>{locationSummary.bicyclesInvolved}</h4>
                  </div>
                : null
              }

              {locationSummary.pedestriansInvolved ?
                  <div>
                      <span className={'text-sm'}>Pedestrians Involved</span>
                      <h4 className={'mb-2 font-bold text-xl'}>{locationSummary.pedestriansInvolved}</h4>
                  </div>
                : null
              }
            </div>
          ) : (
            <p className="text-xs">Loading...</p>
          )}
        </div>
      )}

      {/* Legend Overlay */}
      <div className="absolute bottom-6 right-6 z-10 p-4 rounded-lg shadow-xl bg-background text-foreground">
        <h3 className="text-xs font-semibold mb-3 tracking-wider uppercase">Crash Severity</h3>
        <div className="space-y-2">
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
