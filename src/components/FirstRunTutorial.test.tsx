import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FirstRunTutorial from './FirstRunTutorial';

const gestureState = vi.hoisted(() => ({
  config: null as null | {
    onEnd?: (detail: { deltaX: number; deltaY: number }) => void;
  },
  destroy: vi.fn(),
  enable: vi.fn(),
}));

vi.mock('@ionic/react', () => ({
  createGesture: vi.fn((config) => {
    gestureState.config = config;
    return {
      destroy: gestureState.destroy,
      enable: gestureState.enable,
    };
  }),
}));

describe('FirstRunTutorial', () => {
  const getCurrentTitle = () => document.getElementById('first-run-tutorial-title')?.textContent;

  beforeEach(() => {
    vi.clearAllMocks();
    gestureState.config = null;
  });

  it('renders the tutorial content and navigates with buttons', () => {
    render(<FirstRunTutorial isOpen={true} onDismiss={vi.fn()} />);

    expect(getCurrentTitle()).toBe('Brew tea with scale-based timing and tracking');
    expect(screen.getByText(/First connect a Bluetooth scale in the Brewing tab/)).toBeDefined();
    expect(screen.getByText('Build your setup on the scale').getAttribute('style')).toContain('color: rgb(150, 160, 148)');
    expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(getCurrentTitle()).toBe('Build your setup on the scale');
  });

  it('shows Done instead of Next on the last page', () => {
    render(<FirstRunTutorial isOpen={true} onDismiss={vi.fn()} />);

    for (let step = 0; step < 3; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }

    expect(getCurrentTitle()).toBe('Known limitations');
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeDefined();
  });

  it('dismisses on Skip and Done', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<FirstRunTutorial isOpen={true} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(<FirstRunTutorial isOpen={false} onDismiss={onDismiss} />);
    rerender(<FirstRunTutorial isOpen={true} onDismiss={onDismiss} />);

    for (let step = 0; step < 3; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('advances on a horizontal swipe and ignores vertical drags', () => {
    render(<FirstRunTutorial isOpen={true} onDismiss={vi.fn()} />);

    act(() => {
      gestureState.config?.onEnd?.({ deltaX: -120, deltaY: 16 });
    });
    expect(getCurrentTitle()).toBe('Build your setup on the scale');

    act(() => {
      gestureState.config?.onEnd?.({ deltaX: -140, deltaY: 160 });
    });
    expect(getCurrentTitle()).toBe('Build your setup on the scale');
  });

  it('stays within bounds when swiping beyond the first or last page', () => {
    render(<FirstRunTutorial isOpen={true} onDismiss={vi.fn()} />);

    act(() => {
      gestureState.config?.onEnd?.({ deltaX: 120, deltaY: 10 });
    });
    expect(getCurrentTitle()).toBe('Brew tea with scale-based timing and tracking');

    for (let step = 0; step < 4; step += 1) {
      act(() => {
        gestureState.config?.onEnd?.({ deltaX: -120, deltaY: 10 });
      });
    }

    expect(getCurrentTitle()).toBe('Known limitations');

    act(() => {
      gestureState.config?.onEnd?.({ deltaX: -120, deltaY: 10 });
    });
    expect(getCurrentTitle()).toBe('Known limitations');
  });
});
