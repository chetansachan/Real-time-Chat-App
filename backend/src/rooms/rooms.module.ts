import { Module } from '@nestjs/common';
import { RealtimeModule } from '../chat/realtime.module';
import { MembershipService } from './membership.service';
import { RoomPolicyService } from './room-policy.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [RealtimeModule],
  controllers: [RoomsController],
  providers: [RoomsService, MembershipService, RoomPolicyService],
  exports: [MembershipService, RoomPolicyService, RoomsService],
})
export class RoomsModule {}
