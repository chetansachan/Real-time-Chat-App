import type { MessageDto } from '@/lib/api/types';
import type { PendingMessage } from '@/stores/pending';

interface BaseItem {
  key: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
}

export interface SentChatItem extends BaseItem {
  kind: 'message';
  message: MessageDto;
}

export interface PendingChatItem extends BaseItem {
  kind: 'pending';
  pending: PendingMessage;
}

export type ChatItem = SentChatItem | PendingChatItem;
