/* eslint-disable react/prop-types */
import { IonButton } from '@ionic/react';
import type { ComponentProps } from 'react';
import { cn } from '../../styles/zen';

type AppButtonVariant = 'primary' | 'danger' | 'soft';

type AppButtonProps = ComponentProps<typeof IonButton> & {
  variant?: AppButtonVariant;
};

const AppButton: React.FC<AppButtonProps> = ({
  variant = 'primary',
  shape = 'round',
  className,
  ...props
}) => (
  <IonButton
    {...props}
    shape={shape}
    data-zen-variant={variant}
    className={cn('font-medium', className)}
  />
);

export default AppButton;
