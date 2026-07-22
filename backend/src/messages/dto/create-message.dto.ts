import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  content!: string;

  /** Client-generated id; retries with the same value cannot create duplicates. */
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  clientMessageId!: string;
}
