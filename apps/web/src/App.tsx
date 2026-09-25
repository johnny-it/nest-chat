import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from './features/auth/AuthPage';
import { ChatPage } from './features/chat/ChatPage';
import { useAuthStore } from './state/auth-store';

export function App() {
  const user = useAuthStore((state) => state.user);
  if (!user) return <AuthPage />;
  return (
    <Routes>
      <Route path="/chat/:conversationId?" element={<ChatPage />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
