import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user';
import { MAX_AVATAR_SIZE, MAX_FILE_SIZE } from '../domain/file-policy';
import { FilesService } from './files.service';

@Controller('files')
@ApiTags('Файлы')
@ApiBearerAuth('access-token')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @ApiOperation({ summary: 'Загрузить до десяти файлов' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['files'], properties: { files: { type: 'array', maxItems: 10, items: { type: 'string', format: 'binary' } } } } })
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } }),
  )
  upload(@CurrentUser() user: AuthenticatedUser, @UploadedFiles() files: Express.Multer.File[]) {
    return Promise.all(files.map((file) => this.files.upload(user.id, file)));
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Загрузить или заменить свой аватар' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_SIZE },
    }),
  )
  /**
   * Загружает новый аватар текущего пользователя.
   *
   * @param user - Текущий пользователь.
   * @param file - Изображение из multipart-запроса.
   * @returns Обновлённые данные пользователя.
   */
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.files.uploadAvatar(user.id, file);
  }

  @Get('avatar/:userId')
  @ApiOperation({ summary: 'Получить аватар пользователя' })
  @ApiParam({ name: 'userId', description: 'Идентификатор пользователя', format: 'uuid' })
  /**
   * Возвращает сохранённый аватар пользователя.
   *
   * @param userId - Идентификатор пользователя.
   * @param response - HTTP-ответ для установки заголовков.
   * @returns Поток изображения.
   */
  async avatar(
    @Param('userId') userId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { stream, mimeType } = await this.files.openAvatar(userId);
    response.setHeader('Content-Type', mimeType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(stream);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Скачать файл' })
  @ApiParam({ name: 'id', description: 'Идентификатор файла', format: 'uuid' })
  @UseGuards(AuthGuard)
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { stream, attachment } = await this.files.open(user.id, id);
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      `${attachment.mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(stream);
  }
}
