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
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
};

const ModalFrame: React.FC<ModalFrameProps> = ({
  isOpen,
  title,
  children,
  actions,
  overlayClassName,
  panelClassName,
}) => {
  const titleId = useId();

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={cn(zenModalOverlayClass, overlayClassName)}
    >
      <div className={cn(zenModalPanelClass, panelClassName)}>
        <h3 id={titleId} className={zenModalTitleClass}>
          {title}
        </h3>
        {children}
        {actions ? <div className={zenModalActionsClass}>{actions}</div> : null}
      </div>
    </div>
  );
};

export default ModalFrame;
