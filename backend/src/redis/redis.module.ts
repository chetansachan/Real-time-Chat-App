import type { OnModuleDestroy } from '@nestjs/common';
import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('redisUrl'), {
      maxRetriesPerRequest: 3,
      connectTimeout: 5_000,
      retryStrategy: (times) => Math.min(times * 200, 2_000),
    });
    this.client.on('error', (error: Error) => {
      // ioredis emits errors continuously while reconnecting; log but don't crash.
      this.logger.warn(`Redis error: ${error.message}`);
    });
  }

  /** Shared connection for presence, rate limits, and other Redis-backed features. */
  get connection(): Redis {
    return this.client;
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
