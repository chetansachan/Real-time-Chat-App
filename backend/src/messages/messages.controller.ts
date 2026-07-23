import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Page } from '../common/pagination/cursor';
import type { AuthUser } from '../common/types/auth-user';
import { RealtimeService } from '../chat/realtime.service';
import type { MessageDto } from './message.types';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly realtime: RealtimeService,
  ) {}

  /** REST fallback for sending; the primary path is the `message:send` socket event. */
  @Post('rooms/:roomId/messages')
  async create(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageDto> {
    const message = await this.messages.create(user.id, roomId, dto);
    this.realtime.emitToRoom(roomId, 'message:new', message);
    return message;
  }

  @Get('rooms/:roomId/messages')
  list(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListMessagesDto,
  ): Promise<Page<MessageDto>> {
    return this.messages.list(roomId, user.id, query);
  }

  @Delete('messages/:messageId')
  async remove(
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: true }> {
    const deleted = await this.messages.deleteMessage(messageId, user.id);
    this.realtime.emitToRoom(deleted.roomId, 'message:deleted', {
      roomId: deleted.roomId,
      messageId: deleted.id,
    });
    return { success: true };
  }

  @Post('rooms/:roomId/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: MarkReadDto,
  ): Promise<{ roomId: string; lastReadMessageId: string | null }> {
    const result = await this.messages.markRead(roomId, user.id, dto.messageId);
    if (result.lastReadMessageId) {
      this.realtime.emitToRoom(roomId, 'message:read', {
        roomId,
        userId: user.id,
        lastReadMessageId: result.lastReadMessageId,
      });
    }
    return result;
  }
}
