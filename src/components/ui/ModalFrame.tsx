import React, { useId, useRef, type CSSProperties } from 'react';
import {
  cn,
  zenModalActionsClass,
  zenModalOverlayClass,
  zenModalPanelClass,
  zenModalTitleClass,
} from '../../styles/zen';
import { useModalKeyboardAvoidance } from '../../hooks/useModalKeyboardAvoidance';

type ModalFrameProps = {
  isOpen: boolean;
  title?: string;
  header?: React.ReactNode;
  ariaLabel?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
};

const ModalFrame: React.FC<ModalFrameProps> = ({
  isOpen,
  title,
  header,
  ariaLabel,
  children,
  actions,
  overlayClassName,
  panelClassName,
  headerClassName,
}) => {
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const { keyboardHeight, isKeyboardOpen, scrollFocusedFieldIntoView } = useModalKeyboardAvoidance(isOpen, bodyRef);

  if (!isOpen) {
    return null;
  }

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
      <div className={cn(zenModalPanelClass, panelClassName)}>
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
