import { IsUUID } from 'class-validator';
import { CreateMessageDto } from './create-message.dto';

export class SendMessageDto extends CreateMessageDto {
  @IsUUID()
  roomId!: string;
}
