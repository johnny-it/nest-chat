import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { UserDto } from '@nestchat/contracts';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Avatar } from '../../components/Avatar';
import { Modal } from '../../components/Modal';
import { apiFetch, resolveApiAssetUrl } from '../../lib/api';
import { useAuthStore } from '../../state/auth-store';
import { createCroppedAvatar } from './avatar-image';

interface AvatarEditorDialogProps {
  open: boolean;
  user: UserDto;
  onOpenChange: (open: boolean) => void;
}

/**
 * Отображает редактор аватара текущего пользователя.
 *
 * @param props - Параметры редактора.
 * @param props.open - Признак открытого окна.
 * @param props.user - Текущий пользователь.
 * @param props.onOpenChange - Обработчик изменения состояния окна.
 */
export function AvatarEditorDialog({ open, user, onOpenChange }: AvatarEditorDialogProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setUser = useAuthStore((state) => state.setUser);
  const imageSource = objectUrl ?? (user.avatarUrl ? resolveApiAssetUrl(user.avatarUrl) : null);
  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);
  const upload = useMutation({
    mutationFn: async () => {
      if (!imageSource || !croppedArea) throw new Error('Выберите область изображения');
      const avatar = await createCroppedAvatar(imageSource, croppedArea);
      const form = new FormData();
      form.append('avatar', avatar);
      return apiFetch<UserDto>('/files/avatar', { method: 'POST', body: form });
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      onOpenChange(false);
    },
    onError: (reason) => {
      setError(reason instanceof Error ? reason.message : 'Не удалось обновить аватар');
    },
  });

  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setObjectUrl(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
      setError(null);
      upload.reset();
    }
    onOpenChange(nextOpen);
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Поддерживаются JPEG, PNG, WebP и GIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Размер изображения не должен превышать 5 МБ');
      return;
    }
    setObjectUrl(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setError(null);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Аватар профиля"
      description="Настройте изображение, которое увидят другие пользователи"
      contentClassName="avatar-editor-dialog"
    >
      {imageSource ? (
        <div className="avatar-editor-crop">
          <Cropper
            image={imageSource}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
      ) : (
        <div className="avatar-editor-empty">
          <Avatar name={user.displayName} size="lg" />
          <p>Выберите изображение для аватара</p>
        </div>
      )}
      {imageSource ? (
        <label className="avatar-zoom-control">
          <span>Масштаб</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            aria-label="Масштаб"
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
      ) : null}
      {error ? <p className="form-error avatar-editor-error">{error}</p> : null}
      <div className="avatar-editor-actions">
        <label className="avatar-file-button">
          {imageSource ? 'Выбрать другое' : 'Выбрать изображение'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={!imageSource || !croppedArea || upload.isPending}
          onClick={() => upload.mutate()}
        >
          {upload.isPending ? 'Сохранение…' : 'Сохранить аватар'}
        </button>
      </div>
    </Modal>
  );
}
