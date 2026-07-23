import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import type { ChatServer } from '../events';

/**
 * Socket.IO adapter backed by Redis pub/sub, so an event emitted on one
 * instance reaches clients connected to every other instance.
 *
 * The server is WebSocket-only, which removes the need for sticky sessions.
 * The adapter's classic pub/sub transport does not support connection state
 * recovery; clients catch up with `GET /rooms/:id/messages?after=`.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly adapterLogger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private origins: string[] = [];
  private pub?: Redis;
  private sub?: Redis;

  async connectToRedis(url: string, origins: string[]): Promise<void> {
    this.origins = origins;
    this.pub = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5_000,
      retryStrategy: (times) => Math.min(times * 200, 2_000),
    });
    this.sub = this.pub.duplicate();

    for (const client of [this.pub, this.sub]) {
      client.on('error', (error: Error) => {
        this.adapterLogger.warn(`Redis adapter connection error: ${error.message}`);
      });
    }

    await this.pub.ping();
    this.adapterConstructor = createAdapter(this.pub, this.sub);
    this.adapterLogger.log('Redis Socket.IO adapter connected');
  }

  override createIOServer(port: number, options?: ServerOptions): ChatServer {
    const server: ChatServer = super.createIOServer(port, {
      ...options,
      cors: { origin: this.origins, credentials: true },
      transports: ['websocket'],
      maxHttpBufferSize: 100_000,
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  override async close(server: Server): Promise<void> {
    await Promise.allSettled([this.pub?.quit(), this.sub?.quit()]);
    await super.close(server);
  }
}
