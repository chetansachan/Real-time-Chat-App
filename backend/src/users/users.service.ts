import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { isUniqueConstraintError } from '../common/db/prisma-errors';
import { ErrorCodes } from '../common/types/error-codes';
import { PrismaService } from '../database/prisma.service';
import type { SearchUsersDto } from './dto/search-users.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import {
  publicUserSelect,
  toPublicUser,
  toUserPreview,
  userPreviewSelect,
  type PublicUser,
  type UserPreview,
} from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }
    return toPublicUser(user);
  }

  async update(userId: string, dto: UpdateUserDto): Promise<PublicUser> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.username !== undefined ? { username: dto.username } : {}),
          ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        },
        select: publicUserSelect,
      });
      return toPublicUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(ErrorCodes.CONFLICT, 'Username is already taken', 409);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404);
      }
      throw error;
    }
  }

  async search(userId: string, query: SearchUsersDto): Promise<UserPreview[]> {
    const search = query.search?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        ...(search ? { username: { contains: search, mode: 'insensitive' } } : {}),
      },
      select: userPreviewSelect,
      orderBy: { username: 'asc' },
      take: query.limit ?? 20,
    });
    return users.map(toUserPreview);
  }
}
