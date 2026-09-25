import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService, ConversationsService],
  exports: [MessagesService],
})
export class MessagesModule {}
