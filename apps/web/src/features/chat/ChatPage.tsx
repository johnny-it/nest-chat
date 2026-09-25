import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { ConversationDto } from '@nestchat/contracts';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../state/auth-store';
import { ConversationList } from './ConversationList';
import { AvatarEditorDialog } from './AvatarEditorDialog';
import { EmptyConversation } from './EmptyConversation';
import { ChatPane } from './ChatPane';
import { NewChatDialog } from './NewChatDialog';
import { useRealtime } from './useRealtime';

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clear);
  const realtime = useRealtime(conversationId);
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiFetch<ConversationDto[]>('/conversations'),
  });
  const selected = conversations.data?.find((conversation) => conversation.id === conversationId);

  return (
    <main className="chat-shell">
      <ConversationList
        username={user?.username ?? ''}
        avatarUrl={user?.avatarUrl}
        conversations={conversations.data ?? []}
        selectedId={conversationId}
        search={search}
        onSearch={setSearch}
        onSelect={(id) => navigate(`/chat/${id}`)}
        onNewChat={() => setNewChatOpen(true)}
        onAvatarClick={() => setAvatarEditorOpen(true)}
        onLogout={() => {
          void apiFetch('/auth/logout', { method: 'POST' }).finally(clearAuth);
        }}
      />
      {conversationId && selected ? (
        <ChatPane
          conversation={selected}
          onBack={() => navigate('/chat')}
          onDeleted={() => navigate('/chat')}
          realtime={realtime}
        />
      ) : (
        <EmptyConversation />
      )}
      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} />
      {user ? (
        <AvatarEditorDialog
          open={avatarEditorOpen}
          user={user}
          onOpenChange={setAvatarEditorOpen}
        />
      ) : null}
    </main>
  );
}
