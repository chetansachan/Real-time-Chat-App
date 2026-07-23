import { IsUUID } from 'class-validator';

export class ReadReceiptDto {
  @IsUUID()
  roomId!: string;

  @IsUUID()
  messageId!: string;
}
