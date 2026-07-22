import type { MessageType } from '@prisma/client';
import type { UserPreview } from '../users/user.mapper';

export interface MessageDto {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: MessageType;
  clientMessageId: string;
  createdAt: string;
  deletedAt: string | null;
  sender: UserPreview;
}
