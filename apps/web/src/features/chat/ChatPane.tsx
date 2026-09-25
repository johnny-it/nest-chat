import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowLeft, MoreVertical, Trash2, WifiOff } from 'lucide-react';
import type { AttachmentDto, ConversationDto, CursorPage, MessageDto } from '@nestchat/contracts';
import { Avatar } from '../../components/Avatar';
import { Modal } from '../../components/Modal';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../state/auth-store';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';
import type { RealtimeControls } from './useRealtime';

interface ChatPaneProps {
  conversation: ConversationDto;
  onBack: () => void;
  realtime: RealtimeControls;
  onDeleted?: (() => void) | undefined;
}

const fullDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function isSameCalendarDate(left: string, right: string) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function formatMessageDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameCalendarDate(value, today.toISOString())) return 'Сегодня';
  if (isSameCalendarDate(value, yesterday.toISOString())) return 'Вчера';
  return fullDateFormatter.format(date);
}

/**
 * Отображает историю выбранного чата и управляет отправкой, ответами и редактированием сообщений.
 *
 * @param props - Параметры панели чата.
 * @param props.conversation - Активный диалог.
 * @param props.onBack - Обработчик возврата к списку диалогов.
 * @param props.realtime - Элементы управления событиями реального времени.
 * @param props.onDeleted - Обработчик успешного удаления диалога.
 */
