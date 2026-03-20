import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionDetailScreen from './SessionDetailScreen';

const goBack = vi.fn();
const selectSession = vi.fn();
const deleteSession = vi.fn();
const updateSession = vi.fn().mockResolvedValue(undefined);
const loadKnownTeaNames = vi.fn();
const upsertKnownTeaName = vi.fn();
const presentToast = vi.fn();

let mockState: any;

vi.mock('../stores/useStore', () => ({
    useStore: () => mockState,
}));

vi.mock('react-router-dom', () => ({
    useHistory: () => ({ goBack }),
    useParams: () => ({ sessionId: 'session-1' }),
}));

vi.mock('@ionic/react', () => ({
    IonContent: ({ children }: any) => <div>{children}</div>,
    IonHeader: ({ children }: any) => <div>{children}</div>,
    IonPage: ({ children }: any) => <div>{children}</div>,
    IonTitle: ({ children }: any) => <div>{children}</div>,
    IonToolbar: ({ children }: any) => <div>{children}</div>,
    IonButtons: ({ children }: any) => <div>{children}</div>,
    IonBackButton: () => null,
    IonButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
    IonIcon: () => null,
    IonAlert: () => null,
    useIonToast: () => [presentToast],
}));

describe('SessionDetailScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockState = {
            selectedSession: {
                sessionId: 'session-1',
                teaName: 'Morning Sencha',
                notes: 'Bright and sweet',
                startTime: '2026-03-14T10:00:00.000Z',
                endTime: '2026-03-14T10:10:00.000Z',
                vesselWeight: 95.2,
                lidWeight: 14.1,
                trayWeight: 0,
                dryTeaLeavesWeight: 6.4,
                brewingVessel: null,
                infusions: [],
            },
            knownTeaNames: ['ORT 2015 Gao Jia Shan', 'Morning Sencha'],
            selectSession,
            deleteSession,
            updateSession,
            loadKnownTeaNames,
            upsertKnownTeaName,
        };
    });

    it('uses the shared tea name editor to update the session tea name', async () => {
        render(<SessionDetailScreen />);

        fireEvent.click(screen.getByRole('button', { name: /Tea nameMorning Sencha/i }));
        expect(loadKnownTeaNames).toHaveBeenCalled();

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ort' } });
        fireEvent.click(screen.getByRole('button', { name: 'ORT 2015 Gao Jia Shan' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({ teaName: 'ORT 2015 Gao Jia Shan' }));
            expect(upsertKnownTeaName).toHaveBeenCalledWith('ORT 2015 Gao Jia Shan');
        });
    });
});
