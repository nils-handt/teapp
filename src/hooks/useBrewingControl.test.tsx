import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrewingControl } from './useBrewingControl';

const { endSession, discardRecording, startRecording, stopRecording } = vi.hoisted(() => ({
  endSession: vi.fn().mockResolvedValue(undefined),
  discardRecording: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
}));

vi.mock('@ionic/react', () => ({
  IonAlert: () => <div data-testid="ionic-alert" />,
  IonButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

vi.mock('../services/brewing/BrewingSessionService', () => ({
  brewingSessionService: {
    endSession,
    startSession: vi.fn(),
    undoEndSession: vi.fn(),
  },
}));

vi.mock('../services/BluetoothScaleService', () => ({
  bluetoothScaleService: { isMockMode: false },
}));

vi.mock('../stores/useRecordingStore', () => ({
  useRecordingStore: (selector: (state: object) => unknown) => selector({
    isRecording: true,
    startRecording,
    stopRecording,
    discardRecording,
  }),
}));

vi.mock('../stores/useSettingsStore', () => ({
  useSettingsStore: (selector: (state: object) => unknown) => selector({ weightLoggerEnabled: false }),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: unknown) => selector,
}));

const Harness = () => {
  const { handleEndSession, recordingAlert } = useBrewingControl();

  return (
    <>
      <button type="button" onClick={() => void handleEndSession()}>End session</button>
      {recordingAlert}
    </>
  );
};

describe('useBrewingControl recording save dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the shared dialog for saving an active recording', async () => {
    render(<Harness />);

    await act(async () => {
      screen.getByRole('button', { name: 'End session' }).click();
    });

    expect(screen.getByRole('dialog', { name: 'Save Recording' })).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'Session Name' })).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'Notes (optional)' })).not.toBeNull();
  });

  it('saves the recording with the values entered in the shared dialog', async () => {
    render(<Harness />);

    await act(async () => {
      screen.getByRole('button', { name: 'End session' }).click();
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Session Name' }), {
      target: { value: 'Afternoon gongfu' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes (optional)' }), {
      target: { value: 'Sweet and floral' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(stopRecording).toHaveBeenCalledWith('Afternoon gongfu', 'Sweet and floral');
  });

  it('discards the recording when the shared dialog is cancelled', async () => {
    render(<Harness />);

    await act(async () => {
      screen.getByRole('button', { name: 'End session' }).click();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(discardRecording).toHaveBeenCalledTimes(1);
  });
});
