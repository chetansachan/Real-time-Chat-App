import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListMessagesDto {
  /** Older page: return messages with id < before (newest first). */
  @IsOptional()
  @IsUUID()
  before?: string;

  /** Catch-up page: return messages with id > after (oldest first). */
  @IsOptional()
  @IsUUID()
  after?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
