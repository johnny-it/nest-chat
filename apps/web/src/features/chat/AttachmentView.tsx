import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import type { AttachmentDto } from '@nestchat/contracts';
import { Modal } from '../../components/Modal';
import { API_URL } from '../../lib/api';
import { useAuthStore } from '../../state/auth-store';

/**
 * Загружает содержимое вложения с авторизацией текущего пользователя.
 *
 * @param attachment - Метаданные загружаемого вложения.
 * @param token - Токен доступа или `null` для cookie-аутентификации.
 * @returns Содержимое файла в виде Blob.
 */
export async function fetchAttachment(
  attachment: AttachmentDto,
  token: string | null,
): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/files/${attachment.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Не удалось загрузить файл');
  return response.blob();
}

/**
 * Показывает изображение с возможностью полноразмерного просмотра или кнопку загрузки документа.
 *
 * @param props - Параметры отображения вложения.
 * @param props.attachment - Метаданные вложения сообщения.
 */
export function AttachmentView({ attachment }: { attachment: AttachmentDto }) {
  const token = useAuthStore((state) => state.accessToken);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState(false);

  useEffect(() => {
    if (attachment.kind !== 'image') return;
    let url: string | undefined;
    let active = true;
    void fetchAttachment(attachment, token).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setImageUrl(url);
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment, token]);

  if (attachment.kind === 'image') {
    return (
      <>
        <button
          className="image-attachment"
          type="button"
          onClick={() => imageUrl && setImageOpen(true)}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={attachment.originalName} />
          ) : (
            <span>Загрузка изображения…</span>
          )}
        </button>
        <Modal
          open={imageOpen}
          onOpenChange={setImageOpen}
          title={attachment.originalName}
          description="Просмотр изображения во вложении"
          contentClassName="image-dialog"
          closeLabel="Закрыть изображение"
        >
          {imageUrl ? (
            <img className="image-dialog-preview" src={imageUrl} alt={attachment.originalName} />
          ) : null}
        </Modal>
      </>
    );
  }

  return (
    <button
      type="button"
      className="file-attachment"
      onClick={async () => {
        const blob = await fetchAttachment(attachment, token);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.originalName;
        link.click();
        URL.revokeObjectURL(url);
      }}
    >
      <FileText size={20} />
      <span>
        <strong>{attachment.originalName}</strong>
        <small>{formatBytes(attachment.size)}</small>
      </span>
      <Download size={16} />
    </button>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}
