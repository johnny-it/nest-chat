import { Body, Controller, Delete, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  createMessageSchema,
  deleteMessageQuerySchema,
  editMessageSchema,
  readConversationSchema,
} from '@nestchat/contracts';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user';
import { parseInput } from '../common/validation';
import { MessagesService } from './messages.service';

@UseGuards(AuthGuard)
@Controller()
@ApiTags('Сообщения')
@ApiBearerAuth('access-token')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Отправить сообщение' })
  @ApiParam({ name: 'id', description: 'Идентификатор диалога', format: 'uuid' })
  @ApiBody({ schema: { type: 'object', required: ['clientMessageId'], properties: { clientMessageId: { type: 'string', format: 'uuid' }, text: { type: 'string', maxLength: 4000 }, replyToId: { type: 'string', format: 'uuid' }, attachmentIds: { type: 'array', maxItems: 10, items: { type: 'string', format: 'uuid' } } } } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
    @Body() body: unknown,
  ) {
    return this.messages.create(user.id, conversationId, parseInput(createMessageSchema, body));
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Изменить сообщение' })
  @ApiParam({ name: 'id', description: 'Идентификатор сообщения', format: 'uuid' })
  @ApiBody({ schema: { type: 'object', required: ['text'], properties: { text: { type: 'string', minLength: 1, maxLength: 4000 } } } })
  edit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    return this.messages.edit(user.id, id, parseInput(editMessageSchema, body).text);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Удалить сообщение' })
  @ApiParam({ name: 'id', description: 'Идентификатор сообщения', format: 'uuid' })
  @ApiQuery({ name: 'scope', enum: ['self', 'everyone'], description: 'Удалить только у себя или у всех' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: unknown,
  ) {
    await this.messages.remove(user.id, id, parseInput(deleteMessageQuerySchema, query).scope);
    return { success: true };
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Отметить сообщения прочитанными до указанного сообщения' })
  @ApiParam({ name: 'id', description: 'Идентификатор диалога', format: 'uuid' })
  @ApiBody({ schema: { type: 'object', required: ['messageId'], properties: { messageId: { type: 'string', format: 'uuid' } } } })
  async read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
    @Body() body: unknown,
  ) {
    await this.messages.markRead(
      user.id,
      conversationId,
      parseInput(readConversationSchema, body).messageId,
    );
    return { success: true };
  }
}
