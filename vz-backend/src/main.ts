import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.LOG_LEVEL === 'debug'
        ? ['error', 'warn', 'log', 'debug', 'verbose']
        : ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('api');
  app.enableVersioning();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(console.error);
