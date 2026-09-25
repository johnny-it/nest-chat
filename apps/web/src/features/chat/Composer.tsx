import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Send,
  Smile,
  X,
} from 'lucide-react';
import type { AttachmentDto, MessageDto } from '@nestchat/contracts';
import { useAuthStore } from '../../state/auth-store';
import { fetchAttachment } from './AttachmentView';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onFiles: (files: File[]) => void;
  sending: boolean;
  uploading: boolean;
  attachments: AttachmentDto[];
  onRemoveAttachment: (id: string) => void;
  replyTo: MessageDto | null;
  onCancelReply: () => void;
  editingMessage: MessageDto | null;
  onCancelEdit: () => void;
}

const availableEmojis = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😊',
  '😍',
  '🥰',
  '😘',
  '😂',
  '🤣',
  '😉',
  '😎',
  '🤔',
  '😢',
  '😭',
  '😡',
  '👍',
  '👎',
  '👏',
  '🙌',
  '🙏',
  '💪',
  '🤝',
  '❤️',
  '🔥',
  '🎉',
  '✨',
  '💯',
] as const;

/**
 * Отображает поле создания сообщения, вложения и контекст ответа или редактирования.
 *
 * @param props - Параметры поля ввода сообщения.
 */
export function Composer(props: ComposerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const firstEmojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const emojiPickerId = useId();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const replyImage = props.replyTo?.attachments.find((attachment) => attachment.kind === 'image');

  const updateSlider = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    setCanScrollLeft(strip.scrollLeft > 1);
    setCanScrollRight(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !props.attachments.length) return;
    updateSlider();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSlider);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [props.attachments, updateSlider]);

  useEffect(() => {
    if (!props.editingMessage) return;
    textareaRef.current?.focus();
    const textLength = props.editingMessage.text?.length ?? 0;
    textareaRef.current?.setSelectionRange(textLength, textLength);
  }, [props.editingMessage]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const focusFrame = requestAnimationFrame(() => firstEmojiButtonRef.current?.focus());
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (emojiButtonRef.current?.contains(target) || emojiPickerRef.current?.contains(target)) {
        return;
      }
      setEmojiPickerOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [emojiPickerOpen]);

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const savedSelection = emojiSelectionRef.current;
    const selectionStart = savedSelection?.start ?? textarea?.selectionStart ?? props.value.length;
    const selectionEnd = savedSelection?.end ?? textarea?.selectionEnd ?? selectionStart;
    props.onChange(
      `${props.value.slice(0, selectionStart)}${emoji}${props.value.slice(selectionEnd)}`,
    );
    emojiSelectionRef.current = null;
    setEmojiPickerOpen(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      const nextCursorPosition = selectionStart + emoji.length;
      textarea?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const toggleEmojiPicker = () => {
    if (emojiPickerOpen) {
      setEmojiPickerOpen(false);
      return;
    }
    const textarea = textareaRef.current;
    emojiSelectionRef.current = {
      start: textarea?.selectionStart ?? props.value.length,
      end: textarea?.selectionEnd ?? props.value.length,
    };
    setEmojiPickerOpen(true);
  };

  const scrollPreviews = (direction: -1 | 1) => {
    stripRef.current?.scrollBy({ left: direction * 220, behavior: 'smooth' });
  };

  return (
    <div className="composer-wrap">
      {props.editingMessage ? (
        <div className="composer-context">
          <span className="composer-context-copy">
            <strong>Редактирование</strong>
            <span className="composer-context-text">{props.editingMessage.text}</span>
          </span>
          <button type="button" aria-label="Отменить редактирование" onClick={props.onCancelEdit}>
            <X size={17} />
          </button>
        </div>
      ) : props.replyTo ? (
        <div className="composer-context reply-context">
          {replyImage ? <ReplyImageThumbnail attachment={replyImage} /> : null}
          <span className="composer-context-copy">
            <strong>Ответ</strong>
            <span className="composer-context-text">
              {props.replyTo.text || (replyImage ? 'Изображение' : 'Сообщение')}
            </span>
          </span>
          <button type="button" aria-label="Отменить ответ" onClick={props.onCancelReply}>
            <X size={17} />
          </button>
        </div>
      ) : null}
      {props.attachments.length ? (
        <div className="upload-preview-slider" aria-label="Добавленные вложения">
          {canScrollLeft ? (
            <button
              className="preview-nav previous"
              type="button"
              aria-label="Предыдущие вложения"
              onClick={() => scrollPreviews(-1)}
            >
              <ChevronLeft size={18} />
            </button>
          ) : null}
          <div className="upload-preview-strip" ref={stripRef} onScroll={updateSlider}>
            {props.attachments.map((file) => (
              <AttachmentPreview
                key={file.id}
                attachment={file}
                onRemove={() => props.onRemoveAttachment(file.id)}
              />
            ))}
          </div>
          {canScrollRight ? (
            <button
              className="preview-nav next"
              type="button"
              aria-label="Следующие вложения"
              onClick={() => scrollPreviews(1)}
            >
              <ChevronRight size={18} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="composer">
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,.docx,.xlsx,.zip"
          onChange={(event) => {
            const availableSlots = Math.max(0, 10 - props.attachments.length);
            const selectedFiles = Array.from(event.target.files ?? []).slice(0, availableSlots);
            if (selectedFiles.length) props.onFiles(selectedFiles);
            event.currentTarget.value = '';
          }}
        />
        <button
          type="button"
          aria-label={
            props.attachments.length >= 10 ? 'Достигнут лимит вложений' : 'Прикрепить файл'
          }
          disabled={props.uploading || props.attachments.length >= 10}
          onClick={() => fileInput.current?.click()}
        >
          <Paperclip size={21} />
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              props.onSend();
            }
          }}
          placeholder="Сообщение"
        />
        <button
          ref={emojiButtonRef}
          type="button"
          aria-label="Выбрать эмодзи"
          aria-controls={emojiPickerId}
          aria-expanded={emojiPickerOpen}
          aria-haspopup="dialog"
          onClick={toggleEmojiPicker}
        >
          <Smile size={20} />
        </button>
        {emojiPickerOpen ? (
          <div
            ref={emojiPickerRef}
            className="emoji-picker"
            id={emojiPickerId}
            role="dialog"
            aria-label="Выбор эмодзи"
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              setEmojiPickerOpen(false);
              requestAnimationFrame(() => emojiButtonRef.current?.focus());
            }}
          >
            <span className="emoji-picker-title">Эмодзи</span>
            <div className="emoji-picker-grid">
              {availableEmojis.map((emoji, index) => (
                <button
                  key={emoji}
                  ref={index === 0 ? firstEmojiButtonRef : undefined}
                  type="button"
                  aria-label={`Вставить эмодзи ${emoji}`}
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button
          className="send-button"
          type="button"
          aria-label="Отправить"
          disabled={props.sending || props.uploading}
          onClick={props.onSend}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}

function ReplyImageThumbnail({ attachment }: { attachment: AttachmentDto }) {
  const token = useAuthStore((state) => state.accessToken);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let url: string | undefined;
    void fetchAttachment(attachment, token)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImageUrl(url);
      })
      .catch(() => setImageUrl(null));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment, token]);

  return imageUrl ? (
    <img
      className="composer-reply-thumbnail"
      src={imageUrl}
      alt={attachment.originalName}
    />
  ) : (
    <span className="composer-reply-thumbnail placeholder" aria-hidden="true">
      <ImageIcon size={18} />
    </span>
  );
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: AttachmentDto;
  onRemove: () => void;
}) {
  const token = useAuthStore((state) => state.accessToken);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (attachment.kind !== 'image') return;
    let active = true;
    let url: string | undefined;
    void fetchAttachment(attachment, token)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImageUrl(url);
      })
      .catch(() => setImageUrl(null));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment, token]);

  return (
    <div className="upload-preview" title={attachment.originalName}>
      {attachment.kind === 'image' && imageUrl ? (
        <img src={imageUrl} alt={attachment.originalName} />
      ) : (
        <span className="upload-preview-file">
          <FileText size={22} />
          <small>{attachment.originalName}</small>
        </span>
      )}
      <button
        type="button"
        aria-label={`Удалить вложение ${attachment.originalName}`}
        onClick={onRemove}
      >
        <X size={13} />
      </button>
    </div>
  );
}
