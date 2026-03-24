import type { PropsWithChildren } from 'react';
import { render, act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { brewingStore, initialBrewingStoreState } from './stores/useBrewingStore';
import { initialSettingsStoreValues, settingsStore } from './stores/useSettingsStore';

const tutorialRenderState = vi.hoisted(() => ({
    render: vi.fn(),
}));

// Mock dependencies
vi.mock('./services/BluetoothScaleService', () => ({
    bluetoothScaleService: {
        initialize: vi.fn(),
    },
}));

vi.mock('./hooks/useBrewingSync', () => ({
    useBrewingSync: vi.fn(),
}));

vi.mock('./repositories/SettingsRepository', () => ({
    settingsRepository: {
        getAllSettings: vi.fn().mockResolvedValue({}),
    },
}));

vi.mock('./repositories/SessionRepository', () => ({
    sessionRepository: {
        getAllSessions: vi.fn().mockResolvedValue([]),
        getActiveSession: vi.fn().mockResolvedValue(null),
    }
}));

vi.mock('./components/FirstRunTutorial', () => ({
    default: ({ isOpen }: { isOpen: boolean }) => {
        tutorialRenderState.render(isOpen);
        return isOpen ? <div>First Run Tutorial Open</div> : null;
    },
}));

// Mock Ionic components to avoid issues with web components in JSDOM not being fully supported or needing setup
vi.mock('@ionic/react', async () => {
    const actual = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
    const Wrap = ({ children }: PropsWithChildren) => <div>{children}</div>;

    return {
        ...actual,
        IonApp: Wrap,
        IonRouterOutlet: Wrap,
        IonPage: Wrap,
        IonContent: Wrap,
        IonHeader: Wrap,
        IonToolbar: Wrap,
        IonTitle: Wrap,
        IonList: Wrap,
        IonItem: Wrap,
        IonLabel: Wrap,
        IonSearchbar: Wrap,
        IonRefresher: Wrap,
        IonRefresherContent: Wrap,
        IonItemSliding: Wrap,
        IonItemOptions: Wrap,
        IonItemOption: Wrap,
        IonIcon: Wrap,
        IonButtons: Wrap,
        IonButton: Wrap,
        IonTabs: Wrap,
        IonTabBar: Wrap,
        IonTabButton: Wrap,
        IonBackButton: Wrap,
        IonAlert: Wrap,
        IonNote: Wrap,
        IonListHeader: Wrap,
    };
});


describe('App', () => {
    beforeEach(() => {
        settingsStore.setState(initialSettingsStoreValues);
        brewingStore.setState(initialBrewingStoreState);
        tutorialRenderState.render.mockClear();
    });

    it('renders without crashing', async () => {
        let baseElement: HTMLElement | null = null;
        await act(async () => {
            const result = render(
                <App />
            );
            baseElement = result.baseElement;
        });
        expect(baseElement).toBeDefined();
    });

    it('triggers active session recovery on mount', async () => {
        const restoreSpy = vi.spyOn(brewingStore.getState(), 'restoreActiveSession');
        const loadSettingsSpy = vi.spyOn(settingsStore.getState(), 'loadSettings');

        await act(async () => {
            render(<App />);
        });

        expect(restoreSpy).toHaveBeenCalled();
        expect(loadSettingsSpy).toHaveBeenCalled();
    });

    it('opens the tutorial after settings finish loading for first-time users', async () => {
        await act(async () => {
            render(<App />);
        });

        await waitFor(() => {
            expect(screen.getByText('First Run Tutorial Open')).toBeDefined();
        });
        expect(settingsStore.getState().isTutorialOpen).toBe(true);
    });

    it('keeps the tutorial closed when it has already been seen', async () => {
        const loadSettingsSpy = vi.spyOn(settingsStore.getState(), 'loadSettings');
        loadSettingsSpy.mockImplementation(async () => {
            settingsStore.setState({ hasSeenTutorial: true, settingsLoaded: true });
        });

        await act(async () => {
            render(<App />);
        });

        await waitFor(() => {
            expect(loadSettingsSpy).toHaveBeenCalled();
        });
        expect(screen.queryByText('First Run Tutorial Open')).toBeNull();
        expect(settingsStore.getState().isTutorialOpen).toBe(false);
    });
});
