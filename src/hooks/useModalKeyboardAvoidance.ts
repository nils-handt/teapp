import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type KeyboardShowEvent = CustomEvent<{ keyboardHeight?: number }>;
const KEYBOARD_OPEN_CLASS = 'zen-modal-keyboard-open';

const getAppLayoutHeight = () => {
  const appHeight = document.querySelector('ion-app')?.clientHeight ?? 0;
  return appHeight || window.innerHeight;
};

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
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const restingAppHeightRef = useRef(0);

  const scrollFocusedFieldIntoView = useCallback(() => {
    if (keyboardHeight > 0) {
      scrollActiveFieldIntoView(bodyRef);
    }
  }, [bodyRef, keyboardHeight]);

  useEffect(() => {
    if (!isOpen) {
      setKeyboardHeight(0);
      setIsKeyboardOpen(false);
      document.documentElement.classList.remove(KEYBOARD_OPEN_CLASS);
      return undefined;
    }

    restingAppHeightRef.current = getAppLayoutHeight();

    const handleKeyboardShow = (event: Event) => {
      const { keyboardHeight: nextKeyboardHeight = 0 } = (event as KeyboardShowEvent).detail ?? {};
      const appResize = Math.max(0, restingAppHeightRef.current - getAppLayoutHeight());
      setKeyboardHeight(Math.max(0, nextKeyboardHeight - appResize));
      setIsKeyboardOpen(true);
      document.documentElement.classList.add(KEYBOARD_OPEN_CLASS);
      scrollActiveFieldIntoView(bodyRef);
    };
    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
      setIsKeyboardOpen(false);
      document.documentElement.classList.remove(KEYBOARD_OPEN_CLASS);
      window.requestAnimationFrame(() => {
        restingAppHeightRef.current = getAppLayoutHeight();
      });
    };
    const updateRestingAppHeight = () => {
      if (!document.documentElement.classList.contains(KEYBOARD_OPEN_CLASS)) {
        restingAppHeightRef.current = getAppLayoutHeight();
      }
    };

    window.addEventListener('ionKeyboardDidShow', handleKeyboardShow);
    window.addEventListener('ionKeyboardDidHide', handleKeyboardHide);
    window.addEventListener('resize', updateRestingAppHeight);

    return () => {
      window.removeEventListener('ionKeyboardDidShow', handleKeyboardShow);
      window.removeEventListener('ionKeyboardDidHide', handleKeyboardHide);
      window.removeEventListener('resize', updateRestingAppHeight);
      document.documentElement.classList.remove(KEYBOARD_OPEN_CLASS);
    };
  }, [bodyRef, isOpen]);

  return {
    keyboardHeight,
    isKeyboardOpen,
    scrollFocusedFieldIntoView,
  };
};
