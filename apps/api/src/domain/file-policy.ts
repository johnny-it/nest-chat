import path from 'node:path';

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

const IMAGE_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);

const DOCUMENT_TYPES = new Map([
  ['.pdf', 'application/pdf'],
  ['.txt', 'text/plain'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.zip', 'application/zip'],
]);

export function classifyUpload(
  originalName: string,
  mimeType: string,
  size: number,
): 'image' | 'document' {
  if (size > MAX_FILE_SIZE) {
    throw new Error('Размер файла не должен превышать 20 МБ');
  }

  const extension = path.extname(originalName).toLocaleLowerCase('en-US');
  if (IMAGE_TYPES.get(extension) === mimeType) return 'image';
  if (DOCUMENT_TYPES.get(extension) === mimeType) return 'document';
  throw new Error('Этот формат файла не поддерживается');
}

export function sanitizeFileName(originalName: string): string {
  const baseName = Array.from(path.basename(originalName), (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || '<>:"/\\|?*'.includes(character) ? '_' : character;
  }).join('');
  return baseName.slice(0, 180) || 'file';
}

export function detectFileMime(buffer: Buffer): string | null {
  if (
    buffer.subarray(0, 2).toString('ascii') === 'MZ' ||
    buffer.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
  ) {
    return null;
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  const head = buffer.subarray(0, 12).toString('ascii');
  if (head.startsWith('GIF87a') || head.startsWith('GIF89a')) return 'image/gif';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2] ?? -1)) {
    return 'application/zip';
  }
  if (!buffer.includes(0) && buffer.toString('utf8').length > 0) return 'text/plain';
  return null;
}
