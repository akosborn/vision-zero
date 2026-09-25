import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { FeatureCollection, LineString } from 'geojson';

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

  async getCenterlines(
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
          'features', coalesce(jsonb_agg(feature), '[]'::jsonb)
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
          select *,
                 fullname as "fullName",
                 fromname as "fromName",
                 toname as "toName"
          from public.get_street_segments_between(${fullStreetName}, ${crossStreet1}, ${crossStreet2})
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
};
