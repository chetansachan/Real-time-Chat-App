import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { hashPassword, verifyPassword } from '../common/auth/password';
import { PrismaService } from '../database/prisma.service';

export interface AccessToken {
  accessToken: string;
  expiresIn: number;
}

export interface RefreshRotation {
  userId: string;
  token: string;
}

interface GeneratedRefreshToken {
  id: string;
  secret: string;
  token: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueAccessToken(user: { id: string; username: string }): Promise<AccessToken> {
    const expiresIn = this.config.getOrThrow<number>('jwt.accessTtlSeconds');
    const accessToken = await this.jwt.signAsync({ sub: user.id, username: user.username });
    return { accessToken, expiresIn };
  }

  async createRefreshToken(userId: string): Promise<string> {
    const generated = this.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        id: generated.id,
        userId,
        tokenHash: await hashPassword(generated.secret),
        expiresAt: this.refreshExpiry(),
      },
    });
    return generated.token;
  }

  /**
   * Rotates a refresh token. Reusing an already-revoked token is treated as
   * theft and revokes every active session for that user.
   */
  async rotate(rawToken: string): Promise<RefreshRotation> {
    const parsed = this.parse(rawToken);
    const row = await this.prisma.refreshToken.findUnique({ where: { id: parsed.id } });
    if (!row) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const valid = await verifyPassword(row.tokenHash, parsed.secret).catch(() => false);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const next = this.generateRefreshToken();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), replacedById: next.id },
      }),
      this.prisma.refreshToken.create({
        data: {
          id: next.id,
          userId: row.userId,
          tokenHash: await hashPassword(next.secret),
          expiresAt: this.refreshExpiry(),
        },
      }),
    ]);

    return { userId: row.userId, token: next.token };
  }

  async revoke(rawToken: string): Promise<void> {
    const parsed = this.parse(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { id: parsed.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private generateRefreshToken(): GeneratedRefreshToken {
    const id = uuidv7();
    const secret = randomBytes(32).toString('base64url');
    return { id, secret, token: `${id}.${secret}` };
  }

  private refreshExpiry(): Date {
    const ttlSeconds = this.config.getOrThrow<number>('refreshTtlSeconds');
    return new Date(Date.now() + ttlSeconds * 1_000);
  }

  private parse(rawToken: string): { id: string; secret: string } {
    const separator = rawToken.indexOf('.');
    if (separator <= 0 || separator === rawToken.length - 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return {
      id: rawToken.slice(0, separator),
      secret: rawToken.slice(separator + 1),
    };
  }
}
