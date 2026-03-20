import type { ChangeEvent, MouseEventHandler, PropsWithChildren } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HistoryScreen from './HistoryScreen';
import type { BrewingSession } from '../entities/BrewingSession.entity';

const loadHistory = vi.fn();
const loadKnownTeaNames = vi.fn();
const deleteSession = vi.fn();

type HistorySession = Pick<BrewingSession, 'infusions' | 'sessionId' | 'startTime' | 'teaName'>;

type HistoryScreenStore = {
    deleteSession: (sessionId: string) => Promise<void> | void;
    knownTeaNames: string[];
    loadHistory: () => Promise<void> | void;
    loadKnownTeaNames: (force?: boolean) => Promise<void> | void;
    sessionList: HistorySession[];
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

let mockState: HistoryScreenStore;

vi.mock('../stores/useStore', () => ({
    useStore: () => mockState,
}));

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
    beforeEach(() => {
        vi.clearAllMocks();
        mockState = {
            sessionList: [
                {
                    sessionId: '1',
                    teaName: 'ORT 2015 Gao Jia Shan',
                    startTime: '2026-03-14T10:00:00.000Z',
                    infusions: [],
                },
                {
                    sessionId: '2',
                    teaName: 'Morning Sencha',
                    startTime: '2026-03-15T10:00:00.000Z',
                    infusions: [],
                },
            ],
            knownTeaNames: ['ORT 2015 Gao Jia Shan', 'Morning Sencha'],
            loadHistory,
            loadKnownTeaNames,
            deleteSession,
        };
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
