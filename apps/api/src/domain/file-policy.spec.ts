import { describe, expect, it } from 'vitest';
import { classifyUpload, detectFileMime, MAX_FILE_SIZE } from './file-policy';

describe('Политика работы с файлами', () => {
  it('принимает поддерживаемые изображения и документы', () => {
    expect(classifyUpload('photo.webp', 'image/webp', 1_024)).toBe('image');
    expect(classifyUpload('brief.pdf', 'application/pdf', 2_048)).toBe('document');
  });

  it('отклоняет слишком большие файлы и активное содержимое', () => {
    expect(() => classifyUpload('large.png', 'image/png', MAX_FILE_SIZE + 1)).toThrow('20 МБ');
    expect(() => classifyUpload('payload.svg', 'image/svg+xml', 1_024)).toThrow('формат');
    expect(() => classifyUpload('page.html', 'text/html', 1_024)).toThrow('формат');
  });

  it('определяет распространённые сигнатуры файлов вместо доверия заявленному MIME-типу', () => {
    expect(detectFileMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    );
    expect(detectFileMime(Buffer.from('MZ executable'))).toBeNull();
  });
});
