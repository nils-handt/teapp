import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

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

  // A conditionally mounted modal has no closed render from which to retain a
  // baseline. Sample during the layout phase, before the operating system can
  // complete the asynchronous resize triggered by a committed autofocus input.
  useLayoutEffect(() => {
    if (!isOpen || restingAppHeightRef.current === 0) {
      restingAppHeightRef.current = getAppLayoutHeight();
    }
  }, [isOpen]);

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

    // Keep the height sampled while the modal was closed. An autofocus input
    // can resize the WebView before this open-state effect runs; sampling here
    // would then mistake the keyboard-reduced height for the resting height and
    // apply the native keyboard inset a second time.
    if (restingAppHeightRef.current === 0) {
      restingAppHeightRef.current = getAppLayoutHeight();
    }

    const handleKeyboardShow = (event: Event) => {
      const { keyboardHeight: nextKeyboardHeight = 0 } = (event as KeyboardShowEvent).detail ?? {};
      const appResize = Math.max(0, restingAppHeightRef.current - getAppLayoutHeight());
      setKeyboardHeight(Math.max(0, nextKeyboardHeight - appResize));
      setIsKeyboardOpen(true);
      document.documentElement.classList.add(KEYBOARD_OPEN_CLASS);
      scrollActiveFieldIntoView(bodyRef);
    };
    window.addEventListener('ionKeyboardDidShow', handleKeyboardShow);

    return () => {
      window.removeEventListener('ionKeyboardDidShow', handleKeyboardShow);
      document.documentElement.classList.remove(KEYBOARD_OPEN_CLASS);
    };
  }, [bodyRef, isOpen]);

  useEffect(() => {
    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
      setIsKeyboardOpen(false);
      document.documentElement.classList.remove(KEYBOARD_OPEN_CLASS);
      window.requestAnimationFrame(() => {
        restingAppHeightRef.current = getAppLayoutHeight();
      });
    };
    window.addEventListener('ionKeyboardDidHide', handleKeyboardHide);
    return () => window.removeEventListener('ionKeyboardDidHide', handleKeyboardHide);
  }, []);

  return {
    keyboardHeight,
    isKeyboardOpen,
    scrollFocusedFieldIntoView,
  };
};
