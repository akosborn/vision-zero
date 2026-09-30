import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { FeatureCollection, GeoJsonProperties, Point } from 'geojson';
import { CrashesService, CrashSummary } from './crashes.service';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import {
  CrashSummaryParams,
  crashSummarySchema,
  ListCrashesParams,
  listCrashesSchema,
} from './input-schemas';

@Controller({
  path: 'crashes',
  version: '1',
})
export class CrashesController {
  constructor(private readonly crashesService: CrashesService) {}
  @Post('search')
  @HttpCode(200)
  async searchCrashes(
    @Body(new ZodValidationPipe(listCrashesSchema))
    body: ListCrashesParams,
  ): Promise<FeatureCollection<Point, GeoJsonProperties>> {
    const { area, ...dateRange } = body;

    if (!dateRange.startDate && !dateRange.endDate) {
      throw new BadRequestException('At least one date range must be provided');
    }

    if (!area) {
      return this.crashesService.getCrashes(dateRange);
    }

    switch (area.type) {
      case 'bbox':
        return this.crashesService.getCrashesInBoundingBox(area, dateRange);
      case 'radius':
        return this.crashesService.getCrashesWithinRadius(area, dateRange);
      case 'street':
        return this.crashesService.getCrashesAlongStreet(area, dateRange);
      case 'route':
        return this.crashesService.getCrashesAlongRoute(area, dateRange);
    }
  }

  @Post('summary')
  @HttpCode(200)
  async getCrashSummary(
    @Body(new ZodValidationPipe(crashSummarySchema))
    body: CrashSummaryParams,
  ): Promise<CrashSummary> {
    const { area, startDate, endDate } = body;

    const dateRange = { startDate, endDate };

    switch (area.type) {
      case 'radius':
        return this.crashesService.getSummaryWithinRadius(area, dateRange);
      case 'street':
        return this.crashesService.getSummaryAlongStreet(area, dateRange);
      case 'route':
        return this.crashesService.getSummaryAlongRoute(area, dateRange);
    }
  }
}
