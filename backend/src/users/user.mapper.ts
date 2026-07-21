import type { Prisma } from '@prisma/client';

export const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const userPreviewSelect = {
  id: true,
  username: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export type PublicUserRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
export type UserPreviewRow = Prisma.UserGetPayload<{ select: typeof userPreviewSelect }>;

/** The authenticated user's own profile. Only ever returned for `me`. */
export interface PublicUser {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
}

/** Another user as seen in member lists, search results, and DMs. */
export interface UserPreview {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export function toPublicUser(user: PublicUserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toUserPreview(user: UserPreviewRow): UserPreview {
  return { id: user.id, username: user.username, avatarUrl: user.avatarUrl };
}
