import type { MouseEventHandler, PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionDetailScreen from './SessionDetailScreen';
import type { BrewingSession } from '../entities/BrewingSession.entity';

const goBack = vi.fn();
const selectSession = vi.fn();
const deleteSession = vi.fn();
const updateSession = vi.fn().mockResolvedValue(undefined);
const loadKnownTeaNames = vi.fn();
const upsertKnownTeaName = vi.fn();
const presentToast = vi.fn();

type SessionDetailStore = {
    deleteSession: (sessionId: string) => Promise<void> | void;
    knownTeaNames: string[];
    loadKnownTeaNames: () => Promise<void> | void;
    selectSession: (sessionId: string) => Promise<void> | void;
    selectedSession: Pick<
        BrewingSession,
        | 'brewingVessel'
        | 'dryTeaLeavesWeight'
        | 'endTime'
        | 'infusions'
        | 'lidWeight'
        | 'notes'
        | 'sessionId'
        | 'startTime'
        | 'teaName'
        | 'trayWeight'
        | 'vesselWeight'
    > | null;
    updateSession: (session: BrewingSession) => Promise<void> | void;
    upsertKnownTeaName: (teaName: string) => void;
};

type ButtonProps = PropsWithChildren<{
    onClick?: MouseEventHandler<HTMLButtonElement>;
}>;

let mockState: SessionDetailStore;

vi.mock('../stores/useStore', () => ({
    useStore: () => mockState,
}));

vi.mock('react-router-dom', () => ({
    useHistory: () => ({ goBack }),
    useParams: () => ({ sessionId: 'session-1' }),
}));

vi.mock('@ionic/react', () => ({
    IonContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonPage: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonToolbar: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonButtons: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonBackButton: () => null,
    IonButton: ({ children, onClick }: ButtonProps) => <button onClick={onClick}>{children}</button>,
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
                infusions: [
                    {
                        infusionId: 'inf-1',
                        infusionNumber: 1,
                        startTime: '2026-03-14T10:01:00.000Z',
                        duration: 25,
                        restDuration: 30,
                        waterWeight: 100,
                        wetTeaLeavesWeight: 18,
                        note: 'bright',
                        temperature: 185,
                        sessionId: 'session-1',
                        session: undefined as never,
                    },
                ],
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

    it('edits an infusion note by pressing the infusion box', async () => {
        render(<SessionDetailScreen />);

        expect(screen.getByText('Temp 185°')).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: /Infusion 1/i }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'honey finish' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({
                infusions: [expect.objectContaining({ infusionId: 'inf-1', note: 'honey finish' })],
            }));
        });
    });
});
