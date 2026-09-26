import { Module } from '@nestjs/common';
import { PrismaService } from './db/prisma.service.js';
import { StreetsController } from './geography/streets.controller';
import { StreetsService } from './geography/streets.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot(),
    // In-memory cache
    CacheModule.register({
      isGlobal: true,
      ttl: 5000, // 5 seconds
      max: 100,
    }),
  ],
  controllers: [StreetsController],
  providers: [PrismaService, StreetsService],
})
export class AppModule {}
