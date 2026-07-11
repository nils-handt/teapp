import type { MouseEventHandler, PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionDetailScreen from './SessionDetailScreen';
import type { BrewingSession } from '../entities/BrewingSession.entity';
import { BrewingSession as BrewingSessionEntity } from '../entities/BrewingSession.entity';
import { historyStore, initialHistoryStoreState } from '../stores/useHistoryStore';
import { Tea } from '../entities/Tea.entity';

const goBack = vi.fn();
const selectSession = vi.fn().mockResolvedValue(undefined);
const deleteSession = vi.fn().mockResolvedValue(undefined);
const updateSession = vi.fn().mockResolvedValue(undefined);
const loadKnownTeas = vi.fn().mockResolvedValue(undefined);
const saveTea = vi.fn();
const presentToast = vi.fn();

type SessionDetailStoreSeed = {
    deleteSession: (sessionId: string) => Promise<void>;
    knownTeas: Tea[];
    loadKnownTeas: (force?: boolean) => Promise<void>;
    selectSession: (sessionId: string) => Promise<void>;
    selectedSession: BrewingSession | null;
    updateSession: (session: BrewingSession) => Promise<void>;
    saveTea: (tea: Tea) => Promise<Tea>;
};

type ButtonProps = PropsWithChildren<{
    onClick?: MouseEventHandler<HTMLButtonElement>;
}>;

type AlertProps = {
    header?: string;
    isOpen?: boolean;
};

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
    IonAlert: ({ header, isOpen }: AlertProps) => (
        <div
            data-testid={header === 'Delete Session' ? 'delete-session-alert' : 'session-alert'}
            data-open={isOpen}
        />
    ),
    useIonToast: () => [presentToast],
}));

describe('SessionDetailScreen', () => {
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

    const createSession = (): BrewingSession => {
        const tea = createTea('tea-1', 'Morning Sencha');
        const session = new BrewingSessionEntity();
        session.sessionId = 'session-1';
        session.teaName = tea.name;
        session.teaId = tea.teaId;
        session.tea = tea;
        session.notes = 'Bright and sweet';
        session.startTime = '2026-03-14T10:00:00.000Z';
        session.endTime = '2026-03-14T10:10:00.000Z';
        session.vesselWeight = 95.2;
        session.lidWeight = 14.1;
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
        const ortTea = createTea('tea-2', 'ORT 2015 Gao Jia Shan');
        const senchaTea = createTea('tea-1', 'Morning Sencha');
        saveTea.mockImplementation(async (tea: Tea) => tea);
        historyStore.setState(initialHistoryStoreState);
        historyStore.setState({
            selectedSession: createSession(),
            knownTeas: [ortTea, senchaTea],
            selectSession,
            deleteSession,
            updateSession,
            loadKnownTeas,
            saveTea,
            ...overrides,
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        seedHistoryStore();
    });

    it('uses the shared tea name editor to update the session tea name', async () => {
        render(<SessionDetailScreen />);

        const summaryHeadingClass = screen.getByText('Session Summary').className;
        expect(screen.getByRole('heading', { name: 'Setup' }).className).toBe(summaryHeadingClass);
        expect(screen.getByRole('heading', { name: 'Information' }).className).toBe(summaryHeadingClass);
        expect(screen.getByRole('heading', { name: 'Infusions' }).className).toBe(summaryHeadingClass);

        fireEvent.click(screen.getByRole('button', { name: /Tea nameMorning Sencha/i }));
        expect(loadKnownTeas).toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText('Search existing teas'), { target: { value: 'ort' } });
        fireEvent.click(screen.getByRole('option', { name: 'ORT 2015 Gao Jia Shan' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(saveTea).toHaveBeenCalledWith(expect.objectContaining({ name: 'ORT 2015 Gao Jia Shan' }));
            expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({
                teaId: 'tea-2',
                teaName: 'ORT 2015 Gao Jia Shan',
            }));
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

    it('displays session notes in an infusion-style box before Infusions', () => {
        render(<SessionDetailScreen />);

        const informationHeading = screen.getByRole('heading', { name: 'Information' });
        const infusionsHeading = screen.getByRole('heading', { name: 'Infusions' });
        const informationBox = screen.getByRole('button', { name: 'Notes Bright and sweet' });
        const infusionBox = screen.getByRole('button', { name: /Infusion 1/i });

        expect(informationHeading.compareDocumentPosition(infusionsHeading) & 4).toBe(4);
        expect(informationBox.className).toBe(infusionBox.className);
    });

    it('keeps a non-editable vessel name visually non-interactive', () => {
        render(<SessionDetailScreen />);

        const vesselName = screen.getByText('Vessel name');

        expect(vesselName.parentElement?.tagName).toBe('DIV');
        expect(vesselName.parentElement?.className).toContain('cursor-default');
        expect(vesselName.parentElement?.className).not.toContain('cursor-pointer');
    });

    it('edits session notes by pressing the Information field', async () => {
        render(<SessionDetailScreen />);

        fireEvent.click(screen.getByRole('button', { name: 'Notes Bright and sweet' }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'honey and grass' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({
                notes: 'honey and grass',
            }));
        });
    });

    it('opens the delete confirmation from the bottom action', () => {
        render(<SessionDetailScreen />);

        fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));

        expect(screen.getByTestId('delete-session-alert').getAttribute('data-open')).toBe('true');
    });
});
