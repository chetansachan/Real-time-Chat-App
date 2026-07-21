import { Controller, Get, Patch, Query, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { PublicUser, UserPreview } from './user.mapper';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.users.findById(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto): Promise<PublicUser> {
    return this.users.update(user.id, dto);
  }

  @Get()
  search(@CurrentUser() user: AuthUser, @Query() query: SearchUsersDto): Promise<UserPreview[]> {
    return this.users.search(user.id, query);
  }
}
