import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  closeLabel?: string;
}

/**
 * Отображает переиспользуемое модальное окно с затемнением фона и кнопкой закрытия.
 *
 * @param props - Параметры модального окна.
 * @param props.open - Признак открытого окна.
 * @param props.onOpenChange - Обработчик изменения состояния окна.
 * @param props.title - Заголовок окна.
 * @param props.description - Доступное описание окна.
 * @param props.children - Содержимое окна.
 * @param props.contentClassName - Дополнительный класс контейнера содержимого.
 * @param props.closeLabel - Доступная подпись кнопки закрытия.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  contentClassName,
  closeLabel = 'Закрыть',
}: ModalProps) {
  const className = ['dialog-content', contentClassName].filter(Boolean).join(' ');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={className}>
          <header>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label={closeLabel}>
              <X size={20} />
            </Dialog.Close>
          </header>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
