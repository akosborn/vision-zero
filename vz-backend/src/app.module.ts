import { Module } from '@nestjs/common';
import { PrismaService } from './db/prisma.service.js';
import { StreetsController } from './geography/streets.controller';
import { StreetsService } from './geography/streets.service';

@Module({
  imports: [],
  controllers: [StreetsController],
  providers: [PrismaService, StreetsService],
})
export class AppModule {}
