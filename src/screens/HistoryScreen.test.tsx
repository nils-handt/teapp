import type { ChangeEvent, MouseEventHandler, PropsWithChildren } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HistoryScreen from './HistoryScreen';
import type { BrewingSession } from '../entities/BrewingSession.entity';
import { BrewingSession as BrewingSessionEntity } from '../entities/BrewingSession.entity';
import { historyStore, initialHistoryStoreState } from '../stores/useHistoryStore';
import { historyFiltersStore, initialHistoryFiltersState } from '../stores/useHistoryFiltersStore';
import { Tea } from '../entities/Tea.entity';

const refresherMocks = vi.hoisted(() => ({
    onIonRefresh: undefined as ((event: CustomEvent) => Promise<void>) | undefined,
}));

const loadHistory = vi.fn().mockResolvedValue(undefined);
const loadKnownTeas = vi.fn().mockResolvedValue(undefined);
const deleteSession = vi.fn().mockResolvedValue(undefined);
const restoreSession = vi.fn().mockResolvedValue(undefined);
const presentToast = vi.fn();

type HistoryScreenStoreSeed = {
    deleteSession: (sessionId: string) => Promise<void>;
    restoreSession: (session: BrewingSession) => Promise<void>;
    knownTeas: Tea[];
    loadHistory: () => Promise<void>;
    loadKnownTeas: (force?: boolean) => Promise<void>;
    sessionList: BrewingSession[];
};

type ButtonProps = PropsWithChildren<{
    onClick?: MouseEventHandler<HTMLButtonElement>;
}>;

type DivProps = PropsWithChildren<{
    className?: string;
    'data-testid'?: string;
    onClick?: MouseEventHandler<HTMLDivElement>;
}>;

type SearchbarInputEvent = {
    detail: {
        value?: string;
    };
};

type SearchbarProps = {
    onIonInput?: (event: SearchbarInputEvent) => void;
    placeholder?: string;
    value?: string;
};

type RefresherProps = PropsWithChildren<{
    onIonRefresh?: (event: CustomEvent) => Promise<void>;
}>;

type ToastOptions = {
    buttons: Array<{ handler: () => void; text: string }>;
    duration: number;
    message: string;
};

vi.mock('@ionic/react', () => ({
    IonContent: ({ children, className, 'data-testid': testId }: DivProps) => <div className={className} data-testid={testId}>{children}</div>,
    IonHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonPage: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonToolbar: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonList: ({ children, className, onClick }: DivProps) => <div className={className} data-testid="history-list" onClick={onClick}>{children}</div>,
    IonItem: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonLabel: ({ children, className }: DivProps) => <div className={className}>{children}</div>,
    IonNote: ({ children, className }: DivProps) => <div className={className}>{children}</div>,
    IonRefresher: ({ children, onIonRefresh }: RefresherProps) => {
        refresherMocks.onIonRefresh = onIonRefresh;
        return <div data-testid="history-refresher">{children}</div>;
    },
    IonRefresherContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonItemSliding: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonItemOptions: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonItemOption: ({ children, onClick }: ButtonProps) => <button aria-label="Delete session" onClick={onClick}>{children}</button>,
    IonIcon: () => null,
    IonSearchbar: ({ value, onIonInput, placeholder }: SearchbarProps) => (
        <input
            aria-label={placeholder}
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onIonInput?.({ detail: { value: event.target.value } })}
        />
    ),
    useIonToast: () => [presentToast],
    useIonViewWillEnter: (callback: () => void) => callback(),
}));

