import { Controller, Get, Query } from '@nestjs/common';
import {
  Street,
  StreetSegmentProperties,
  StreetsService,
} from './streets.service';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import {
  GetBufferedStreetParams,
  getBufferedStreetSchema,
  GetStreetCenterlinesParams,
  getStreetCenterlinesSchema,
} from './input-schemas';
import { FeatureCollection, LineString, Polygon } from 'geojson';

@Controller('streets')
export class StreetsController {
  constructor(private readonly streetService: StreetsService) {}

  @Get()
  async getStreets(): Promise<Street[]> {
    return this.streetService.getStreets();
  }

  @Get('buffered')
  async getBufferedStreetSegment(
    @Query(new ZodValidationPipe(getBufferedStreetSchema))
    query: GetBufferedStreetParams,
  ): Promise<FeatureCollection<Polygon, StreetSegmentProperties>> {
    const { fullStreetName, crossStreet1, crossStreet2, bufferInFeet } = query;

    return this.streetService.getBufferedStreetSegment(
      fullStreetName,
      crossStreet1,
      crossStreet2,
      bufferInFeet,
    );
  }

  @Get('centerline')
  async getCenterline(
    @Query(new ZodValidationPipe(getStreetCenterlinesSchema))
    query: GetStreetCenterlinesParams,
  ): Promise<FeatureCollection<LineString, StreetSegmentProperties>> {
    const { fullStreetName, crossStreet1, crossStreet2 } = query;

    return this.streetService.getCenterline(
      fullStreetName,
      crossStreet1,
      crossStreet2,
    );
  }
}
