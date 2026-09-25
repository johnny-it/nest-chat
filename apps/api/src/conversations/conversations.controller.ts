import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { createConversationSchema, cursorQuerySchema } from '@nestchat/contracts';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user';
import { parseInput } from '../common/validation';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from './conversations.service';

@UseGuards(AuthGuard)
@Controller('conversations')
@ApiTags('Диалоги')
@ApiBearerAuth('access-token')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Получить список диалогов' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.conversations.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать личный диалог' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId'],
      properties: { userId: { type: 'string', format: 'uuid' } },
    },
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = parseInput(createConversationSchema, body);
    return this.conversations.createDirect(user.id, input.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Скрыть диалог и очистить его историю для текущего пользователя' })
  @ApiParam({ name: 'id', description: 'Идентификатор диалога', format: 'uuid' })
  /**
   * Скрывает диалог и его текущую историю только для авторизованного пользователя.
   *
   * @param user - Текущий пользователь.
   * @param conversationId - Идентификатор диалога.
   * @returns Признак успешного удаления.
   */
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') conversationId: string) {
    await this.conversations.removeForUser(conversationId, user.id);
    return { success: true };
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Получить историю сообщений' })
  @ApiParam({ name: 'id', description: 'Идентификатор диалога', format: 'uuid' })
  @ApiQuery({ name: 'cursor', required: false, format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
    @Query() query: unknown,
  ) {
    return this.messages.history(user.id, conversationId, parseInput(cursorQuerySchema, query));
  }
}
