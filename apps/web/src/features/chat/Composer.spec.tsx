import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDto, MessageDto } from '@nestchat/contracts';
import { Composer } from './Composer';
import '../../styles/global.css';

function ControlledComposer({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);

  return (
    <Composer
      value={value}
      onChange={setValue}
      onSend={() => undefined}
      onFiles={() => undefined}
      sending={false}
      uploading={false}
      attachments={[]}
      onRemoveAttachment={() => undefined}
      replyTo={null}
      onCancelReply={() => undefined}
      editingMessage={null}
      onCancelEdit={() => undefined}
    />
  );
}

describe('Поле ввода сообщения', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(new Blob(['image']), { status: 200 })),
    );
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:reply-image'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('показывает до десяти квадратных вложений и позволяет удалить выбранное', async () => {
    const onRemoveAttachment = vi.fn();
    const attachments: AttachmentDto[] = Array.from({ length: 10 }, (_, index) => ({
      id: crypto.randomUUID(),
      originalName: `документ-${index + 1}.pdf`,
      mimeType: 'application/pdf',
      size: 1024,
      url: `/files/${index + 1}`,
      kind: 'document',
    }));

    render(
      <Composer
        value=""
        onChange={() => undefined}
        onSend={() => undefined}
        onFiles={() => undefined}
        sending={false}
        uploading={false}
        attachments={attachments}
        onRemoveAttachment={onRemoveAttachment}
        replyTo={null}
        onCancelReply={() => undefined}
        editingMessage={null}
        onCancelEdit={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Добавленные вложения')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Удалить вложение/ })).toHaveLength(10);
    await userEvent.click(screen.getByRole('button', { name: 'Удалить вложение документ-1.pdf' }));
    expect(onRemoveAttachment).toHaveBeenCalledWith(attachments[0]?.id);
  });

  it('показывает превью редактируемого текста и позволяет отменить редактирование', async () => {
    const onCancelEdit = vi.fn();
    const editingMessage = {
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      authorId: crypto.randomUUID(),
      text: 'Исходный текст',
      replyToId: null,
      replyTo: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: 'sent' as const,
      attachments: [],
    };

    render(
      <Composer
        value="Исходный текст"
        onChange={() => undefined}
        onSend={() => undefined}
        onFiles={() => undefined}
        sending={false}
        uploading={false}
        attachments={[]}
        onRemoveAttachment={() => undefined}
        replyTo={null}
        onCancelReply={() => undefined}
        editingMessage={editingMessage}
        onCancelEdit={onCancelEdit}
      />,
    );

    expect(screen.getByText('Редактирование')).toBeInTheDocument();
    expect(document.querySelector('.composer-context-text')).toHaveTextContent('Исходный текст');
    expect(screen.getByPlaceholderText('Сообщение')).toHaveValue('Исходный текст');
    expect(screen.getByPlaceholderText('Сообщение')).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Отменить редактирование' }));
    expect(onCancelEdit).toHaveBeenCalledOnce();
  });

  it('показывает миниатюру слева и текст справа при ответе на сообщение с изображением', async () => {
    const replyTo: MessageDto = {
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      authorId: crypto.randomUUID(),
      text: 'Подпись к фотографии',
      replyToId: null,
      replyTo: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: null,
      attachments: [
        {
          id: crypto.randomUUID(),
          originalName: 'фотография.jpg',
          mimeType: 'image/jpeg',
          size: 2048,
          url: `/files/${crypto.randomUUID()}`,
          kind: 'image',
        },
      ],
    };

    render(
      <Composer
        value=""
        onChange={() => undefined}
        onSend={() => undefined}
        onFiles={() => undefined}
        sending={false}
        uploading={false}
        attachments={[]}
        onRemoveAttachment={() => undefined}
        replyTo={replyTo}
        onCancelReply={() => undefined}
        editingMessage={null}
        onCancelEdit={() => undefined}
      />,
    );

    const preview = await screen.findByRole('img', { name: 'фотография.jpg' });
    expect(preview).toHaveClass('composer-reply-thumbnail');
    expect(screen.getByText('Подпись к фотографии')).toBeInTheDocument();
  });

  it('подписывает ответ без текста как изображение', async () => {
    const replyTo: MessageDto = {
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      authorId: crypto.randomUUID(),
      text: null,
      replyToId: null,
      replyTo: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: null,
      attachments: [
        {
          id: crypto.randomUUID(),
          originalName: 'изображение.png',
          mimeType: 'image/png',
          size: 1024,
          url: `/files/${crypto.randomUUID()}`,
          kind: 'image',
        },
      ],
    };

    render(
      <Composer
        value=""
        onChange={() => undefined}
        onSend={() => undefined}
        onFiles={() => undefined}
        sending={false}
        uploading={false}
        attachments={[]}
        onRemoveAttachment={() => undefined}
        replyTo={replyTo}
        onCancelReply={() => undefined}
        editingMessage={null}
        onCancelEdit={() => undefined}
      />,
    );

    expect(await screen.findByRole('img', { name: 'изображение.png' })).toBeInTheDocument();
    expect(screen.getByText('Изображение')).toBeInTheDocument();
  });
  it('не схлопывает строку текста ответа в вертикальном блоке', () => {
    const replyTo: MessageDto = {
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      authorId: crypto.randomUUID(),
      text: 'Текст ответа должен быть виден',
      replyToId: null,
      replyTo: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: null,
      attachments: [],
    };

    render(
      <Composer
        value=""
        onChange={() => undefined}
        onSend={() => undefined}
        onFiles={() => undefined}
        sending={false}
        uploading={false}
        attachments={[]}
        onRemoveAttachment={() => undefined}
        replyTo={replyTo}
        onCancelReply={() => undefined}
        editingMessage={null}
        onCancelEdit={() => undefined}
      />,
    );

    const replyText = screen.getByText('Текст ответа должен быть виден');
    expect(getComputedStyle(replyText).flexBasis).toBe('auto');
  });

  it('вставляет выбранный эмодзи в позицию курсора', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer initialValue="Привет мир" />);

    const textarea = screen.getByPlaceholderText('Сообщение') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(6, 6);
    await user.click(screen.getByRole('button', { name: 'Выбрать эмодзи' }));
    expect(screen.getByRole('dialog', { name: 'Выбор эмодзи' })).toBeInTheDocument();
    const emojiButton = screen.getByRole('button', { name: 'Вставить эмодзи 😊' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Вставить эмодзи 😀' })).toHaveFocus());

    await user.click(emojiButton);

    expect(screen.queryByRole('dialog', { name: 'Выбор эмодзи' })).not.toBeInTheDocument();
    await waitFor(() => expect(textarea).toHaveValue('Привет😊 мир'));
    expect(textarea).toHaveFocus();
    expect(textarea.selectionStart).toBe(8);
    expect(textarea.selectionEnd).toBe(8);
  });

  it('закрывает панель эмодзи по Escape и возвращает фокус на кнопку', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer initialValue="" />);
    const trigger = screen.getByRole('button', { name: 'Выбрать эмодзи' });

    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Вставить эмодзи 😀' })).toHaveFocus());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Выбор эмодзи' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('закрывает панель эмодзи при клике вне неё', async () => {
    const user = userEvent.setup();

    render(
      <Composer
        value=""
        onChange={() => undefined}
        onSend={() => undefined}
        onFiles={() => undefined}
        sending={false}
        uploading={false}
        attachments={[]}
        onRemoveAttachment={() => undefined}
        replyTo={null}
        onCancelReply={() => undefined}
        editingMessage={null}
        onCancelEdit={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Выбрать эмодзи' }));
    expect(screen.getByRole('dialog', { name: 'Выбор эмодзи' })).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole('dialog', { name: 'Выбор эмодзи' })).not.toBeInTheDocument();
  });
});
