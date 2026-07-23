import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.module';
import { MembershipService } from '../rooms/membership.service';
import type { PresenceEntry, PresenceSnapshot } from './events';
import { RealtimeService } from './realtime.service';

const CONNECTIONS_KEY = 'presence:connections';
const LAST_SEEN_KEY = 'presence:lastSeenAt';
const MAX_PEERS = 500;

/**
 * Redis-backed presence. Each socket increments a per-user connection counter,
 * so multiple tabs on multiple instances collapse into one online/offline
 * transition. Counts are decremented on disconnect; a crashed process can leave
 * a stale count until that user reconnects (documented limitation).
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly membership: MembershipService,
    private readonly realtime: RealtimeService,
  ) {}

  async markOnline(userId: string, roomIds: string[]): Promise<void> {
    const count = await this.redis.connection.hincrby(CONNECTIONS_KEY, userId, 1);
    if (count !== 1) {
      return;
    }

    await this.redis.connection.hdel(LAST_SEEN_KEY, userId);
    this.broadcast(userId, roomIds, 'online', null);
  }

  async markOffline(userId: string, roomIds: string[]): Promise<void> {
    const count = await this.redis.connection.hincrby(CONNECTIONS_KEY, userId, -1);
    if (count > 0) {
      return;
    }

    // A negative value means we saw more disconnects than connects (for example
    // after a Redis flush); remove the field so the user is definitely offline.
    if (count < 0) {
      this.logger.warn(`Presence count underflow for user ${userId}`);
    }
    await this.redis.connection.hdel(CONNECTIONS_KEY, userId);

    const lastSeenAt = new Date().toISOString();
    await this.redis.connection.hset(LAST_SEEN_KEY, userId, lastSeenAt);
    this.broadcast(userId, roomIds, 'offline', lastSeenAt);
  }

  /** Current status of everyone who shares at least one room with the user. */
  async snapshotFor(userId: string): Promise<PresenceSnapshot> {
    const peerIds = await this.membership.listPeerIdsForUser(userId, MAX_PEERS);
    if (peerIds.length === 0) {
      return { users: [] };
    }

    const results = await this.redis.connection
      .pipeline()
      .hmget(CONNECTIONS_KEY, ...peerIds)
      .hmget(LAST_SEEN_KEY, ...peerIds)
      .exec();

    const counts = (results?.[0]?.[1] as (string | null)[] | undefined) ?? [];
    const lastSeen = (results?.[1]?.[1] as (string | null)[] | undefined) ?? [];
    const users: PresenceEntry[] = peerIds.map((peerId, index) => {
      const online = Number(counts[index] ?? 0) > 0;
      return {
        userId: peerId,
        status: online ? 'online' : 'offline',
        lastSeenAt: online ? null : (lastSeen[index] ?? null),
      };
    });

    return { users };
  }

  private broadcast(
    userId: string,
    roomIds: string[],
    status: PresenceEntry['status'],
    lastSeenAt: string | null,
  ): void {
    for (const roomId of roomIds) {
      this.realtime.emitToRoom(roomId, 'presence:update', { userId, status, lastSeenAt });
    }
  }
}
