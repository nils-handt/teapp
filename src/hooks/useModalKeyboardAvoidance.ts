import { useCallback, useEffect, useState, type RefObject } from 'react';

type KeyboardShowEvent = CustomEvent<{ keyboardHeight?: number }>;

const scrollActiveFieldIntoView = (bodyRef: RefObject<HTMLElement | null>) => {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && bodyRef.current?.contains(activeElement)) {
    activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
};

export const useModalKeyboardAvoidance = (
  isOpen: boolean,
  bodyRef: RefObject<HTMLElement | null>,
) => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollFocusedFieldIntoView = useCallback(() => {
    if (keyboardHeight > 0) {
      scrollActiveFieldIntoView(bodyRef);
    }
  }, [bodyRef, keyboardHeight]);

  useEffect(() => {
    if (!isOpen) {
      setKeyboardHeight(0);
      return undefined;
    }

    const handleKeyboardShow = (event: Event) => {
      const { keyboardHeight: nextKeyboardHeight = 0 } = (event as KeyboardShowEvent).detail ?? {};
      setKeyboardHeight(nextKeyboardHeight);
      scrollActiveFieldIntoView(bodyRef);
    };
    const handleKeyboardHide = () => setKeyboardHeight(0);

    window.addEventListener('ionKeyboardDidShow', handleKeyboardShow);
    window.addEventListener('ionKeyboardDidHide', handleKeyboardHide);

    return () => {
      window.removeEventListener('ionKeyboardDidShow', handleKeyboardShow);
      window.removeEventListener('ionKeyboardDidHide', handleKeyboardHide);
    };
  }, [bodyRef, isOpen]);

  return {
    keyboardHeight,
    scrollFocusedFieldIntoView,
  };
};
