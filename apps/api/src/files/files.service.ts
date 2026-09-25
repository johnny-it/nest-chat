import { createReadStream } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AttachmentDto, UserDto } from '@nestchat/contracts';
import { PrismaService } from '../database/prisma.service';
import {
  classifyUpload,
  detectFileMime,
  MAX_AVATAR_SIZE,
  sanitizeFileName,
} from '../domain/file-policy';
import { toAttachmentDto, toUserDto } from '../common/dto-mappers';

@Injectable()
export class FilesService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Подготавливает каталог вложений и запускает очистку временных файлов. */
  async onModuleInit(): Promise<void> {
    await mkdir(this.uploadDir, { recursive: true });
    this.cleanupTimer = setInterval(() => void this.cleanupExpired(), 60 * 60 * 1_000);
    this.cleanupTimer.unref();
  }

  /** Останавливает периодическую очистку временных файлов. */
  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  /**
   * Сохраняет загруженный файл и создаёт запись вложения.
   *
   * @param userId - Идентификатор пользователя, загрузившего файл.
   * @param file - Проверяемый файл из multipart-запроса.
   * @returns Метаданные созданного вложения.
   */
  async upload(userId: string, file: Express.Multer.File): Promise<AttachmentDto> {
    const kind = classifyUpload(file.originalname, file.mimetype, file.size);
    const detected = detectFileMime(file.buffer);
    const officeMime = file.mimetype.includes('openxmlformats');
    if (!detected || (detected !== file.mimetype && !(officeMime && detected === 'application/zip'))) {
      throw new BadRequestException('Содержимое файла не соответствует его формату');
    }
    const storageKey = `${randomUUID()}${path.extname(file.originalname).toLocaleLowerCase('en-US')}`;
    await writeFile(path.join(this.uploadDir, storageKey), file.buffer, { flag: 'wx' });
    const attachment = await this.prisma.attachment.create({
      data: {
        uploaderId: userId,
        storageKey,
        originalName: sanitizeFileName(file.originalname),
        mimeType: file.mimetype,
        size: file.size,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
    });
    return { ...toAttachmentDto(attachment), kind };
  }

  /**
   * Сохраняет новый аватар пользователя и удаляет предыдущий файл.
   *
   * @param userId - Идентификатор пользователя.
   * @param file - Загруженное изображение.
   * @returns Обновлённые данные пользователя.
   */
  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<UserDto> {
    if (file.size > MAX_AVATAR_SIZE) {
      throw new BadRequestException('Размер аватара не должен превышать 5 МБ');
    }
    let kind: ReturnType<typeof classifyUpload>;
    try {
      kind = classifyUpload(file.originalname, file.mimetype, file.size);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Неподдерживаемый формат аватара',
      );
    }
    const detected = detectFileMime(file.buffer);
    if (kind !== 'image' || !detected || detected !== file.mimetype) {
      throw new BadRequestException('Файл аватара должен быть изображением');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const storageKey = `${randomUUID()}${path.extname(file.originalname).toLocaleLowerCase('en-US')}`;
    const filePath = path.join(this.uploadDir, storageKey);
    await writeFile(filePath, file.buffer, { flag: 'wx' });

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarPath: storageKey },
      });
      if (user.avatarPath) {
        await rm(path.join(this.uploadDir, user.avatarPath), { force: true });
      }
      return toUserDto(updatedUser);
    } catch (error) {
      await rm(filePath, { force: true });
      throw error;
    }
  }

  /**
   * Открывает сохранённый аватар пользователя для чтения.
   *
   * @param userId - Идентификатор пользователя.
   * @returns Поток изображения и его MIME-тип.
   */
  async openAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    if (!user?.avatarPath) throw new NotFoundException('Аватар не найден');

    const filePath = path.join(this.uploadDir, user.avatarPath);
    try {
      await access(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('Аватар отсутствует в хранилище');
      }
      throw error;
    }

    const extension = path.extname(user.avatarPath).toLocaleLowerCase('en-US');
    const mimeType =
      extension === '.png'
        ? 'image/png'
        : extension === '.webp'
          ? 'image/webp'
          : extension === '.gif'
            ? 'image/gif'
            : 'image/jpeg';
    return { stream: createReadStream(filePath), mimeType };
  }

  /**
   * Открывает доступное пользователю вложение для чтения.
   *
   * @param userId - Идентификатор текущего пользователя.
   * @param attachmentId - Идентификатор вложения.
   * @returns Поток содержимого и метаданные вложения.
   */
  async open(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException('Файл не найден');
    if (attachment.status === 'PENDING') {
      if (attachment.uploaderId !== userId) throw new ForbiddenException('Нет доступа к файлу');
    } else {
      const participant = await this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: { conversationId: attachment.conversationId!, userId },
        },
      });
      if (!participant) throw new ForbiddenException('Нет доступа к файлу');
    }
    const filePath = path.join(this.uploadDir, attachment.storageKey);
    try {
      await access(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('Файл отсутствует в хранилище');
      }
      throw error;
    }
    return {
      stream: createReadStream(filePath),
      attachment,
    };
  }

  /** Удаляет просроченные вложения, которые не были прикреплены к сообщению. */
  async cleanupExpired(): Promise<void> {
    const expired = await this.prisma.attachment.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    });
    await Promise.all(
      expired.map((file) => rm(path.join(this.uploadDir, file.storageKey), { force: true })),
    );
    if (expired.length) {
      await this.prisma.attachment.deleteMany({ where: { id: { in: expired.map((file) => file.id) } } });
    }
  }

  private get uploadDir(): string {
    return path.resolve(this.config.get('UPLOAD_DIR', './uploads'));
  }
}
