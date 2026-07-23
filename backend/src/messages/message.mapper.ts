import type { Prisma } from '@prisma/client';
import { toUserPreview, userPreviewSelect } from '../users/user.mapper';
import type { MessageDto } from './message.types';

export const messageWithSenderInclude = {
  sender: { select: userPreviewSelect },
} satisfies Prisma.MessageInclude;

export type MessageWithSender = Prisma.MessageGetPayload<{
  include: typeof messageWithSenderInclude;
}>;

export function toMessageDto(message: MessageWithSender): MessageDto {
  return {
    id: message.id,
    roomId: message.roomId,
    senderId: message.senderId,
    content: message.content,
    type: message.type,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt.toISOString(),
    deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
    sender: toUserPreview(message.sender),
  };
}
