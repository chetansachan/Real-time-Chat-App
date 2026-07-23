import { Module } from '@nestjs/common';
import { RealtimeModule } from '../chat/realtime.module';
import { RoomsModule } from '../rooms/rooms.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [RoomsModule, RealtimeModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
