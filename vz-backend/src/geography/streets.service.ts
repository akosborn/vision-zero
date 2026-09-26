import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { FeatureCollection, LineString, Polygon } from 'geojson';
import { feetToMeters } from '../utils/feet-to-meters';

@Injectable()
export class StreetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStreets(): Promise<Street[]> {
    return this.prisma.$queryRaw<
      { fullName: string; crossStreets: string[] }[]
    >`
      select distinct
        fullname as "fullName",
        (select array_agg(distinct x order by x) from unnest(array_agg(fromname) || array_agg(toname)) t(x)) as "crossStreets"
      from public.denver_street_centerlines cl
      group by 1
      order by 1
    `;
  }

  async getBufferedStreetSegment(
    fullStreetName: string,
    crossStreet1: string,
    crossStreet2: string,
    bufferInFeet: number = 0,
  ): Promise<FeatureCollection<Polygon, StreetSegmentProperties>> {
    const bufferInMeters = feetToMeters(bufferInFeet);

    const results = await this.prisma.$queryRaw<
      {
        geojson: FeatureCollection<Polygon, StreetSegmentProperties>;
      }[]
    >`
      select
        jsonb_build_object(
          'type', 'FeatureCollection',
          'features', jsonb_build_array(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(ST_Buffer(ST_Union(geom)::geography, ${bufferInMeters})::geometry)::jsonb,
              'properties', jsonb_build_object(
                'name', ${fullStreetName}::text,
                'isBuffer', ${bufferInMeters > 0}::boolean
              )
            )
          )
        ) as geojson
      from public.get_street_segments_between(${fullStreetName}, ${crossStreet1}, ${crossStreet2}) as inputs;
    `;

    return results[0]?.geojson;
  }

  async getCenterline(
    fullStreetName: string,
    crossStreet1: string,
    crossStreet2: string,
  ): Promise<FeatureCollection<LineString, StreetSegmentProperties>> {
    const results = await this.prisma.$queryRaw<
      {
        geojson: FeatureCollection<LineString, StreetSegmentProperties>;
      }[]
    >`
      select 
        jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
        ) as geojson
      from (
        select 
          jsonb_build_object(
            'type', 'Feature',
            'id', id,
            'geometry', ST_AsGeoJSON(geom)::jsonb,
            'properties', to_jsonb(inputs) - 'gid' - 'geom'
          ) as feature
        from (
          select *
          from get_street_segments_between(
            ${fullStreetName}::varchar,
            ${crossStreet1}::varchar,
            ${crossStreet2}::varchar
          )
        ) inputs
      ) features;
    `;

    return results[0]?.geojson;
  }
}

export type Street = {
  fullName: string;
  crossStreets: string[];
};

export type StreetSegmentProperties = {
  fullName: string;
  fromName: string;
  toName: string;
  isBuffer: boolean;
};
