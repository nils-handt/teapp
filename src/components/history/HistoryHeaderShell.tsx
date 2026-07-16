import { IonBackButton, IonButtons, IonHeader } from '@ionic/react';
import type { FC, ReactNode } from 'react';
import { cn } from '../../styles/zen';

type HistoryHeaderShellProps = {
  backHref?: string;
  children?: ReactNode;
  eyebrow?: string;
  title?: string;
  titleMuted?: boolean;
};

const HistoryHeaderShell: FC<HistoryHeaderShellProps> = ({
  backHref,
  children,
  eyebrow,
  title,
  titleMuted = false,
}) => {
  const hasTitleRow = Boolean(backHref || eyebrow || title);

  return (
    <IonHeader className="ion-no-border zen-history-header">
      <div className="zen-history-header-frame">
        <div className="zen-history-header-surface" data-testid="history-header-surface">
          {hasTitleRow && (
            <div className="zen-history-header-title-row">
              {backHref && (
                <IonButtons className="zen-history-header-back-wrap">
                  <IonBackButton
                    defaultHref={backHref}
                    text=""
                    aria-label="Back"
                    className="zen-history-header-back-button"
                  />
                </IonButtons>
              )}
              <div className="min-w-0 flex-1">
                {eyebrow && <div className="zen-history-header-eyebrow">{eyebrow}</div>}
                {title && (
                  <h1
                    data-testid="history-header-title"
                    className={cn('zen-history-header-title', titleMuted && 'text-zen-muted')}
                  >
                    {title}
                  </h1>
                )}
              </div>
            </div>
          )}
          {children && (
            <div className={cn(
              'zen-history-header-controls',
              hasTitleRow && 'zen-history-header-controls--separated',
            )}>
              {children}
            </div>
          )}
        </div>
      </div>
    </IonHeader>
  );
};

export default HistoryHeaderShell;
