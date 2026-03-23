import type { ChangeEvent, MouseEventHandler, PropsWithChildren } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HistoryScreen from './HistoryScreen';
import type { BrewingSession } from '../entities/BrewingSession.entity';
import { BrewingSession as BrewingSessionEntity } from '../entities/BrewingSession.entity';
import { historyStore, initialHistoryStoreState } from '../stores/useHistoryStore';

const loadHistory = vi.fn().mockResolvedValue(undefined);
const loadKnownTeaNames = vi.fn().mockResolvedValue(undefined);
const deleteSession = vi.fn().mockResolvedValue(undefined);

type HistoryScreenStoreSeed = {
    deleteSession: (sessionId: string) => Promise<void>;
    knownTeaNames: string[];
    loadHistory: () => Promise<void>;
    loadKnownTeaNames: (force?: boolean) => Promise<void>;
    sessionList: BrewingSession[];
};

type ButtonProps = PropsWithChildren<{
    onClick?: MouseEventHandler<HTMLButtonElement>;
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

vi.mock('@ionic/react', () => ({
    IonContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonPage: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonToolbar: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonList: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonItem: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonLabel: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonNote: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonRefresher: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonRefresherContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonItemSliding: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonItemOptions: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonItemOption: ({ children, onClick }: ButtonProps) => <button onClick={onClick}>{children}</button>,
    IonIcon: () => null,
    IonSearchbar: ({ value, onIonInput, placeholder }: SearchbarProps) => (
        <input
            aria-label={placeholder}
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onIonInput?.({ detail: { value: event.target.value } })}
        />
    ),
    useIonViewWillEnter: (callback: () => void) => callback(),
}));

describe('HistoryScreen', () => {
    const createSession = (sessionId: string, teaName: string, startTime: string): BrewingSession => {
        const session = new BrewingSessionEntity();
        session.sessionId = sessionId;
        session.teaName = teaName;
        session.startTime = startTime;
        session.endTime = '';
        session.vesselWeight = 0;
        session.lidWeight = 0;
        session.trayWeight = 0;
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
        historyStore.setState(initialHistoryStoreState);
        historyStore.setState({
            sessionList: [
                createSession('1', 'ORT 2015 Gao Jia Shan', '2026-03-14T10:00:00.000Z'),
                createSession('2', 'Morning Sencha', '2026-03-15T10:00:00.000Z'),
            ],
            knownTeaNames: ['ORT 2015 Gao Jia Shan', 'Morning Sencha'],
            loadHistory,
            loadKnownTeaNames,
            deleteSession,
            ...overrides,
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        seedHistoryStore();
    });

    it('loads history and cached tea names on enter', () => {
        render(<HistoryScreen />);

        expect(loadHistory).toHaveBeenCalled();
        expect(loadKnownTeaNames).toHaveBeenCalled();
    });

    it('filters sessions using fuzzy tea name matches', () => {
        render(<HistoryScreen />);

        fireEvent.change(screen.getByLabelText('Search by tea name'), { target: { value: 'gao shan' } });

        expect(screen.getAllByText('ORT 2015 Gao Jia Shan')).toHaveLength(2);
        expect(screen.queryByText('Morning Sencha')).toBeNull();
    });

    it('lets users apply a suggestion to the search field', () => {
        render(<HistoryScreen />);

        fireEvent.change(screen.getByLabelText('Search by tea name'), { target: { value: 'ort' } });
        fireEvent.click(screen.getByRole('button', { name: 'ORT 2015 Gao Jia Shan' }));

        expect((screen.getByLabelText('Search by tea name') as HTMLInputElement).value).toBe('ORT 2015 Gao Jia Shan');
    });
});
