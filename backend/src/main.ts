import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './chat/adapters/redis-io.adapter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = config.getOrThrow<number>('port');
  const origins = config.getOrThrow<string[]>('corsOrigins');

  // Swagger UI uses inline scripts/styles, so CSP is disabled for the docs page.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Chat API')
    .setDescription(
      'REST for auth, rooms, and message history. Realtime events are documented in the README.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  // Redis-backed Socket.IO fan-out. Also enables WebSocket-only transport.
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis(config.getOrThrow<string>('redisUrl'), origins);
  app.useWebSocketAdapter(redisAdapter);

  app.enableShutdownHooks();
  await app.listen(port);

  logger.log(`REST listening on http://localhost:${port}/api`);
  logger.log(`WebSocket listening on ws://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
  logger.log(`Health at http://localhost:${port}/health`);
}

void bootstrap();
