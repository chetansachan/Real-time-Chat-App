import { MemberRole, RoomType } from '@prisma/client';
import { RoomPolicyService } from './room-policy.service';

describe('RoomPolicyService', () => {
  let policy: RoomPolicyService;

  beforeEach(() => {
    policy = new RoomPolicyService();
  });

  describe('canJoinRoom', () => {
    it('allows anyone into a public room', () => {
      expect(policy.canJoinRoom(RoomType.PUBLIC, false, false)).toBe(true);
    });

    it('rejects non-members from private and direct rooms', () => {
      expect(policy.canJoinRoom(RoomType.PRIVATE, false, false)).toBe(false);
      expect(policy.canJoinRoom(RoomType.DIRECT, false, false)).toBe(false);
    });

    it('rejects banned users', () => {
      expect(policy.canJoinRoom(RoomType.PUBLIC, false, true)).toBe(false);
    });

    it('treats existing members as allowed, even in private rooms', () => {
      expect(policy.canJoinRoom(RoomType.PRIVATE, true, false)).toBe(true);
    });
  });

  describe('canInvite / canModerate', () => {
    it('only lets owners invite and moderate', () => {
      expect(policy.canInvite(MemberRole.OWNER)).toBe(true);
      expect(policy.canInvite(MemberRole.MEMBER)).toBe(false);
      expect(policy.canInvite(null)).toBe(false);
      expect(policy.canModerate(MemberRole.OWNER)).toBe(true);
      expect(policy.canModerate(MemberRole.MEMBER)).toBe(false);
    });
  });

  describe('canRemoveMember', () => {
    it('lets an owner remove members', () => {
      expect(policy.canRemoveMember(MemberRole.OWNER, MemberRole.MEMBER)).toBe(true);
    });

    it('never lets an owner be removed through this path', () => {
      expect(policy.canRemoveMember(MemberRole.OWNER, MemberRole.OWNER)).toBe(false);
    });

    it('rejects members acting on anyone', () => {
      expect(policy.canRemoveMember(MemberRole.MEMBER, MemberRole.MEMBER)).toBe(false);
    });
  });

  describe('canDeleteMessage', () => {
    it('lets a sender delete their own message', () => {
      expect(policy.canDeleteMessage('u1', 'u1', MemberRole.MEMBER)).toBe(true);
    });

    it('lets an owner moderate any message', () => {
      expect(policy.canDeleteMessage('owner', 'u1', MemberRole.OWNER)).toBe(true);
    });

    it("rejects a member deleting someone else's message", () => {
      expect(policy.canDeleteMessage('u2', 'u1', MemberRole.MEMBER)).toBe(false);
    });
  });

  describe('canLeave', () => {
    it('blocks owners from leaving without transferring ownership', () => {
      expect(policy.canLeave(MemberRole.OWNER)).toBe(false);
      expect(policy.canLeave(MemberRole.MEMBER)).toBe(true);
    });
  });
});
