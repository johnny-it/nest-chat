import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ConversationDto, CursorPage, UserDto } from '@nestchat/contracts';
import { Avatar } from '../../components/Avatar';
import { Modal } from '../../components/Modal';
import { apiFetch } from '../../lib/api';

/**
 * Отображает окно поиска пользователя и создания нового чата.
 *
 * @param props - Параметры окна нового чата.
 * @param props.open - Признак открытого окна.
 * @param props.onOpenChange - Обработчик изменения состояния окна.
 */
export function NewChatDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query), 300);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const users = useQuery({
    queryKey: ['user-search', debouncedQuery],
    queryFn: () =>
      apiFetch<CursorPage<UserDto>>(`/users/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: open && debouncedQuery.trim().length >= 2,
    placeholderData: (previousData) =>
      debouncedQuery.trim().length >= 2 ? previousData : undefined,
  });
  const create = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<ConversationDto>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onOpenChange(false);
      setQuery('');
      navigate(`/chat/${conversation.id}`);
    },
  });
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Новый чат"
      description="Найдите пользователя по имени"
    >
      <label className="search-field dialog-search">
        <Search size={17} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Username"
        />
      </label>
      <div className="user-results">
        {users.data?.items.map((user) => (
          <button type="button" key={user.id} onClick={() => create.mutate(user.id)}>
            <Avatar name={user.displayName} src={user.avatarUrl} />
            <span>
              <strong>{user.displayName}</strong>
              <small>@{user.username}</small>
            </span>
          </button>
        ))}
        {query.length < 2 ? <p>Введите минимум 2 символа</p> : null}
        {query.length >= 2 && users.data && !users.data.items.length ? (
          <p>Пользователи не найдены</p>
        ) : null}
      </div>
    </Modal>
  );
}
