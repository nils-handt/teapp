import type { MouseEventHandler, PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionDetailScreen from './SessionDetailScreen';
import type { BrewingSession } from '../entities/BrewingSession.entity';
import { BrewingSession as BrewingSessionEntity } from '../entities/BrewingSession.entity';
import { historyStore, initialHistoryStoreState } from '../stores/useHistoryStore';

const goBack = vi.fn();
const selectSession = vi.fn().mockResolvedValue(undefined);
const deleteSession = vi.fn().mockResolvedValue(undefined);
const updateSession = vi.fn().mockResolvedValue(undefined);
const loadKnownTeaNames = vi.fn().mockResolvedValue(undefined);
const upsertKnownTeaName = vi.fn();
const presentToast = vi.fn();

type SessionDetailStoreSeed = {
    deleteSession: (sessionId: string) => Promise<void>;
    knownTeaNames: string[];
    loadKnownTeaNames: (force?: boolean) => Promise<void>;
    selectSession: (sessionId: string) => Promise<void>;
    selectedSession: BrewingSession | null;
    updateSession: (session: BrewingSession) => Promise<void>;
    upsertKnownTeaName: (teaName: string) => void;
};

type ButtonProps = PropsWithChildren<{
    onClick?: MouseEventHandler<HTMLButtonElement>;
}>;

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
    const createSession = (): BrewingSession => {
        const session = new BrewingSessionEntity();
        session.sessionId = 'session-1';
        session.teaName = 'Morning Sencha';
        session.notes = 'Bright and sweet';
        session.startTime = '2026-03-14T10:00:00.000Z';
        session.endTime = '2026-03-14T10:10:00.000Z';
        session.vesselWeight = 95.2;
        session.lidWeight = 14.1;
        session.trayWeight = 0;
        session.dryTeaLeavesWeight = 6.4;
        session.currentWasteWater = 0;
        session.status = 'completed';
        session.waterTemperature = 0;
        session.brewingVesselId = null;
        session.brewingVessel = null;
        session.infusions = [
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
        ];
        return session;
    };

    const seedHistoryStore = (overrides: Partial<SessionDetailStoreSeed> = {}) => {
        historyStore.setState(initialHistoryStoreState);
        historyStore.setState({
            selectedSession: createSession(),
            knownTeaNames: ['ORT 2015 Gao Jia Shan', 'Morning Sencha'],
            selectSession,
            deleteSession,
            updateSession,
            loadKnownTeaNames,
            upsertKnownTeaName,
            ...overrides,
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        seedHistoryStore();
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
