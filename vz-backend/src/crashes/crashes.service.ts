import { Injectable } from '@nestjs/common';
import { FeatureCollection, GeoJsonProperties, Point } from 'geojson';
import { PrismaService } from '../db/prisma.service';
import { Prisma } from '../db/generated/prisma/client';
import { feetToMeters } from '../utils/feet-to-meters';
import {
  AnnualCrashSummary,
  AnnualSummarizableCrash,
  generateAnnualCrashSummaries,
} from './area-crash-summary';
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

  async getSummaryWithinRadius(
    area: RadiusArea,
    dateRange: DateRange,
  ): Promise<CrashSummary> {
    return this.summarize(this.withinRadius(CRASH_GEOMETRY, area), dateRange);
  }

  async getSummaryAlongStreet(
    area: StreetArea,
    dateRange: DateRange,
  ): Promise<CrashSummary> {
    return this.summarize(this.alongStreet(CRASH_GEOMETRY, area), dateRange);
  }

  async getSummaryAlongRoute(
    area: RouteArea,
    dateRange: DateRange,
  ): Promise<CrashSummary> {
    return this.summarize(this.alongRoute(CRASH_GEOMETRY, area), dateRange);
  }

  private async queryCrashes(
    dateRange: DateRange,
    spatialCondition?: Prisma.Sql,
  ): Promise<FeatureCollection<Point, GeoJsonProperties>> {
    const whereClause = this.crashesWhere(dateRange, spatialCondition);

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

  private async summarize(
    spatialCondition: Prisma.Sql,
    dateRange: DateRange,
  ): Promise<CrashSummary> {
    // Only the columns the summary reads. Selecting every `vw_crashes` column
    // for an area's full history is several times slower.
    const results = await this.prisma.$queryRaw<
      { crashes: AnnualSummarizableCrash[] }[]
    >`
      select coalesce(jsonb_agg(to_jsonb(inputs)), '[]'::jsonb) as crashes
      from (
        select
          vc.doti_incident_id,
          vc.doti_first_occurrence_date,
          vc.doti_fatalities,
          vc.doti_serious_injuries,
          vc.doti_bicycle_count,
          vc.doti_pedestrian_count,
          vc.cdot_cuid,
          vc.cdot_mhe,
          vc.cdot_injury_00,
          vc.cdot_injury_01,
          vc.cdot_injury_02,
          vc.cdot_injury_03,
          vc.cdot_injury_04,
          vc.cdot_tu_1_nm_type,
          vc.cdot_tu_2_nm_type,
          vc.cdot_tu_1_estimated_speed,
          vc.cdot_tu_2_estimated_speed,
          vc.cdot_tu_1_speed_limit,
          vc.cdot_tu_2_speed_limit
        from vision_zero.vw_crashes vc
        ${this.crashesWhere(dateRange, spatialCondition)}
      ) inputs;
    `;

    return {
      annualSummary: generateAnnualCrashSummaries(results[0].crashes),
    };
  }

  private crashesWhere(
    { startDate, endDate }: DateRange,
    spatialCondition?: Prisma.Sql,
  ) {
    const conditions = [
      spatialCondition,
      startDate &&
        Prisma.sql`vc.doti_first_occurrence_date >= ${startDate}::date`,
      // Inclusive of the whole end date, not just its midnight
      endDate &&
        Prisma.sql`vc.doti_first_occurrence_date < ${endDate}::date + 1`,
    ].filter((condition) => !!condition);

    return conditions.length
      ? Prisma.sql`where ${Prisma.join(conditions, ' and ')}`
      : Prisma.empty;
  }

  /**
   * Spatial conditions on the given geometry column.
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

export type CrashSummary = {
  annualSummary: AnnualCrashSummary[];
};
