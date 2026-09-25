import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatGateway } from './chat.gateway';
import { RealtimeService } from './realtime.service';

@Global()
@Module({ imports: [AuthModule], providers: [RealtimeService, ChatGateway], exports: [RealtimeService] })
export class RealtimeModule {}
