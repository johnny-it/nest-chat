import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, CheckCheck, MoreHorizontal, Pencil, Reply, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MessageDto } from '@nestchat/contracts';
import { AttachmentView } from './AttachmentView';

interface MessageBubbleProps {
  message: MessageDto;
  own: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDeleteSelf: () => void;
  onDeleteEveryone: () => void;
  replyAuthorName: string | null;
  onReplyReferenceClick: (messageId: string) => void;
}

/**
 * Отображает сообщение, его вложения, контекст ответа и доступные действия.
 *
 * @param props - Параметры сообщения.
 * @param props.message - Данные сообщения.
 * @param props.own - Признак сообщения текущего пользователя.
 * @param props.replyAuthorName - Имя автора исходного сообщения.
 * @param props.onReplyReferenceClick - Обработчик перехода к исходному сообщению.
 */
export function MessageBubble({
  message,
  own,
  onReply,
  onEdit,
  onDeleteSelf,
  onDeleteEveryone,
  replyAuthorName,
  onReplyReferenceClick,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuOpenedByHover = useRef(false);
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(message.createdAt),
  );

  const cancelMenuClose = () => {
    if (menuCloseTimer.current === null) return;
    clearTimeout(menuCloseTimer.current);
    menuCloseTimer.current = null;
  };

  const scheduleMenuClose = () => {
    cancelMenuClose();
    menuCloseTimer.current = setTimeout(() => {
      setMenuOpen(false);
      menuCloseTimer.current = null;
    }, 150);
  };

  useEffect(() => () => cancelMenuClose(), []);

  return (
    <article
      className={`message-row ${own ? 'own' : ''}`}
      data-message-id={message.id}
      data-message-author-id={message.authorId}
    >
      <div className={`message-bubble ${message.deletedForAllAt ? 'deleted' : ''}`}>
        {message.deletedForAllAt ? <em>Сообщение удалено</em> : null}
        {!message.deletedForAllAt && message.replyTo ? (
          <button
            className="reply-reference"
            type="button"
            onClick={() => onReplyReferenceClick(message.replyTo!.id)}
          >
            <strong>{replyAuthorName}</strong>
            <span>
              {message.replyTo.deletedForAllAt
                ? 'Сообщение удалено'
                : message.replyTo.text || 'Вложение'}
            </span>
          </button>
        ) : null}
        {!message.deletedForAllAt
          ? message.attachments.map((attachment) => (
              <AttachmentView key={attachment.id} attachment={attachment} />
            ))
          : null}
        {!message.deletedForAllAt && message.text ? <p>{message.text}</p> : null}
        <footer>
          {message.editedAt ? <span>изменено</span> : null}
          <time>{time}</time>
          {own && message.deliveryStatus === 'sent' ? (
            <Check className="message-status sent" size={15} aria-label="Отправлено" />
          ) : null}
          {own && message.deliveryStatus === 'delivered' ? (
            <CheckCheck className="message-status delivered" size={15} aria-label="Доставлено" />
          ) : null}
          {own && message.deliveryStatus === 'read' ? (
            <CheckCheck className="message-status read" size={15} aria-label="Прочитано" />
          ) : null}
        </footer>
        <DropdownMenu.Root
          open={menuOpen}
          onOpenChange={(open) => {
            cancelMenuClose();
            setMenuOpen(open);
          }}
        >
          <DropdownMenu.Trigger asChild>
            <button
              className="message-menu-trigger"
              type="button"
              onPointerEnter={(event) => {
                if (event.pointerType !== 'mouse') return;
                cancelMenuClose();
                menuOpenedByHover.current = true;
                setMenuOpen(true);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse') scheduleMenuClose();
              }}
              aria-label="Действия с сообщением"
            >
              <MoreHorizontal size={17} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="context-menu"
              side="bottom"
              align="end"
              sideOffset={5}
              collisionPadding={10}
              onCloseAutoFocus={(event) => {
                if (!menuOpenedByHover.current) return;
                event.preventDefault();
                menuOpenedByHover.current = false;
              }}
              onPointerEnter={cancelMenuClose}
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse') scheduleMenuClose();
              }}
            >
              <DropdownMenu.Item onSelect={onReply}>
                <Reply size={15} />
                Ответить
              </DropdownMenu.Item>
              {own && !message.deletedForAllAt ? (
                <DropdownMenu.Item onSelect={onEdit}>
                  <Pencil size={15} />
                  Изменить
                </DropdownMenu.Item>
              ) : null}
              <DropdownMenu.Item onSelect={onDeleteSelf}>
                <Trash2 size={15} />
                Удалить у себя
              </DropdownMenu.Item>
              {own && !message.deletedForAllAt ? (
                <DropdownMenu.Item className="danger" onSelect={onDeleteEveryone}>
                  <Trash2 size={15} />
                  Удалить у обоих
                </DropdownMenu.Item>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </article>
  );
}
