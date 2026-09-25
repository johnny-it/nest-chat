import { MessageCircleMore } from 'lucide-react';

export function EmptyConversation() {
  return (
    <section className="empty-conversation">
      <span><MessageCircleMore size={30} /></span>
      <h2>Выберите чат, чтобы начать общение</h2>
      <p>Или создайте новый диалог по имени пользователя</p>
    </section>
  );
}
