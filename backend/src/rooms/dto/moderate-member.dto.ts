import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const MAX_MUTE_SECONDS = 7 * 24 * 60 * 60;
const MAX_BAN_SECONDS = 30 * 24 * 60 * 60;

export class MuteMemberDto {
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(MAX_MUTE_SECONDS)
  durationSeconds!: number;
}

export class BanMemberDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  /** Omit for a permanent ban. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(MAX_BAN_SECONDS)
  durationSeconds?: number;
}