export function ChatPane({ conversation, onBack, realtime, onDeleted }: ChatPaneProps) {
  const currentUser = useAuthStore((state) => state.user);
  const userId = currentUser?.id;
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageDto | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const lastMarkedReadRef = useRef<string | null>(null);
  const positionedConversationRef = useRef<string | null>(null);
  const initialUnreadCountRef = useRef(conversation.unreadCount);
  const atBottomRef = useRef(conversation.unreadCount === 0);
  const readFrameRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousConversationRef = useRef(conversation.id);
  if (previousConversationRef.current !== conversation.id) {
    previousConversationRef.current = conversation.id;
    initialUnreadCountRef.current = conversation.unreadCount;
    positionedConversationRef.current = null;
    lastMarkedReadRef.current = null;
    atBottomRef.current = conversation.unreadCount === 0;
  }

  const history = useInfiniteQuery({
    queryKey: ['messages', conversation.id],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${pageParam}` : '';
      return apiFetch<CursorPage<MessageDto>>(
        `/conversations/${conversation.id}/messages?limit=50${cursor}`,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const send = useMutation({
    mutationFn: () =>
      apiFetch<MessageDto>(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          clientMessageId: crypto.randomUUID(),
          text: text.trim() || undefined,
          replyToId: replyTo?.id,
          attachmentIds: attachments.map((attachment) => attachment.id),
        }),
      }),
    onSuccess: (message) => {
      queryClient.setQueryData<InfiniteData<CursorPage<MessageDto>, string | undefined>>(
        ['messages', conversation.id],
        (current) => {
          if (!current) {
            return { pages: [{ items: [message], nextCursor: null }], pageParams: [undefined] };
          }
          const [latestPage, ...olderPages] = current.pages;
          return {
            ...current,
            pages: [
              {
                items: [...(latestPage?.items ?? []), message],
                nextCursor: latestPage?.nextCursor ?? null,
              },
              ...olderPages,
            ],
          };
        },
      );
      setText('');
      setAttachments([]);
      setReplyTo(null);
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      files.slice(0, 10).forEach((file) => form.append('files', file));
      return apiFetch<AttachmentDto[]>('/files', { method: 'POST', body: form });
    },
    onSuccess: (files) => setAttachments((current) => [...current, ...files].slice(0, 10)),
  });
  const remove = useMutation({
    mutationFn: ({ id, scope }: { id: string; scope: 'self' | 'everyone' }) =>
      apiFetch<{ success: boolean }>(`/messages/${id}?scope=${scope}`, { method: 'DELETE' }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] }),
  });
  const edit = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      apiFetch<MessageDto>(`/messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: value }),
      }),
    onSuccess: () => {
      setText('');
      setEditingMessage(null);
      void queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
    },
  });
  const removeConversation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>(`/conversations/${conversation.id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.setQueryData<ConversationDto[]>(['conversations'], (current) =>
        current?.filter((item) => item.id !== conversation.id),
      );
      queryClient.removeQueries({ queryKey: ['messages', conversation.id] });
      setDeleteDialogOpen(false);
      setDeleteError(null);
      onDeleted?.();
    },
    onError: (reason) => {
      setDeleteError(reason instanceof Error ? reason.message : 'Не удалось удалить диалог');
    },
  });

  const messages = useMemo(
    () => (history.data ? [...history.data.pages].reverse().flatMap((page) => page.items) : []),
    [history.data],
  );
  const messageDateGroups = useMemo(() => {
    const groups: Array<{ id: string; date: string; messages: MessageDto[] }> = [];
    for (const message of messages) {
      const currentGroup = groups[groups.length - 1];
      if (!currentGroup || !isSameCalendarDate(currentGroup.date, message.createdAt)) {
        groups.push({ id: message.id, date: message.createdAt, messages: [message] });
      } else {
        currentGroup.messages.push(message);
      }
    }
    return groups;
  }, [messages]);

  const markReadThrough = useCallback(
    (messageId: string) => {
      if (lastMarkedReadRef.current === messageId) return;
      lastMarkedReadRef.current = messageId;
      realtime.markDelivered(messageId);
      void apiFetch(`/conversations/${conversation.id}/read`, {
        method: 'POST',
        body: JSON.stringify({ messageId }),
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }))
        .catch(() => {
          if (lastMarkedReadRef.current === messageId) lastMarkedReadRef.current = null;
        });
    },
    [conversation.id, queryClient, realtime],
  );

  const markVisibleMessagesRead = useCallback(() => {
    const historyElement = historyRef.current;
    if (!historyElement || !userId) return;
    const historyRect = historyElement.getBoundingClientRect();
    const rows = historyElement.querySelectorAll<HTMLElement>('[data-message-id]');
    let latestVisibleIncomingId: string | undefined;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (
        row.dataset.messageAuthorId !== userId &&
        rect.bottom > historyRect.top &&
        rect.bottom <= historyRect.bottom + 1
      ) {
        latestVisibleIncomingId = row.dataset.messageId;
      }
    }
    if (latestVisibleIncomingId) markReadThrough(latestVisibleIncomingId);
  }, [markReadThrough, userId]);

  useEffect(() => {
    if (
      history.hasNextPage &&
      !history.isFetchingNextPage &&
      messages.length <= initialUnreadCountRef.current
    ) {
      void history.fetchNextPage();
    }
  }, [history, messages.length]);

  useEffect(() => {
    const loadedAllUnread = !history.hasNextPage || messages.length > initialUnreadCountRef.current;
    if (
      !loadedAllUnread ||
      !messages.length ||
      positionedConversationRef.current === conversation.id
    ) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const historyElement = historyRef.current;
      if (!historyElement) return;
      const unreadCount = Math.min(initialUnreadCountRef.current, messages.length);
      if (unreadCount > 0) {
        const firstUnread = messages[messages.length - unreadCount];
        const row = firstUnread
          ? historyElement.querySelector<HTMLElement>(`[data-message-id="${firstUnread.id}"]`)
          : null;
        if (row) {
          const historyRect = historyElement.getBoundingClientRect();
          historyElement.scrollTop += row.getBoundingClientRect().top - historyRect.top - 10;
        }
      } else {
        historyElement.scrollTop = historyElement.scrollHeight;
      }
      atBottomRef.current =
        historyElement.scrollHeight - historyElement.scrollTop - historyElement.clientHeight < 24;
      positionedConversationRef.current = conversation.id;
      markVisibleMessagesRead();
    });
    return () => cancelAnimationFrame(frame);
  }, [conversation.id, history.hasNextPage, markVisibleMessagesRead, messages]);

  useEffect(() => {
    if (positionedConversationRef.current !== conversation.id || !atBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      const historyElement = historyRef.current;
      if (!historyElement) return;
      historyElement.scrollTop = historyElement.scrollHeight;
      markVisibleMessagesRead();
    });
    return () => cancelAnimationFrame(frame);
  }, [conversation.id, markVisibleMessagesRead, messages.length]);

  useEffect(
    () => () => {
      if (readFrameRef.current !== null) cancelAnimationFrame(readFrameRef.current);
      if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current);
    },
    [],
  );

  const handleHistoryScroll = () => {
    const historyElement = historyRef.current;
    if (!historyElement) return;
    atBottomRef.current =
      historyElement.scrollHeight - historyElement.scrollTop - historyElement.clientHeight < 24;
    if (readFrameRef.current !== null) cancelAnimationFrame(readFrameRef.current);
    readFrameRef.current = requestAnimationFrame(() => {
      readFrameRef.current = null;
      markVisibleMessagesRead();
    });
  };

  const handleSend = () => {
    if (editingMessage) {
      if (!text.trim() || edit.isPending) return;
      edit.mutate({ id: editingMessage.id, value: text.trim() });
      return;
    }
    if ((!text.trim() && !attachments.length) || send.isPending) return;
    send.mutate();
  };

  const scrollToMessage = async (messageId: string): Promise<void> => {
    const historyElement = historyRef.current;
    if (!historyElement) return;
    let target = historyElement.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    let hasOlderMessages = Boolean(history.hasNextPage);

    while (!target && hasOlderMessages) {
      const result = await history.fetchNextPage();
      if (result.isError) return;
      hasOlderMessages = Boolean(result.hasNextPage);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      target = historyElement.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    }

    if (!target) return;
    target.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    target.classList.remove('reply-highlight');
    void target.offsetWidth;
    target.classList.add('reply-highlight');
    if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      target?.classList.remove('reply-highlight');
      highlightTimerRef.current = null;
    }, 2_800);
  };

  return (
    <section className="chat-pane">
      <header className="chat-header">
        <button
          className="icon-button back-button"
          type="button"
          aria-label="Назад к чатам"
          onClick={onBack}
        >
          <ArrowLeft size={22} />
        </button>
        <Avatar
          name={conversation.peer.displayName}
          src={conversation.peer.avatarUrl}
          size="sm"
          online={conversation.peer.online}
        />
        <div>
          <strong>{conversation.peer.displayName}</strong>
          <span>
            {realtime.peerTyping
              ? 'печатает…'
              : conversation.peer.online
                ? 'в сети'
                : 'был(а) недавно'}
          </span>
        </div>
        {!realtime.connected ? <WifiOff size={18} aria-label="Нет соединения" /> : null}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="icon-button" type="button" aria-label="Меню диалога">
              <MoreVertical size={22} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="context-menu" sideOffset={5} align="end">
              <DropdownMenu.Item
                className="danger"
                onSelect={() => {
                  setDeleteError(null);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 size={15} />
                Удалить диалог
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>
      <div className="message-history" ref={historyRef} onScroll={handleHistoryScroll}>
        {history.isLoading ? <p className="history-state">Загрузка сообщений…</p> : null}
        {history.isFetchingNextPage ? (
          <p className="history-state">Загрузка ранних сообщений…</p>
        ) : null}
        {!history.isLoading && !messages.length ? (
          <p className="history-state">Начните общение</p>
        ) : null}
        {messageDateGroups.map((group) => (
          <div className="message-date-group" key={group.id}>
            <div
              className="message-date-separator"
              role="separator"
              aria-label={formatMessageDate(group.date)}
            >
              <span>{formatMessageDate(group.date)}</span>
            </div>
            {group.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                own={message.authorId === userId}
                replyAuthorName={
                  message.replyTo
                    ? message.replyTo.authorId === userId
                      ? `@${currentUser?.username ?? ''}`
                      : `@${conversation.peer.username}`
                    : null
                }
                onReplyReferenceClick={(messageId) => void scrollToMessage(messageId)}
                onReply={() => {
                  if (editingMessage) setText('');
                  setEditingMessage(null);
                  setReplyTo(message);
                }}
                onEdit={() => {
                  setReplyTo(null);
                  setEditingMessage(message);
                  setText(message.text ?? '');
                  realtime.setTyping(false);
                }}
                onDeleteSelf={() => remove.mutate({ id: message.id, scope: 'self' })}
                onDeleteEveryone={() => remove.mutate({ id: message.id, scope: 'everyone' })}
              />
            ))}
          </div>
        ))}
      </div>
      <Composer
        value={text}
        onChange={(value) => {
          setText(value);
          if (!editingMessage) realtime.setTyping(Boolean(value.trim()));
        }}
        onSend={() => {
          handleSend();
          realtime.setTyping(false);
        }}
        onFiles={(files) => upload.mutate(files)}
        sending={send.isPending || edit.isPending}
        uploading={upload.isPending}
        attachments={attachments}
        onRemoveAttachment={(id) =>
          setAttachments((current) => current.filter((attachment) => attachment.id !== id))
        }
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => {
          setEditingMessage(null);
          setText('');
        }}
      />
      <Modal
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Удалить диалог?"
        description="Диалог и текущая история исчезнут только у вас. У собеседника переписка сохранится."
        contentClassName="confirm-dialog"
      >
        {deleteError ? <p className="form-error">{deleteError}</p> : null}
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setDeleteDialogOpen(false)}
          >
            Отмена
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={removeConversation.isPending}
            onClick={() => removeConversation.mutate()}
          >
            {removeConversation.isPending ? 'Удаление…' : 'Удалить'}
          </button>
        </div>
      </Modal>
    </section>
  );
}
