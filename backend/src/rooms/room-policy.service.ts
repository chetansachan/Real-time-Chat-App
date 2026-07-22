import { Injectable } from '@nestjs/common';
import { MemberRole, RoomType } from '@prisma/client';

/**
 * Pure authorization decisions for rooms. Kept free of Prisma and transport
 * concerns so the rules can be unit tested exhaustively.
 *
 * "Membership" is always resolved by the caller; this service never trusts a
 * client-supplied room id or role.
 */
@Injectable()
export class RoomPolicyService {
  canViewRoom(roomType: RoomType, isMember: boolean): boolean {
    return isMember || roomType === RoomType.PUBLIC;
  }

  canJoinRoom(roomType: RoomType, isMember: boolean, isBanned: boolean): boolean {
    if (isMember) {
      return true;
    }
    return roomType === RoomType.PUBLIC && !isBanned;
  }

  canInvite(actorRole: MemberRole | null): boolean {
    return actorRole === MemberRole.OWNER;
  }

  canModerate(actorRole: MemberRole | null): boolean {
    return actorRole === MemberRole.OWNER;
  }

  canRemoveMember(actorRole: MemberRole | null, targetRole: MemberRole): boolean {
    return actorRole === MemberRole.OWNER && targetRole !== MemberRole.OWNER;
  }

  canDeleteMessage(actorId: string, senderId: string, actorRole: MemberRole | null): boolean {
    return actorId === senderId || actorRole === MemberRole.OWNER;
  }

  canLeave(role: MemberRole): boolean {
    return role !== MemberRole.OWNER;
  }
}
