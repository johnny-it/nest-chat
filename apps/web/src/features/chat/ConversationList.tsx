import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, MoreVertical, Plus, Search } from 'lucide-react';
import type { ConversationDto } from '@nestchat/contracts';
import { Avatar } from '../../components/Avatar';

interface ConversationListProps {
  username: string;
  avatarUrl?: string | null | undefined;
  conversations: ConversationDto[];
  selectedId?: string | undefined;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onAvatarClick: () => void;
  onLogout: () => void;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function ConversationList({
  username,
  avatarUrl,
  conversations,
  selectedId,
  search,
  onSearch,
  onSelect,
  onNewChat,
  onAvatarClick,
  onLogout,
}: ConversationListProps) {
  const filtered = conversations.filter((conversation) =>
    conversation.peer.displayName.toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU')),
  );
  return (
    <aside className={`conversation-sidebar ${selectedId ? 'mobile-hidden' : ''}`}>
      <header className="sidebar-header">
        <h1 className="visually-hidden">Чаты</h1>
        <button className="icon-button accent-button" type="button" aria-label="Новый чат" onClick={onNewChat}>
          <Plus size={21} />
        </button>
        <div className="sidebar-profile" aria-label={`Текущий пользователь: ${username}`}>
          <button
            className="self-avatar"
            type="button"
            aria-label="Изменить аватар"
            onClick={onAvatarClick}
          >
            <Avatar name={username} src={avatarUrl} size="sm" />
          </button>
          <strong title={username}>@{username}</strong>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="icon-button" type="button" aria-label="Меню пользователя">
              <MoreVertical size={22} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="context-menu" sideOffset={5} align="end">
              <DropdownMenu.Item onSelect={onLogout}><LogOut size={15} />Выйти</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>
      <label className="search-field">
        <Search size={17} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Поиск" />
      </label>
      <div className="conversation-list" role="list">
        {filtered.map((conversation) => (
          <button
            type="button"
            role="listitem"
            className={`conversation-row ${selectedId === conversation.id ? 'selected' : ''}`}
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
          >
            <Avatar name={conversation.peer.displayName} src={conversation.peer.avatarUrl} online={conversation.peer.online} />
            <span className="conversation-copy">
              <strong>{conversation.peer.displayName}</strong>
              <span>{conversation.lastMessage?.text ?? 'Начните общение'}</span>
            </span>
            <span className="conversation-meta">
              <time>{formatTime(conversation.updatedAt)}</time>
              {conversation.unreadCount ? <b>{conversation.unreadCount}</b> : null}
            </span>
          </button>
        ))}
        {!filtered.length ? <p className="list-empty">Диалоги не найдены</p> : null}
      </div>
    </aside>
  );
}
