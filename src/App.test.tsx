import { render, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { useStore } from './stores/useStore';

// Mock dependencies
vi.mock('./services/BluetoothScaleService', () => ({
    bluetoothScaleService: {
        initialize: vi.fn(),
    },
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

// Mock Ionic components to avoid issues with web components in JSDOM not being fully supported or needing setup
vi.mock('@ionic/react', async () => {
    const actual = await vi.importActual('@ionic/react');
    return {
        ...actual,
        IonApp: ({ children }: any) => <div>{children}</div>,
        IonRouterOutlet: ({ children }: any) => <div>{children}</div>,
        IonPage: ({ children }: any) => <div>{children}</div>,
        IonContent: ({ children }: any) => <div>{children}</div>,
        IonHeader: ({ children }: any) => <div>{children}</div>,
        IonToolbar: ({ children }: any) => <div>{children}</div>,
        IonTitle: ({ children }: any) => <div>{children}</div>,
        IonList: ({ children }: any) => <div>{children}</div>,
        IonItem: ({ children }: any) => <div>{children}</div>,
        IonLabel: ({ children }: any) => <div>{children}</div>,
        IonSearchbar: ({ children }: any) => <div>{children}</div>,
        IonRefresher: ({ children }: any) => <div>{children}</div>,
        IonRefresherContent: ({ children }: any) => <div>{children}</div>,
        IonItemSliding: ({ children }: any) => <div>{children}</div>,
        IonItemOptions: ({ children }: any) => <div>{children}</div>,
        IonItemOption: ({ children }: any) => <div>{children}</div>,
        IonIcon: ({ children }: any) => <div>{children}</div>,
        IonButtons: ({ children }: any) => <div>{children}</div>,
        IonButton: ({ children }: any) => <div>{children}</div>,
        IonTabs: ({ children }: any) => <div>{children}</div>,
        IonTabBar: ({ children }: any) => <div>{children}</div>,
        IonTabButton: ({ children }: any) => <div>{children}</div>,
        IonBackButton: ({ children }: any) => <div>{children}</div>,
        IonAlert: ({ children }: any) => <div>{children}</div>,
        IonNote: ({ children }: any) => <div>{children}</div>,
        IonListHeader: ({ children }: any) => <div>{children}</div>,
    };
});


describe('App', () => {
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
        const restoreSpy = vi.spyOn(useStore.getState(), 'restoreActiveSession');

        await act(async () => {
            render(<App />);
        });

        expect(restoreSpy).toHaveBeenCalled();
    });
});
