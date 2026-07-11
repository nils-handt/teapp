import type { MouseEventHandler, PropsWithChildren } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import BrewingZen from './BrewingZen';
import { BrewingPhase, type EditableInfusionMetadata } from '../../services/interfaces/brewing.types';
import type { BrewingSession } from '../../entities/BrewingSession.entity';
import { Tea } from '../../entities/Tea.entity';
import { brewingStore, initialBrewingStoreState } from '../../stores/useBrewingStore';
import { historyStore, initialHistoryStoreState } from '../../stores/useHistoryStore';
import { initialScaleStoreState, scaleStore } from '../../stores/useScaleStore';

const gestureState = vi.hoisted(() => ({
    config: null as null | {
        onEnd?: (detail: { deltaX: number; deltaY: number }) => void;
    },
    destroy: vi.fn(),
    enable: vi.fn(),
}));

const {
    connectNewDevice,
    startBrewingSession,
    handleEndSession,
    confirmSetupDone,
    manuallyStartInfusion,
    manuallyStopInfusion,
    updateTeaName,
    updateBrewingVesselName,
    updateSetupValue,
    updateEditableInfusionNote,
    updateEditableInfusionTemperature,
    updateSavedInfusionNote,
    updateSessionNotes,
    clearSession,
    loadKnownTeas,
    saveTea,
    deleteSession,
} = vi.hoisted(() => ({
    connectNewDevice: vi.fn(),
    startBrewingSession: vi.fn(),
    handleEndSession: vi.fn(),
    confirmSetupDone: vi.fn(),
    manuallyStartInfusion: vi.fn(),
    manuallyStopInfusion: vi.fn(),
    updateTeaName: vi.fn(),
    updateBrewingVesselName: vi.fn(),
    updateSetupValue: vi.fn(),
    updateEditableInfusionNote: vi.fn(),
    updateEditableInfusionTemperature: vi.fn(),
    updateSavedInfusionNote: vi.fn(),
    updateSessionNotes: vi.fn(),
    clearSession: vi.fn(),
    loadKnownTeas: vi.fn().mockResolvedValue(undefined),
    saveTea: vi.fn(),
    deleteSession: vi.fn().mockResolvedValue(undefined),
}));

type BrewingZenBrewingSeed = {
    activeSession: BrewingSession | null;
    brewingPhase: BrewingPhase;
    currentInfusion: BrewingSession['infusions'][number] | null;
    editableInfusionMetadata: EditableInfusionMetadata;
    timerValue: number;
};

type BrewingZenScaleSeed = {
    connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'scanning';
    currentWeight: number;
    isMockMode: boolean;
};

type BrewingZenHistorySeed = {
    deleteSession: (sessionId: string) => Promise<void>;
    knownTeas: Tea[];
    loadKnownTeas: (force?: boolean) => Promise<void>;
    saveTea: (tea: Tea) => Promise<Tea>;
};

type ButtonProps = PropsWithChildren<{
    disabled?: boolean;
    onClick?: MouseEventHandler<HTMLButtonElement>;
}>;

type ContentProps = PropsWithChildren<{
    scrollY?: boolean;
}>;

type AlertProps = {
    buttons?: Array<{ handler?: () => void | Promise<void>; text: string }>;
    header?: string;
    isOpen?: boolean;
};
vi.mock('../../hooks/useBrewingControl', () => ({
    useBrewingControl: () => ({
        startBrewingSession,
        handleEndSession,
        recordingAlert: null,
    }),
}));

vi.mock('../../services/BluetoothScaleService', () => ({
    bluetoothScaleService: {
        connectNewDevice,
    },
}));

vi.mock('../../services/brewing/BrewingSessionService', () => ({
    brewingSessionService: {
        confirmSetupDone,
        manuallyStartInfusion,
        manuallyStopInfusion,
        updateTeaName,
        updateBrewingVesselName,
        updateSetupValue,
        updateEditableInfusionNote,
        updateEditableInfusionTemperature,
        updateSavedInfusionNote,
        updateSessionNotes,
        clearSession,
        updateTea: vi.fn(),
    },
}));

