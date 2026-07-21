import { IsOptional, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers, and underscores',
  })
  username?: string;

  /** Send `null` to remove the avatar. */
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  avatarUrl?: string | null;
}
