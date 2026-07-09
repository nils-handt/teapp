import React, { useId } from 'react';
import {
  cn,
  zenModalActionsClass,
  zenModalOverlayClass,
  zenModalPanelClass,
  zenModalTitleClass,
} from '../../styles/zen';

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
        <div className="min-h-0 overflow-y-auto pr-0.5">
          {children}
        </div>
        {actions ? <div className={zenModalActionsClass}>{actions}</div> : null}
      </div>
    </div>
  );
};

export default ModalFrame;
