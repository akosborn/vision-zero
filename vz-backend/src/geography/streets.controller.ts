import { Controller, Get, Query } from '@nestjs/common';
import {
  Street,
  StreetSegmentProperties,
  StreetsService,
} from './streets.service';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { GetStreetCenterlinesParams, getStreetCenterlinesSchema } from './street-centerlines-schemas';
import { FeatureCollection, LineString } from 'geojson';

@Controller('streets')
export class StreetsController {
  constructor(private readonly streetService: StreetsService) {}

  @Get()
  async getStreets(): Promise<Street[]> {
    return this.streetService.getStreets();
  }

  @Get('centerlines')
  async getCenterlines(
    @Query(new ZodValidationPipe(getStreetCenterlinesSchema))
    query: GetStreetCenterlinesParams,
  ): Promise<FeatureCollection<LineString, StreetSegmentProperties>> {
    const { fullStreetName, crossStreet1, crossStreet2 } = query;

    return this.streetService.getCenterlines(
      fullStreetName,
      crossStreet1,
      crossStreet2,
    );
  }
}
