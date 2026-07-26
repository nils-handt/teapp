import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ModalFrame from './ModalFrame';

const renderModal = () => render(
  <ModalFrame
    isOpen
    title="Edit value"
    actions={<button type="button">Save</button>}
  >
    <input aria-label="Value" />
  </ModalFrame>,
);

const showKeyboard = (keyboardHeight: number) => {
  window.dispatchEvent(new CustomEvent('ionKeyboardDidShow', {
    detail: { keyboardHeight },
  }));
};

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('zen-modal-keyboard-open');
  document.querySelectorAll('ion-app[data-test-layout-root]').forEach((element) => element.remove());
});

describe('ModalFrame keyboard avoidance', () => {
  it('insets the dialog above the keyboard and resets when it hides', () => {
    renderModal();

    const dialog = screen.getByRole('dialog');
    const panel = dialog.firstElementChild as HTMLElement;
    expect(dialog.style.getPropertyValue('--modal-keyboard-height')).toBe('0px');
    expect(panel.style.height).toBe('');

    act(() => showKeyboard(286));

    expect(dialog.style.getPropertyValue('--modal-keyboard-height')).toBe('286px');
    expect(dialog.getAttribute('data-keyboard-open')).toBe('true');
    expect(panel.style.height).toBe('');
    expect(document.documentElement.classList.contains('zen-modal-keyboard-open')).toBe(true);

    act(() => window.dispatchEvent(new Event('ionKeyboardDidHide')));

    expect(dialog.style.getPropertyValue('--modal-keyboard-height')).toBe('0px');
    expect(dialog.getAttribute('data-keyboard-open')).toBe('false');
    expect(panel.style.height).toBe('');
    expect(document.documentElement.classList.contains('zen-modal-keyboard-open')).toBe(false);
  });

  it('does not add a second keyboard inset when Ionic already resized the app', () => {
    const app = document.createElement('ion-app');
    app.dataset.testLayoutRoot = '';
    let appHeight = 800;
    Object.defineProperty(app, 'clientHeight', {
      configurable: true,
      get: () => appHeight,
    });
    document.body.append(app);
    renderModal();

    appHeight = 520;
    act(() => showKeyboard(280));

    const dialog = screen.getByRole('dialog');
    expect(dialog.style.getPropertyValue('--modal-keyboard-height')).toBe('0px');
    expect(dialog.getAttribute('data-keyboard-open')).toBe('true');
  });

  it('scrolls a focused field into the modal body after the keyboard opens', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    renderModal();

    const input = screen.getByRole('textbox', { name: 'Value' });
    act(() => input.focus());
    act(() => showKeyboard(286));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });

  it('removes its keyboard listeners when unmounted', () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderModal();

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('ionKeyboardDidShow', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('ionKeyboardDidHide', expect.any(Function));
  });
});

describe('ModalFrame Enter navigation', () => {
  it('moves through fields and submits from the final single-line input', () => {
    const onSubmit = vi.fn();
    render(
      <ModalFrame isOpen title="Edit values" onSubmit={onSubmit}>
        <input aria-label="First value" />
        <input aria-label="Second value" />
      </ModalFrame>,
    );

    const firstInput = screen.getByRole('textbox', { name: 'First value' });
    const secondInput = screen.getByRole('textbox', { name: 'Second value' });
    firstInput.focus();

    fireEvent.keyDown(firstInput, { key: 'Enter' });
    expect(document.activeElement).toBe(secondInput);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(secondInput, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('moves into a following textarea but preserves Enter for multiline editing', () => {
    const onSubmit = vi.fn();
    render(
      <ModalFrame isOpen title="Edit values" onSubmit={onSubmit}>
        <input aria-label="Title" />
        <textarea aria-label="Notes" />
      </ModalFrame>,
    );

    const titleInput = screen.getByRole('textbox', { name: 'Title' });
    const notesInput = screen.getByRole('textbox', { name: 'Notes' });

    fireEvent.keyDown(titleInput, { key: 'Enter' });
    expect(document.activeElement).toBe(notesInput);

    fireEvent.keyDown(notesInput, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
