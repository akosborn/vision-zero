import { Module } from '@nestjs/common';
import { PrismaService } from './db/prisma.service.js';
import { StreetsController } from './geography/streets.controller';
import { StreetsService } from './geography/streets.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [StreetsController],
  providers: [PrismaService, StreetsService],
})
export class AppModule {}
