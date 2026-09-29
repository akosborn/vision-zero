import { Injectable } from '@nestjs/common';
import { FeatureCollection, GeoJsonProperties, Point } from 'geojson';
import { PrismaService } from '../db/prisma.service';
import { Prisma } from '../db/generated/prisma/client';
import { feetToMeters } from '../utils/feet-to-meters';
import {
  BoundingBoxArea,
  DateRange,
  RadiusArea,
  RouteArea,
  StreetArea,
} from './input-schemas';

@Injectable()
export class CrashesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCrashes(
    dateRange: DateRange,
  ): Promise<FeatureCollection<Point, GeoJsonProperties>> {
    return this.queryCrashes(dateRange);
  }

  async getCrashesInBoundingBox(
    { bbox }: BoundingBoxArea,
    dateRange: DateRange,
  ): Promise<FeatureCollection<Point, GeoJsonProperties>> {
    return this.queryCrashes(
      dateRange,
      this.inBoundingBox(CRASH_GEOMETRY, bbox),
    );
  }

  async getCrashesWithinRadius(
    area: RadiusArea,
    dateRange: DateRange,
  ): Promise<FeatureCollection<Point, GeoJsonProperties>> {
    return this.queryCrashes(
      dateRange,
      this.withinRadius(CRASH_GEOMETRY, area),
    );
  }

  async getCrashesAlongStreet(
    area: StreetArea,
    dateRange: DateRange,
  ): Promise<FeatureCollection<Point, GeoJsonProperties>> {
    return this.queryCrashes(dateRange, this.alongStreet(CRASH_GEOMETRY, area));
  }

  async getCrashesAlongRoute(
    area: RouteArea,
    dateRange: DateRange,
  ): Promise<FeatureCollection<Point, GeoJsonProperties>> {
    return this.queryCrashes(dateRange, this.alongRoute(CRASH_GEOMETRY, area));
  }

  async getSummaryWithinRadius(area: RadiusArea): Promise<CrashSummary> {
    return this.summarize(this.withinRadius(INCIDENT_GEOMETRY, area));
  }

  async getSummaryAlongStreet(area: StreetArea): Promise<CrashSummary> {
    return this.summarize(this.alongStreet(INCIDENT_GEOMETRY, area));
  }

  async getSummaryAlongRoute(area: RouteArea): Promise<CrashSummary> {
    return this.summarize(this.alongRoute(INCIDENT_GEOMETRY, area));
  }

  private async queryCrashes(
    { startDate, endDate }: DateRange,
    spatialCondition?: Prisma.Sql,
  ): Promise<FeatureCollection<Point, GeoJsonProperties>> {
    const conditions = [
      spatialCondition,
      startDate &&
        Prisma.sql`vc.doti_first_occurrence_date >= ${startDate}::date`,
      endDate && Prisma.sql`vc.doti_first_occurrence_date <= ${endDate}::date`,
    ].filter((condition) => !!condition);
    const whereClause = conditions.length
      ? Prisma.sql`where ${Prisma.join(conditions, ' and ')}`
      : Prisma.empty;

    const results = await this.prisma.$queryRaw<
      { geojson: FeatureCollection<Point, GeoJsonProperties> }[]
    >`
      select
        jsonb_build_object(
          'type', 'FeatureCollection',
          'features', coalesce(jsonb_agg(feature), '[]'::jsonb)
        ) as geojson
      from (
        select
          jsonb_build_object(
            'type', 'Feature',
            'id', doti_object_id,
            'geometry', ST_AsGeoJSON(priority_geo)::jsonb,
            'properties', to_jsonb(inputs) - 'doti_object_id' - 'doti_geo' - 'cdot_geo'
          ) as feature
        from (
          select vc.*
          from vision_zero.vw_crashes vc
          ${whereClause}
        ) inputs
      ) features;
    `;

    return results[0].geojson;
  }

  private async summarize(spatialCondition: Prisma.Sql): Promise<CrashSummary> {
    return {
      annualSummary: await this.queryAnnualSummary(spatialCondition),
    };
  }

  private async queryAnnualSummary(
    spatialCondition: Prisma.Sql,
  ): Promise<AnnualCrashSummary[]> {
    return this.prisma.$queryRaw<AnnualCrashSummary[]>`
      select
        date_part('year', doti.first_occurrence_date)::int as year,
        count(*)::int as crashes,
        coalesce(sum(
          case
            when cdot.cuid is not null then cdot.number_killed
            when doti.fatalities > 0 then doti.fatalities
            when upper(doti.top_traffic_accident_offense) like '%FATAL%' then 1
            else 0
          end
        ), 0)::int as fatalities,
        coalesce(sum(
          case
            when cdot.cuid is not null then cdot.injury_03
            when doti.seriously_injured > 0 then doti.seriously_injured
            when upper(doti.top_traffic_accident_offense) like '%SBI%' then 1
            else 0
          end
        ), 0)::int as "seriousInjuries",
        coalesce(sum(
          case
            when doti.bicycle_ind > 0 then doti.bicycle_ind
            when lower(cdot.tu_1_nm_type) like '%bicycle%' then 1
            when lower(cdot.tu_1_nm_type) like '%cyclist%' then 1
            when lower(cdot.tu_1_nm_type) like '%non-motorist%' then 1
            when lower(cdot.tu_1_nm_type) like '%scooter%' then 1
            when lower(cdot.tu_2_nm_type) like '%bicycle%' then 1
            when lower(cdot.tu_2_nm_type) like '%cyclist%' then 1
            when lower(cdot.tu_2_nm_type) like '%non-motorist%' then 1
            when lower(cdot.tu_2_nm_type) like '%scooter%' then 1
            else 0
          end
        ), 0)::int as "bicycleInvolvedCrashes",
        coalesce(sum(
          case
            when doti.pedestrian_ind > 0 then doti.pedestrian_ind
            when lower(cdot.tu_1_nm_type) like '%pedestrian%' then 1
            when lower(cdot.tu_1_nm_type) like '%personal conveyance%' then 1
            when lower(cdot.tu_1_nm_type) like '%wheelchair%' then 1
            when lower(cdot.tu_2_nm_type) like '%pedestrian%' then 1
            when lower(cdot.tu_2_nm_type) like '%personal conveyance%' then 1
            when lower(cdot.tu_2_nm_type) like '%wheelchair%' then 1
            else 0
          end
        ), 0)::int as "pedestrianInvolvedCrashes",
        max(greatest(cdot.tu_1_estimated_speed, cdot.tu_2_estimated_speed))::float8 as "maxSpeedMph",
        count(*) filter (
          where cdot.tu_1_estimated_speed > cdot.tu_1_speed_limit
             or cdot.tu_2_estimated_speed > cdot.tu_2_speed_limit
        )::int as "crashesOverSpeedLimit",
        count(*) filter (
          where cdot.tu_1_estimated_speed > 0
             or cdot.tu_2_estimated_speed > 0
        )::int as "crashesWithSpeedData"
      from vision_zero.incidents_denver doti
        -- 200 meters. This is somewhat arbitrary, but it should be fine since the dates and times have to match.
        left join vision_zero.cdot_crashes cdot on
          ST_DWithin(cdot.geo, doti.geo, 200)
          and doti.first_occurrence_date =
            (cdot.crash_date + cdot.crash_time) at time zone 'UTC' at time zone 'America/Denver'
          and cdot.suspected_duplicate = false
      where ${spatialCondition}
      group by 1
      order by 1
    `;
  }

  /**
   * Spatial conditions. Each takes the geometry column to filter on since the
   * crash and history queries select from different tables.
   */

  private inBoundingBox(geometry: Prisma.Sql, bbox: BoundingBoxArea['bbox']) {
    const [minLongitude, minLatitude, maxLongitude, maxLatitude] = bbox;

    return Prisma.sql`
      ST_Intersects(
        ${geometry},
        ST_MakeEnvelope(${minLongitude}::float8, ${minLatitude}::float8, ${maxLongitude}::float8, ${maxLatitude}::float8, 4326)
      )
    `;
  }

  private withinRadius(
    geometry: Prisma.Sql,
    { lat, lng, radiusInFeet }: RadiusArea,
  ) {
    return Prisma.sql`
      ST_DWithin(
        ${geometry},
        ST_SetSRID(ST_Point(${lng}::float8, ${lat}::float8), 4326)::geography,
        ${feetToMeters(radiusInFeet)}::float8
      )
    `;
  }

  private alongStreet(
    geometry: Prisma.Sql,
    { fullStreetName, crossStreets, bufferInFeet }: StreetArea,
  ) {
    const segments = crossStreets
      ? Prisma.sql`
          select geom
          from public.get_street_segments_between(${fullStreetName}::varchar, ${crossStreets[0]}::varchar, ${crossStreets[1]}::varchar)
        `
      : Prisma.sql`
          select geom
          from public.denver_street_centerlines
          where fullname = ${fullStreetName}::varchar
        `;

    return Prisma.sql`
      ST_Intersects(
        ${geometry},
        (
          select ST_Buffer(ST_Union(geom)::geography, ${feetToMeters(bufferInFeet)}::float8)::geometry
          from (${segments}) segments
        )
      )
    `;
  }

  private alongRoute(geometry: Prisma.Sql, { route, bufferInFeet }: RouteArea) {
    return Prisma.sql`
      ST_Intersects(
        ${geometry},
        (
          select ST_Buffer(
            ST_Union(ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON(route_geometry)), 4326))::geography,
            ${feetToMeters(bufferInFeet)}::float8
          )::geometry
          from jsonb_array_elements(${JSON.stringify(route)}::jsonb) as route_geometry
        )
      )
    `;
  }
}

const CRASH_GEOMETRY = Prisma.raw('vc.priority_geo');
const INCIDENT_GEOMETRY = Prisma.raw('doti.priority_geo');

export type CrashSummary = {
  annualSummary: AnnualCrashSummary[];
};

export type AnnualCrashSummary = {
  year: number;
  crashes: number;
  fatalities: number;
  seriousInjuries: number;
  bicycleInvolvedCrashes: number;
  pedestrianInvolvedCrashes: number;
  maxSpeedMph: number | null;
  crashesOverSpeedLimit: number;
  crashesWithSpeedData: number;
};
