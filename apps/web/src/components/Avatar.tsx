import { resolveApiAssetUrl } from '../lib/api';

interface AvatarProps {
  name: string;
  src?: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean | undefined;
}

/**
 * Отображает изображение пользователя или его инициалы.
 *
 * @param props - Параметры аватара.
 * @param props.name - Отображаемое имя пользователя.
 * @param props.src - Адрес изображения.
 * @param props.size - Размер аватара.
 * @param props.online - Признак нахождения пользователя в сети.
 */
export function Avatar({ name, src, size = 'md', online = false }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('ru-RU');
  return (
    <span className={`avatar avatar-${size}`} aria-label={name}>
      {src ? <img src={resolveApiAssetUrl(src)} alt="" /> : <span>{initials}</span>}
      {online ? <i className="avatar-online" aria-label="в сети" /> : null}
    </span>
  );
}