describe('HistoryScreen', () => {
    const createTea = (teaId: string, name: string): Tea => Object.assign(new Tea(), {
        teaId,
        name,
        brand: null,
        type: null,
        subtype: null,
        region: null,
        subregion: null,
        year: null,
        season: null,
        sessions: [],
    });

    const createSession = (sessionId: string, tea: Tea, startTime: string): BrewingSession => {
        const session = new BrewingSessionEntity();
        session.sessionId = sessionId;
        session.teaName = tea.name;
        session.teaId = tea.teaId;
        session.tea = tea;
        session.startTime = startTime;
        session.endTime = '';
        session.vesselWeight = 0;
        session.lidWeight = 0;
        session.dryTeaLeavesWeight = 0;
        session.currentWasteWater = 0;
        session.notes = '';
        session.status = 'completed';
        session.waterTemperature = 0;
        session.brewingVesselId = null;
        session.brewingVessel = null;
        session.infusions = [];
        return session;
    };

    const seedHistoryStore = (overrides: Partial<HistoryScreenStoreSeed> = {}) => {
        const ortTea = createTea('tea-1', 'ORT 2015 Gao Jia Shan');
        const senchaTea = createTea('tea-2', 'Morning Sencha');

        historyStore.setState(initialHistoryStoreState);
        historyStore.setState({
            sessionList: [
                createSession('1', ortTea, '2026-03-14T10:00:00.000Z'),
                createSession('2', senchaTea, '2026-03-15T10:00:00.000Z'),
            ],
            knownTeas: [ortTea, senchaTea],
            loadHistory,
            loadKnownTeas,
            deleteSession,
            restoreSession,
            ...overrides,
        });
    };

    beforeEach(() => {
        historyFiltersStore.setState(initialHistoryFiltersState);
        vi.clearAllMocks();
        seedHistoryStore();
    });

    it('loads history and cached tea names on enter', () => {
        render(<HistoryScreen />);

        expect(loadHistory).toHaveBeenCalled();
        expect(loadKnownTeas).toHaveBeenCalled();
    });

    it('keeps shared Tea filters when history refreshes', async () => {
        render(<HistoryScreen />);
        fireEvent.change(screen.getByLabelText('Search teas'), { target: { value: 'sencha' } });
        fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));
        fireEvent.change(screen.getByLabelText('Filter Brand'), { target: { value: 'Ippodo' } });

        const complete = vi.fn();
        await act(async () => {
            await refresherMocks.onIonRefresh?.({ detail: { complete } } as CustomEvent);
        });

        expect(historyFiltersStore.getState()).toMatchObject({
            searchText: 'sencha',
            filters: expect.objectContaining({ brand: 'Ippodo' }),
        });
        expect(complete).toHaveBeenCalled();
    });

    it('uses the shared Zen list treatment without changing the session structure', () => {
        render(<HistoryScreen />);

        expect(screen.getByTestId('history-page').classList.contains('zen-list-page')).toBe(true);
        expect(screen.getByTestId('history-list').classList.contains('zen-list-surface')).toBe(true);
        expect(screen.getByText('Morning Sencha').classList.contains('text-zen-text')).toBe(true);
    });

    it('labels sessions without tea in muted text', () => {
        const unnamedSession = createSession('unnamed', createTea('tea-3', 'Placeholder Tea'), '2026-03-16T10:00:00.000Z');
        unnamedSession.tea = null;
        unnamedSession.teaId = null;
        unnamedSession.teaName = '  ';
        seedHistoryStore({ sessionList: [unnamedSession] });

        render(<HistoryScreen />);

        const sessionTitle = screen.getByRole('heading', { name: 'No tea selected' });

        expect(sessionTitle.className).toContain('text-zen-muted');
    });

    it('offers Undo after deleting a session from the history list', async () => {
        render(<HistoryScreen />);

        fireEvent.click(screen.getAllByRole('button', { name: 'Delete session' })[0]);

        await waitFor(() => {
            expect(deleteSession).toHaveBeenCalledWith('1');
            expect(presentToast).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Session deleted',
                duration: 5000,
            }));
        });

        const toastOptions = presentToast.mock.calls[0][0] as ToastOptions;
        toastOptions.buttons[0].handler();

        expect(restoreSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: '1' }));
    });

    it('filters sessions using fuzzy tea name matches', () => {
        render(<HistoryScreen />);

        fireEvent.change(screen.getByLabelText('Search teas'), { target: { value: 'gao shan' } });

        expect(screen.getAllByText('ORT 2015 Gao Jia Shan')).toHaveLength(2);
        expect(screen.queryByText('Morning Sencha')).toBeNull();
    });

    it('lets users apply a suggestion to the search field', () => {
        render(<HistoryScreen />);

        fireEvent.change(screen.getByLabelText('Search teas'), { target: { value: 'ort' } });
        fireEvent.click(screen.getByRole('button', { name: 'ORT 2015 Gao Jia Shan' }));

        expect((screen.getByLabelText('Search teas') as HTMLInputElement).value).toBe('ORT 2015 Gao Jia Shan');
    });

    it('expands filters only from the explicit Filters control', () => {
        render(<HistoryScreen />);

        expect(screen.queryByLabelText('Filter Name')).toBeNull();
        expect(screen.getByRole('button', { name: 'Show history filters' }).getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(screen.getByLabelText('Search teas'));

        expect(screen.queryByLabelText('Filter Name')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));

        expect(screen.getByLabelText('Filter Name')).toBeDefined();
        expect(screen.getByRole('button', { name: 'Hide history filters' }).getAttribute('aria-expanded')).toBe('true');

        fireEvent.click(screen.getByRole('button', { name: 'Hide history filters' }));

        expect(screen.queryByLabelText('Filter Name')).toBeNull();
    });

    it('keeps expanded filters visible when the history list is clicked', () => {
        render(<HistoryScreen />);

        fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));
        expect(screen.getByLabelText('Filter Year')).toBeDefined();

        fireEvent.click(screen.getByTestId('history-list'));

        expect(screen.getByLabelText('Filter Year')).toBeDefined();
    });

    it('shows active filter state and can clear all filters', () => {
        render(<HistoryScreen />);

        fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));
        fireEvent.change(screen.getByLabelText('Filter Name'), { target: { value: 'sencha' } });

        expect(screen.getByRole('button', { name: 'Hide history filters (1 active)' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: 'Hide history filters (1 active)' }));

        expect(screen.getByRole('button', { name: 'Show history filters (1 active)' })).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

        expect(screen.getByRole('button', { name: 'Show history filters' })).toBeDefined();
        expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    });

    it('does not expand filters when a fuzzy tea suggestion is selected', () => {
        render(<HistoryScreen />);

        fireEvent.change(screen.getByLabelText('Search teas'), { target: { value: 'ort' } });
        fireEvent.click(screen.getByRole('button', { name: 'ORT 2015 Gao Jia Shan' }));

        expect(screen.queryByLabelText('Filter Name')).toBeNull();
    });
});
