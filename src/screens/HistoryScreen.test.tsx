import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HistoryScreen from './HistoryScreen';

const loadHistory = vi.fn();
const loadKnownTeaNames = vi.fn();
const deleteSession = vi.fn();

let mockState: any;

vi.mock('../stores/useStore', () => ({
    useStore: () => mockState,
}));

vi.mock('@ionic/react', () => ({
    IonContent: ({ children }: any) => <div>{children}</div>,
    IonHeader: ({ children }: any) => <div>{children}</div>,
    IonPage: ({ children }: any) => <div>{children}</div>,
    IonTitle: ({ children }: any) => <div>{children}</div>,
    IonToolbar: ({ children }: any) => <div>{children}</div>,
    IonList: ({ children }: any) => <div>{children}</div>,
    IonItem: ({ children }: any) => <div>{children}</div>,
    IonLabel: ({ children }: any) => <div>{children}</div>,
    IonNote: ({ children }: any) => <div>{children}</div>,
    IonRefresher: ({ children }: any) => <div>{children}</div>,
    IonRefresherContent: ({ children }: any) => <div>{children}</div>,
    IonItemSliding: ({ children }: any) => <div>{children}</div>,
    IonItemOptions: ({ children }: any) => <div>{children}</div>,
    IonItemOption: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
    IonIcon: () => null,
    IonSearchbar: ({ value, onIonInput, placeholder }: any) => (
        <input
            aria-label={placeholder}
            value={value}
            onChange={(event) => onIonInput({ detail: { value: event.target.value } })}
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
