import { Injectable, UnauthorizedException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { isUniqueConstraintError } from '../common/db/prisma-errors';
import { hashPassword, verifyPassword } from '../common/auth/password';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/types/error-codes';
import { PrismaService } from '../database/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';
import { publicUserSelect, toPublicUser, type PublicUser } from '../users/user.mapper';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { email: true },
    });
    if (existing) {
      const message =
        existing.email === dto.email ? 'Email is already registered' : 'Username is already taken';
      throw new AppError(ErrorCodes.CONFLICT, message, 409);
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          id: uuidv7(),
          email: dto.email,
          username: dto.username,
          passwordHash: await hashPassword(dto.password),
        },
        select: publicUserSelect,
      });
      return this.issue(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(ErrorCodes.CONFLICT, 'Email or username is already taken', 409);
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...publicUserSelect, passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verifyPassword(user.passwordHash, dto.password).catch(() => false);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issue(user);
  }

  async refresh(rawToken: string | undefined): Promise<AuthResult> {
    if (!rawToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const rotated = await this.tokens.rotate(rawToken);
    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
      select: publicUserSelect,
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const access = await this.tokens.issueAccessToken(user);
    return {
      user: toPublicUser(user),
      accessToken: access.accessToken,
      expiresIn: access.expiresIn,
      refreshToken: rotated.token,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    await this.tokens.revoke(rawToken).catch(() => undefined);
  }

  private async issue(user: {
    id: string;
    email: string;
    username: string;
    avatarUrl: string | null;
    createdAt: Date;
  }): Promise<AuthResult> {
    const access = await this.tokens.issueAccessToken(user);
    const refreshToken = await this.tokens.createRefreshToken(user.id);
    return {
      user: toPublicUser(user),
      accessToken: access.accessToken,
      expiresIn: access.expiresIn,
      refreshToken,
    };
  }
}
