import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MessageDto } from '@nestchat/contracts';
import { MessageBubble } from './MessageBubble';

describe('Ответ в сообщении', () => {
  afterEach(cleanup);

  it('показывает автора и текст ответа и переходит к исходному сообщению', async () => {
    const replyId = crypto.randomUUID();
    const onReplyReferenceClick = vi.fn();
    const message: MessageDto = {
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      authorId: crypto.randomUUID(),
      text: 'Мой ответ',
      replyToId: replyId,
      replyTo: {
        id: replyId,
        authorId: crypto.randomUUID(),
        text: 'Очень длинный исходный текст сообщения',
        deletedForAllAt: null,
      },
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: null,
      attachments: [],
    };

    render(
      <MessageBubble
        message={message}
        own={false}
        replyAuthorName="@max"
        onReplyReferenceClick={onReplyReferenceClick}
        onReply={() => undefined}
        onEdit={() => undefined}
        onDeleteSelf={() => undefined}
        onDeleteEveryone={() => undefined}
      />,
    );

    expect(screen.getByText('@max')).toBeInTheDocument();
    expect(screen.getByText('Очень длинный исходный текст сообщения')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /@max/ }));
    expect(onReplyReferenceClick).toHaveBeenCalledWith(replyId);
  });
  it('открывает меню сообщения при наведении мышью на троеточие', async () => {
    const message: MessageDto = {
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      authorId: crypto.randomUUID(),
      text: 'Сообщение с меню',
      replyToId: null,
      replyTo: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: null,
      attachments: [],
    };

    render(
      <MessageBubble
        message={message}
        own={false}
        replyAuthorName={null}
        onReplyReferenceClick={() => undefined}
        onReply={() => undefined}
        onEdit={() => undefined}
        onDeleteSelf={() => undefined}
        onDeleteEveryone={() => undefined}
      />,
    );

    fireEvent.pointerEnter(screen.getByRole('button', { name: /Действия с сообщением/i }), {
      pointerType: 'mouse',
    });

    expect(await screen.findByRole('menuitem', { name: 'Ответить' })).toBeVisible();
  });

  it('не возвращает фокус на троеточие после закрытия меню, открытого мышью', async () => {
    const message: MessageDto = {
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      authorId: crypto.randomUUID(),
      text: 'Сообщение с меню',
      replyToId: null,
      replyTo: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: null,
      attachments: [],
    };

    render(
      <MessageBubble
        message={message}
        own={false}
        replyAuthorName={null}
        onReplyReferenceClick={() => undefined}
        onReply={() => undefined}
        onEdit={() => undefined}
        onDeleteSelf={() => undefined}
        onDeleteEveryone={() => undefined}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Действия с сообщением/i });
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });

    const menuItem = await screen.findByRole('menuitem', { name: 'Ответить' });
    menuItem.focus();
    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });

    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Ответить' })).toBeNull());
    expect(trigger).not.toHaveFocus();
  });
});