vi.mock('@ionic/react', () => ({
    createGesture: vi.fn((config) => {
        gestureState.config = config;
        return {
            destroy: gestureState.destroy,
            enable: gestureState.enable,
        };
    }),
    IonAlert: ({ buttons, header, isOpen }: AlertProps) => header === 'Delete Session' ? (
        <div data-testid="delete-session-alert" data-open={isOpen}>
            {isOpen && buttons?.map((button) => (
                <button key={button.text} onClick={() => button.handler?.()}>{button.text}</button>
            ))}
        </div>
    ) : null,
    IonButton: ({ children, onClick, disabled }: ButtonProps) => <button onClick={onClick} disabled={disabled}>{children}</button>,
    IonContent: ({ children, scrollY }: ContentProps) => (
        <div data-testid="brewing-content" data-scroll-y={scrollY}>{children}</div>
    ),
    IonHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonPage: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonToolbar: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

describe('BrewingZen', () => {
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

    const createInfusion = (overrides: Partial<BrewingSession['infusions'][number]> = {}) => ({
        infusionId: 'inf-1',
        infusionNumber: 1,
        duration: 25,
        waterWeight: 100.5,
        startTime: '2026-03-14T10:01:00.000Z',
        wetTeaLeavesWeight: 18.2,
        restDuration: 35,
        note: '',
        temperature: null,
        sessionId: 'session-1',
        session: undefined as never,
        ...overrides,
    });

    const seedStores = (
        brewingOverrides: Partial<BrewingZenBrewingSeed> = {},
        scaleOverrides: Partial<BrewingZenScaleSeed> = {},
        historyOverrides: Partial<BrewingZenHistorySeed> = {},
    ) => {
        brewingStore.setState(initialBrewingStoreState);
        scaleStore.setState(initialScaleStoreState);
        historyStore.setState(initialHistoryStoreState);
        saveTea.mockImplementation(async (tea: Tea) => tea);

        brewingStore.setState({
            activeSession: {
                sessionId: 'session-1',
                teaName: '',
                teaId: null,
                tea: null,
                brewingVessel: null,
                vesselWeight: 95.2,
                lidWeight: 14.1,
                dryTeaLeavesWeight: 6.4,
                currentWasteWater: 0,
                notes: '',
                status: 'active',
                waterTemperature: 0,
                brewingVesselId: null,
                startTime: '2026-03-14T10:00:00.000Z',
                endTime: '2026-03-14T10:10:00.000Z',
                infusions: [
                    createInfusion(),
                ],
            },
            brewingPhase: BrewingPhase.SETUP,
            currentInfusion: null,
            editableInfusionMetadata: {
                infusionId: null,
                note: '',
                temperature: null,
                source: 'none',
            },
            timerValue: 92000,
            ...brewingOverrides,
        });
        scaleStore.setState({
            connectionStatus: 'connected',
            currentWeight: 63.5,
            ...scaleOverrides,
        });
        historyStore.setState({
            knownTeas: [createTea('tea-1', 'ORT 2015 Gao Jia Shan'), createTea('tea-2', 'Morning Sencha')],
            loadKnownTeas,
            saveTea,
            deleteSession,
            ...historyOverrides,
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        gestureState.config = null;
        seedStores();
    });

    it('shows only the connect action when the scale is disconnected', () => {
        scaleStore.setState({ connectionStatus: 'disconnected' });

        render(<BrewingZen />);

        expect(screen.getByRole('button', { name: /connect to scale/i }).className).toContain('zen-hero-button');
        expect(screen.queryByText('End Session')).toBeNull();
        expect(screen.getByTestId('brewing-content').getAttribute('data-scroll-y')).toBe('false');
        expect(screen.getByRole('button', { name: /connect to scale/i }).parentElement?.className)
            .toContain('flex-1 justify-center');
    });

    it('keeps the idle start action aligned with the connect state', () => {
        brewingStore.setState({ brewingPhase: BrewingPhase.IDLE });

        render(<BrewingZen />);

        expect(screen.getByRole('button', { name: /start session/i }).parentElement?.className)
            .toContain('flex-1 justify-center');
    });

    it('renders the setup phase with live weight and editable fields', () => {
        render(<BrewingZen />);

        expect(screen.getByText('63.5 g')).toBeDefined();
        expect(screen.getByRole('button', { name: /^Vessel95\.2 g$/i }).className).toContain('zen-field-button');
        expect(screen.getByRole('button', { name: /Lid/i })).toBeDefined();
        expect(screen.queryByRole('button', { name: /Tray/i })).toBeNull();
        expect(screen.getByRole('button', { name: /Tea6.4 g/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Teano tea selected/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /vessel name/i })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Confirm Setup' })).toBeDefined();
    });

    it('keeps setup actions in an equal two-button row', () => {
        render(<BrewingZen />);

        const actionRow = screen.getByRole('button', { name: 'End Session' }).parentElement;

        expect(actionRow?.className).toContain('grid-cols-2');
        expect(actionRow?.className).toContain('[&>ion-button]:min-h-11');
    });

    it('shows the tea placeholder in ready when no tea name exists and hides live weight', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.READY,
            activeSession: {
                ...brewingStore.getState().activeSession!,
                infusions: [],
            },
            editableInfusionMetadata: {
                infusionId: null,
                note: '',
                temperature: null,
                source: 'draft',
            },
        });

        render(<BrewingZen />);

        expect(screen.getByRole('button', { name: /Teano tea selected/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /vessel nameno vessel selected/i })).toBeDefined();
        expect(screen.queryByText('63.5 g')).toBeNull();
        expect(screen.queryByTestId('infusion-history-strip')).toBeNull();
    });

    it('hides the tea field in ready when a tea name has been selected', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.READY,
            activeSession: {
                ...brewingStore.getState().activeSession!,
                teaName: 'Morning Sencha',
            },
            editableInfusionMetadata: {
                infusionId: null,
                note: '',
                temperature: null,
                source: 'draft',
            },
        });

        render(<BrewingZen />);

        expect(screen.queryByRole('button', { name: /Teaname/i })).toBeNull();
        expect(screen.queryByText('Morning Sencha')).toBeNull();
    });

    it('greys out the timer during rest', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.REST,
            currentInfusion: createInfusion(),
            editableInfusionMetadata: {
                infusionId: 'inf-1',
                note: '',
                temperature: 180,
                source: 'resting',
            },
        });

        render(<BrewingZen />);

        const timer = screen.getByText('1:32');
        expect(timer.getAttribute('data-tone')).toBe('resting');
        expect(timer.classList.contains('text-zen-rest')).toBe(true);
        expect(timer.classList.contains('text-zen-text')).toBe(false);
    });

    it('shows the latest completed infusion in active phases and removes duplicate timer labels', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.READY,
            editableInfusionMetadata: {
                infusionId: null,
                note: '',
                temperature: null,
                source: 'draft',
            },
        });

        render(<BrewingZen />);

        expect(screen.getByTestId('infusion-history-label').textContent).toBe('Infusion 1 - 0:25');
        expect(screen.getAllByText('Ready')).toHaveLength(1);
    });

    it('includes the current resting infusion as the newest strip item during rest', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.REST,
            activeSession: {
                ...brewingStore.getState().activeSession!,
                infusions: [
                    createInfusion(),
                ],
            },
            currentInfusion: createInfusion({
                infusionId: 'inf-2',
                infusionNumber: 2,
                duration: 45,
                startTime: '2026-03-14T10:03:00.000Z',
            }),
            editableInfusionMetadata: {
                infusionId: 'inf-2',
                note: '',
                temperature: 180,
                source: 'resting',
            },
        });

        render(<BrewingZen />);

        expect(screen.getByTestId('infusion-history-label').textContent).toBe('Infusion 2 - 0:45');
        expect(screen.getAllByText('Rest')).toHaveLength(1);
    });

    it('updates strip dot states while swiping through infusion history', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.READY,
            activeSession: {
                ...brewingStore.getState().activeSession!,
                infusions: [
                    createInfusion(),
                    createInfusion({
                        infusionId: 'inf-2',
                        infusionNumber: 2,
                        duration: 34,
                        startTime: '2026-03-14T10:03:00.000Z',
                    }),
                    createInfusion({
                        infusionId: 'inf-3',
                        infusionNumber: 3,
                        duration: 52,
                        startTime: '2026-03-14T10:05:00.000Z',
                    }),
                ],
            },
            editableInfusionMetadata: {
                infusionId: null,
                note: '',
                temperature: null,
                source: 'draft',
            },
        });

        render(<BrewingZen />);

        expect(screen.getByTestId('infusion-history-label').textContent).toBe('Infusion 3 - 0:52');
        expect(screen.getByTestId('infusion-history-previous').getAttribute('data-count')).toBe('2');
        expect(screen.getByTestId('infusion-history-next').getAttribute('data-count')).toBe('0');

        act(() => {
            gestureState.config?.onEnd?.({ deltaX: -120, deltaY: 10 });
        });
        expect(screen.getByTestId('infusion-history-label').textContent).toBe('Infusion 2 - 0:34');
        expect(screen.getByTestId('infusion-history-previous').getAttribute('data-count')).toBe('1');
        expect(screen.getByTestId('infusion-history-next').getAttribute('data-count')).toBe('1');

        act(() => {
            gestureState.config?.onEnd?.({ deltaX: -120, deltaY: 10 });
        });
        expect(screen.getByTestId('infusion-history-label').textContent).toBe('Infusion 1 - 0:25');
        expect(screen.getByTestId('infusion-history-previous').getAttribute('data-count')).toBe('0');
        expect(screen.getByTestId('infusion-history-next').getAttribute('data-count')).toBe('2');
    });

    it('ignores vertical drags and clamps infusion-history swipes at the bounds', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.READY,
            activeSession: {
                ...brewingStore.getState().activeSession!,
                infusions: [
                    createInfusion(),
                    createInfusion({
                        infusionId: 'inf-2',
                        infusionNumber: 2,
                        duration: 34,
                        startTime: '2026-03-14T10:03:00.000Z',
                    }),
                ],
            },
            editableInfusionMetadata: {
                infusionId: null,
                note: '',
                temperature: null,
                source: 'draft',
            },
        });

        render(<BrewingZen />);

        act(() => {
            gestureState.config?.onEnd?.({ deltaX: -140, deltaY: 160 });
        });
        expect(screen.getByTestId('infusion-history-label').textContent).toBe('Infusion 2 - 0:34');

        act(() => {
            gestureState.config?.onEnd?.({ deltaX: -120, deltaY: 10 });
        });
        expect(screen.getByTestId('infusion-history-label').textContent).toBe('Infusion 1 - 0:25');

        act(() => {
            gestureState.config?.onEnd?.({ deltaX: -120, deltaY: 10 });
        });
        expect(screen.getByTestId('infusion-history-label').textContent).toBe('Infusion 1 - 0:25');

        act(() => {
            gestureState.config?.onEnd?.({ deltaX: 120, deltaY: 10 });
        });
        expect(screen.getByTestId('infusion-history-label').textContent).toBe('Infusion 2 - 0:34');

        act(() => {
            gestureState.config?.onEnd?.({ deltaX: 120, deltaY: 10 });
        });
        expect(screen.getByTestId('infusion-history-label').textContent).toBe('Infusion 2 - 0:34');
    });

    it('renders a detailed session summary when ended', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.ENDED,
            activeSession: {
                ...brewingStore.getState().activeSession!,
                teaName: 'Cloud Mist',
            },
        });

        render(<BrewingZen />);

        expect(screen.getByText('Session Summary')).toBeDefined();
        expect(screen.getAllByText('Cloud Mist')).toHaveLength(2);
        expect(screen.getByText('Setup')).toBeDefined();
        expect(screen.getByText('Infusion 1')).toBeDefined();
        expect(screen.getByText(/Water 100.5 g/)).toBeDefined();
        expect(screen.getByRole('button', { name: 'Start New Session' })).toBeDefined();
    });

    it('hides the end infusion action while using a real scale', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.INFUSION,
            editableInfusionMetadata: {
                infusionId: 'inf-1',
                note: '',
                temperature: null,
                source: 'current',
            },
        });

        render(<BrewingZen />);

        expect(screen.queryByRole('button', { name: 'End Infusion' })).toBeNull();
    });

    it('shows an end infusion action while infusing with a mock scale', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.INFUSION,
            editableInfusionMetadata: {
                infusionId: 'inf-1',
                note: '',
                temperature: null,
                source: 'current',
            },
        });
        scaleStore.setState({ isMockMode: true });

        render(<BrewingZen />);

        expect(screen.getByRole('button', { name: 'End Infusion' })).toBeDefined();
    });

    it('shows a start infusion action while resting with a mock scale', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.REST,
            currentInfusion: createInfusion(),
            editableInfusionMetadata: {
                infusionId: 'inf-1',
                note: '',
                temperature: null,
                source: 'resting',
            },
        });
        scaleStore.setState({ isMockMode: true });

        render(<BrewingZen />);

        expect(screen.getByRole('button', { name: 'Start Infusion' })).toBeDefined();
    });

    it('cycles weak quick notes from the top controls', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.READY,
            editableInfusionMetadata: {
                infusionId: null,
                note: '',
                temperature: null,
                source: 'draft',
            },
        });

        const { rerender } = render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: 'Weak note' }));
        expect(updateEditableInfusionNote).toHaveBeenCalledWith('weak');

        act(() => {
            brewingStore.setState({
                editableInfusionMetadata: {
                    ...brewingStore.getState().editableInfusionMetadata,
                    note: 'weak',
                },
            });
        });
        rerender(<BrewingZen />);
        fireEvent.click(screen.getByRole('button', { name: 'Weak note' }));
        expect(updateEditableInfusionNote).toHaveBeenLastCalledWith('very weak');

        act(() => {
            brewingStore.setState({
                editableInfusionMetadata: {
                    ...brewingStore.getState().editableInfusionMetadata,
                    note: 'very weak',
                },
            });
        });
        rerender(<BrewingZen />);
        fireEvent.click(screen.getByRole('button', { name: 'Weak note' }));
        expect(updateEditableInfusionNote).toHaveBeenLastCalledWith('');
    });

    it('replaces quick notes with a custom note', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.REST,
            editableInfusionMetadata: {
                infusionId: 'inf-1',
                note: 'strong',
                temperature: 180,
                source: 'resting',
            },
        });

        render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: 'Custom note' }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'floral finish' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

        expect(updateEditableInfusionNote).toHaveBeenCalledWith('floral finish');
    });

    it('validates and saves infusion temperature from the top controls', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.INFUSION,
            editableInfusionMetadata: {
                infusionId: 'inf-1',
                note: '',
                temperature: null,
                source: 'current',
            },
        });

        render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: 'Infusion temperature' }));
        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '300' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

        expect(screen.getByText('Enter a temperature between 0 and 212.')).toBeDefined();
        expect(updateEditableInfusionTemperature).not.toHaveBeenCalled();

        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '185' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

        expect(updateEditableInfusionTemperature).toHaveBeenCalledWith(185);
    });

    it('edits the saved infusion note from the ended summary cards', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.ENDED,
            activeSession: {
                ...brewingStore.getState().activeSession!,
                teaName: 'Cloud Mist',
                infusions: [
                    createInfusion({
                        note: 'sweet',
                    }),
                ],
            },
        });

        render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: /Infusion 1/i }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'fruitier than before' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

        expect(updateSavedInfusionNote).toHaveBeenCalledWith('inf-1', 'fruitier than before');
    });

    it('edits session notes from the ended summary field', () => {
        brewingStore.setState({
            brewingPhase: BrewingPhase.ENDED,
            activeSession: {
                ...brewingStore.getState().activeSession!,
                notes: 'first steep',
            },
        });

        render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: 'Notes first steep' }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'rounder after cooling' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

        expect(updateSessionNotes).toHaveBeenCalledWith('rounder after cooling');
    });

    it('deletes a completed session after confirmation', async () => {
        brewingStore.setState({ brewingPhase: BrewingPhase.ENDED });

        render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: 'Delete Session' }));
        expect(screen.getByTestId('delete-session-alert').getAttribute('data-open')).toBe('true');

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(deleteSession).toHaveBeenCalledWith('session-1');
            expect(clearSession).toHaveBeenCalled();
        });
    });

    it('orders completed-session actions from destructive to primary', () => {
        brewingStore.setState({ brewingPhase: BrewingPhase.ENDED });

        render(<BrewingZen />);

        const deleteButton = screen.getByRole('button', { name: 'Delete Session' });
        const startButton = screen.getByRole('button', { name: 'Start New Session' });

        expect(deleteButton.compareDocumentPosition(startButton) & 4).toBe(4);
    });

    it('uses the shared tea editor suggestions when saving a tea name', async () => {
        render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: /Teano tea selected/i }));

        expect(loadKnownTeas).toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Show Search existing teas suggestions' }));
        fireEvent.click(screen.getByRole('option', { name: 'ORT 2015 Gao Jia Shan' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(saveTea).toHaveBeenCalledWith(expect.objectContaining({ name: 'ORT 2015 Gao Jia Shan' }));
        });
    });
});
