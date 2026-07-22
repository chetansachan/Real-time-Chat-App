import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Page } from '../common/pagination/cursor';
import type { AuthUser } from '../common/types/auth-user';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateDirectRoomDto } from './dto/create-direct-room.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { ListPublicRoomsDto } from './dto/list-public-rooms.dto';
import { BanMemberDto, MuteMemberDto } from './dto/moderate-member.dto';
import { MembershipService } from './membership.service';
import { RoomsService } from './rooms.service';
import type { PublicRoomSummary, RoomDetail, RoomMemberDto, RoomSummary } from './rooms.types';

@ApiTags('rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly membership: MembershipService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto): Promise<RoomSummary> {
    return this.rooms.create(user.id, dto);
  }

  @Get()
  listMine(@CurrentUser() user: AuthUser): Promise<RoomSummary[]> {
    return this.rooms.listMine(user.id);
  }

  // Declared before `:id` so "public" is not parsed as a room id.
  @Get('public')
  listPublic(
    @CurrentUser() user: AuthUser,
    @Query() query: ListPublicRoomsDto,
  ): Promise<Page<PublicRoomSummary>> {
    return this.rooms.listPublic(user.id, query);
  }

  @Post('direct')
  direct(@CurrentUser() user: AuthUser, @Body() dto: CreateDirectRoomDto): Promise<RoomSummary> {
    return this.rooms.direct(user.id, dto);
  }

  @Post(':roomId/join')
  join(@Param('roomId') roomId: string, @CurrentUser() user: AuthUser): Promise<RoomDetail> {
    return this.rooms.join(roomId, user.id);
  }

  @Post(':roomId/leave')
  async leave(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: true }> {
    await this.membership.leave(roomId, user.id);
    return { success: true };
  }

  @Post(':roomId/members')
  addMembers(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMembersDto,
  ): Promise<RoomMemberDto[]> {
    return this.membership.addMembers(roomId, user.id, dto.userIds);
  }

  @Get(':roomId/members')
  listMembers(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<RoomMemberDto[]> {
    return this.membership.listMembers(roomId, user.id);
  }

  @Delete(':roomId/members/:userId')
  async kick(
    @Param('roomId') roomId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: true }> {
    await this.membership.kick(roomId, user.id, userId);
    return { success: true };
  }

  @Post(':roomId/members/:userId/mute')
  async mute(
    @Param('roomId') roomId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: MuteMemberDto,
  ): Promise<{ userId: string; mutedUntil: string }> {
    const mutedUntil = await this.membership.mute(roomId, user.id, userId, dto.durationSeconds);
    return { userId, mutedUntil };
  }

  @Delete(':roomId/members/:userId/mute')
  async unmute(
    @Param('roomId') roomId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: true }> {
    await this.membership.unmute(roomId, user.id, userId);
    return { success: true };
  }

  @Post(':roomId/bans')
  async ban(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: BanMemberDto,
  ): Promise<{ success: true }> {
    await this.membership.ban(roomId, user.id, dto.userId, dto.reason, dto.durationSeconds);
    return { success: true };
  }

  @Delete(':roomId/bans/:userId')
  async unban(
    @Param('roomId') roomId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: true }> {
    await this.membership.unban(roomId, user.id, userId);
    return { success: true };
  }

  @Get(':roomId')
  get(@Param('roomId') roomId: string, @CurrentUser() user: AuthUser): Promise<RoomDetail> {
    return this.rooms.getRoom(roomId, user.id);
  }
}
