import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
@ApiTags('Состояние сервиса')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Проверить API, базу данных и хранилище файлов' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const uploadDir = path.resolve(this.config.get('UPLOAD_DIR', './uploads'));
      await mkdir(uploadDir, { recursive: true });
      await access(uploadDir);
      return { status: 'ok', database: 'up', storage: 'up' };
    } catch {
      throw new ServiceUnavailableException('Сервис временно недоступен');
    }
  }
}
