import { Prisma } from '@prisma/client';

/** Postgres unique-constraint violation (Prisma error P2002). */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
