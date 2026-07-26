import React, { useId, useRef, type CSSProperties } from 'react';
import {
  cn,
  zenModalActionsClass,
  zenModalOverlayClass,
  zenModalPanelClass,
  zenModalTitleClass,
} from '../../styles/zen';
import { useModalKeyboardAvoidance } from '../../hooks/useModalKeyboardAvoidance';

const SINGLE_LINE_INPUT_TYPES = new Set([
  'date', 'datetime-local', 'email', 'month', 'number', 'password', 'search', 'tel', 'text', 'time', 'url', 'week',
]);

type ModalFrameProps = {
  isOpen: boolean;
  title?: string;
  header?: React.ReactNode;
  ariaLabel?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  onSubmit?: () => void;
  overlayClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  expandToAvailableHeightOnKeyboard?: boolean;
};

const ModalFrame: React.FC<ModalFrameProps> = ({
  isOpen,
  title,
  header,
  ariaLabel,
  children,
  actions,
  onSubmit,
  overlayClassName,
  panelClassName,
  headerClassName,
  expandToAvailableHeightOnKeyboard = false,
}) => {
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const { keyboardHeight, isKeyboardOpen, scrollFocusedFieldIntoView } = useModalKeyboardAvoidance(isOpen, bodyRef);

  if (!isOpen) {
    return null;
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== 'Enter'
      || event.defaultPrevented
      || event.repeat
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
      || event.nativeEvent.isComposing
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !SINGLE_LINE_INPUT_TYPES.has(target.type)) {
      return;
    }

    const fields = Array.from(
      event.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'),
    ).filter((field) => (
      !field.disabled
      && !field.readOnly
      && (field instanceof HTMLTextAreaElement || SINGLE_LINE_INPUT_TYPES.has(field.type))
    ));
    const currentIndex = fields.indexOf(target);
    const nextField = currentIndex >= 0 ? fields[currentIndex + 1] : undefined;

    if (nextField) {
      event.preventDefault();
      nextField.focus();
      return;
    }

    if (onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title || header ? titleId : undefined}
      aria-label={!title && !header ? ariaLabel : undefined}
      className={cn(zenModalOverlayClass, overlayClassName)}
      data-keyboard-open={isKeyboardOpen}
      style={{ '--modal-keyboard-height': `${keyboardHeight}px` } as CSSProperties}
    >
      <div
        className={cn(zenModalPanelClass, panelClassName)}
        style={isKeyboardOpen && expandToAvailableHeightOnKeyboard ? { height: '100%' } : undefined}
      >
        {header ? (
          <div id={titleId} className={cn(zenModalTitleClass, headerClassName)}>
            {header}
          </div>
        ) : title ? (
          <h3 id={titleId} className={zenModalTitleClass}>
            {title}
          </h3>
        ) : null}
        <div
          ref={bodyRef}
          onKeyDownCapture={handleKeyDown}
          onFocusCapture={scrollFocusedFieldIntoView}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-0.5"
        >
          {children}
        </div>
        {actions ? <div className={zenModalActionsClass}>{actions}</div> : null}
      </div>
    </div>
  );
};

export default ModalFrame;
