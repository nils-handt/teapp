import type { ChangeEvent, MouseEventHandler, PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsScreen from './SettingsScreen';

const testState = vi.hoisted(() => {
    const setMockMode = vi.fn().mockResolvedValue(undefined);
    const connectNewDevice = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn();

    return {
        bluetoothScaleService: {
            connectNewDevice,
            disconnect,
            isMockMode: false,
            mock: {
                loadRecording: vi.fn(),
                pauseReplay: vi.fn(),
                setPlaybackSpeed: vi.fn(),
                startReplay: vi.fn(),
                stopReplay: vi.fn(),
            },
            setMockMode,
        },
        exportData: vi.fn(),
        importData: vi.fn(),
        push: vi.fn(),
        setMockMode,
        shareFile: vi.fn(),
        store: {
            current: undefined as unknown,
        },
        updateSettings: vi.fn(),
    };
});

type SettingsUpdate = Partial<{
    devMode: boolean;
    lastUsedBrewingScreen: number;
    logLevel: string;
    logToFileEnabled: boolean;
    playbackSpeed: number;
    weightLoggerEnabled: boolean;
}>;

type SettingsScreenStore = {
    connectedDevice: { id: string; name: string } | null;
    connectionStatus: 'connected' | 'connecting' | 'disconnected';
    devMode: boolean;
    lastUsedBrewingScreen: number;
    logLevel: string;
    logToFileEnabled: boolean;
    playbackSpeed: number;
    updateSettings: (settings: SettingsUpdate) => void;
    weightLoggerEnabled: boolean;
};

type ButtonProps = PropsWithChildren<{
    disabled?: boolean;
    onClick?: MouseEventHandler<HTMLButtonElement>;
}>;

type ItemProps = PropsWithChildren<{
    button?: boolean;
    onClick?: MouseEventHandler<HTMLDivElement>;
}>;

type SelectChangeEvent = {
    detail: {
        value: number | string;
    };
};

type SelectProps = PropsWithChildren<{
    onIonChange?: (event: SelectChangeEvent) => void;
    value?: number | string;
}>;

type ToggleChangeEvent = {
    detail: {
        checked: boolean;
    };
};

type ToggleProps = {
    checked?: boolean;
    onClick?: MouseEventHandler<HTMLInputElement>;
    onIonChange?: (event: ToggleChangeEvent) => void;
};

vi.mock('../stores/useStore', () => ({
    useStore: () => testState.store.current,
}));

vi.mock('react-router', () => ({
    useHistory: () => ({ push: testState.push }),
}));

vi.mock('../services/BluetoothScaleService', () => ({
    bluetoothScaleService: testState.bluetoothScaleService,
}));

vi.mock('../services/BackupService', () => ({
    backupService: {
        exportData: testState.exportData,
        importData: testState.importData,
    },
    isBackupData: vi.fn(() => true),
}));

vi.mock('../utils/fileUtils', () => ({
    shareFile: testState.shareFile,
}));

vi.mock('../constants/brewingScreens', () => ({
    BREWING_SCREEN_OPTIONS: [{ id: 1, name: 'Zen' }],
    isBrewingScreenId: (value: number) => value === 1,
}));

vi.mock('../services/logging', () => ({
    LOG_LEVELS: ['debug', 'info', 'warn', 'error'],
    createLogger: () => ({
        error: vi.fn(),
        info: vi.fn(),
    }),
    isLogLevel: (value: string) => ['debug', 'info', 'warn', 'error'].includes(value),
}));

vi.mock('@ionic/react', () => ({
    IonAlert: () => null,
    IonButton: ({ children, disabled, onClick }: ButtonProps) => <button disabled={disabled} onClick={onClick}>{children}</button>,
    IonCard: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonCardContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonItem: ({ button, children, onClick }: ItemProps) => (
        button
            ? <div role="button" tabIndex={0} onClick={onClick}>{children}</div>
            : <div>{children}</div>
    ),
    IonLabel: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonList: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonListHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonPage: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonSelect: ({ children, onIonChange, value }: SelectProps) => (
        <select
            value={value}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => onIonChange?.({ detail: { value: event.target.value } })}
        >
            {children}
        </select>
    ),
    IonSelectOption: ({ children, value }: PropsWithChildren<{ value: number | string }>) => <option value={value}>{children}</option>,
    IonTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonToast: () => null,
    IonToggle: ({ checked = false, onClick, onIonChange }: ToggleProps) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onIonChange?.({ detail: { checked: event.target.checked } })}
            onClick={onClick}
        />
    ),
    IonToolbar: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

const createMockState = (overrides: Partial<Omit<SettingsScreenStore, 'updateSettings'>> = {}): SettingsScreenStore => ({
    connectedDevice: null,
    connectionStatus: 'disconnected',
    devMode: false,
    lastUsedBrewingScreen: 1,
    logLevel: 'info',
    logToFileEnabled: false,
    playbackSpeed: 1,
    updateSettings: (settings) => testState.updateSettings(settings),
    weightLoggerEnabled: false,
    ...overrides,
});

const renderScreen = (
    overrides: Partial<Omit<SettingsScreenStore, 'updateSettings'>> = {},
    options: { isMockMode?: boolean } = {},
) => {
    testState.bluetoothScaleService.isMockMode = options.isMockMode ?? false;
    testState.store.current = createMockState(overrides);
    return render(<SettingsScreen />);
};

describe('SettingsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        testState.bluetoothScaleService.isMockMode = false;
        testState.updateSettings.mockImplementation((settings: SettingsUpdate) => {
            testState.store.current = {
                ...(testState.store.current as SettingsScreenStore),
                ...settings,
            };
        });
    });

    it('toggles dev mode when the row is clicked', () => {
        renderScreen();

        fireEvent.click(screen.getByRole('button', { name: /Dev Mode/i }));

        expect(testState.updateSettings).toHaveBeenCalledWith({ devMode: true });
    });

    it('toggles the nested settings when their rows are clicked', () => {
        renderScreen({ devMode: true });

        fireEvent.click(screen.getByRole('button', { name: /Save Logs To File/i }));
        fireEvent.click(screen.getByRole('button', { name: /Enable Weight Logger/i }));

        expect(testState.updateSettings).toHaveBeenNthCalledWith(1, { logToFileEnabled: true });
        expect(testState.updateSettings).toHaveBeenNthCalledWith(2, { weightLoggerEnabled: true });
    });

    it('toggles mock mode when the row is clicked', async () => {
        renderScreen({ devMode: true }, { isMockMode: false });

        fireEvent.click(screen.getByRole('button', { name: /Use Mock Scale/i }));

        await waitFor(() => {
            expect(testState.setMockMode).toHaveBeenCalledWith(true);
        });
    });

    it('clicking the toggle itself only updates once', () => {
        renderScreen();

        const devModeRow = screen.getByRole('button', { name: /Dev Mode/i });
        fireEvent.click(within(devModeRow).getByRole('checkbox'));

        expect(testState.updateSettings).toHaveBeenCalledTimes(1);
        expect(testState.updateSettings).toHaveBeenCalledWith({ devMode: true });
    });

    it('only shows Manage Recordings when weight logging is enabled', () => {
        const { rerender } = renderScreen({ devMode: true, weightLoggerEnabled: true });

        expect(screen.getByRole('button', { name: /Manage Recordings/i })).not.toBeNull();

        testState.store.current = createMockState({ devMode: true, weightLoggerEnabled: false });
        rerender(<SettingsScreen />);

        expect(screen.queryByRole('button', { name: /Manage Recordings/i })).toBeNull();
    });
});
