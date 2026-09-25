import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user';
import { UsersService } from './users.service';

@UseGuards(AuthGuard)
@Controller('users')
@ApiTags('Пользователи')
@ApiBearerAuth('access-token')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('search')
  @ApiOperation({ summary: 'Найти пользователей по никнейму' })
  @ApiQuery({ name: 'q', required: false, description: 'Часть никнейма' })
  @ApiQuery({ name: 'cursor', required: false, format: 'uuid' })
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') query = '',
    @Query('cursor') cursor?: string,
  ) {
    return this.users.search(user.id, query, cursor);
  }
}
