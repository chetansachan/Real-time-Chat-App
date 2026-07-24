import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { RoomsModule } from '../rooms/rooms.module';
import { ChatGateway } from './chat.gateway';
import { PresenceService } from './presence.service';
import { RealtimeModule } from './realtime.module';
import { WsAuthMiddleware } from './ws-auth.middleware';

@Module({
  imports: [MessagesModule, RoomsModule, RealtimeModule],
  providers: [ChatGateway, WsAuthMiddleware, PresenceService],
})
export class ChatModule {}
