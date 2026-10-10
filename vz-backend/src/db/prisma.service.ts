import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient<
    Prisma.PrismaClientOptions & { log: [{ emit: 'event'; level: 'query' }] }
  >
  implements OnModuleInit
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: configService.get('DATABASE_URL'),
    });
    super({ adapter, log: [{ emit: 'event', level: 'query' }] });
  }

  onModuleInit() {
    this.$on('query', (e) => {
      this.logger.debug(`${e.query} -- params: ${e.params} (${e.duration}ms)`);
    });
  }
}
