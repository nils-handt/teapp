import type { MouseEventHandler, PropsWithChildren } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import BrewingZen from './BrewingZen';
import { BrewingPhase, type EditableInfusionMetadata, type InfusionMetadataDraft } from '../../services/interfaces/brewing.types';
import type { BrewingVessel } from '../../entities/BrewingVessel.entity';

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
    loadKnownTeaNames,
    upsertKnownTeaName,
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
    loadKnownTeaNames: vi.fn(),
    upsertKnownTeaName: vi.fn(),
}));

type BrewingZenInfusion = {
    duration: number;
    infusionId: string;
    infusionNumber: number;
    note?: string | null;
    restDuration: number;
    temperature?: number | null;
    waterWeight: number;
    wetTeaLeavesWeight: number;
};

type BrewingZenSession = {
    brewingVessel: Pick<BrewingVessel, 'name'> | null;
    dryTeaLeavesWeight: number;
    endTime: string;
    infusions: BrewingZenInfusion[];
    lidWeight: number;
    startTime: string;
    teaName: string;
    trayWeight: number;
    vesselWeight: number;
};

type BrewingZenStore = {
    activeSession: BrewingZenSession | null;
    brewingPhase: BrewingPhase;
    connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'scanning';
    currentWeight: number;
    editableInfusionMetadata: EditableInfusionMetadata;
    firstInfusionDraft: InfusionMetadataDraft;
    knownTeaNames: string[];
    loadKnownTeaNames: () => Promise<void> | void;
    timerValue: number;
    upsertKnownTeaName: (teaName: string) => void;
};

type ButtonProps = PropsWithChildren<{
    disabled?: boolean;
    onClick?: MouseEventHandler<HTMLButtonElement>;
}>;

let mockState: BrewingZenStore;

vi.mock('../../components/DesignSwitcher', () => ({
    default: () => <div>Design Switcher</div>,
}));

vi.mock('../../hooks/useBrewingControl', () => ({
    useBrewingControl: () => ({
        startBrewingSession,
        handleEndSession,
        recordingAlert: null,
    }),
}));

vi.mock('../../stores/useStore', () => ({
    useStore: () => mockState,
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
    },
}));

vi.mock('@ionic/react', () => ({
    IonAlert: () => null,
    IonButton: ({ children, onClick, disabled }: ButtonProps) => <button onClick={onClick} disabled={disabled}>{children}</button>,
    IonContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonPage: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
    IonToolbar: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

describe('BrewingZen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockState = {
            activeSession: {
                teaName: '',
                brewingVessel: null,
                vesselWeight: 95.2,
                lidWeight: 14.1,
                trayWeight: 0,
                dryTeaLeavesWeight: 6.4,
                startTime: '2026-03-14T10:00:00.000Z',
                endTime: '2026-03-14T10:10:00.000Z',
                infusions: [
                    {
                        infusionId: 'inf-1',
                        infusionNumber: 1,
                        duration: 25,
                        waterWeight: 100.5,
                        wetTeaLeavesWeight: 18.2,
                        restDuration: 35,
                        note: '',
                        temperature: null,
                    },
                ],
            },
            brewingPhase: BrewingPhase.SETUP,
            connectionStatus: 'connected',
            currentWeight: 63.5,
            editableInfusionMetadata: {
                infusionId: null,
                note: '',
                temperature: null,
                source: 'none',
            },
            firstInfusionDraft: {
                note: '',
                temperature: null,
            },
            timerValue: 92000,
            knownTeaNames: ['ORT 2015 Gao Jia Shan', 'Morning Sencha'],
            loadKnownTeaNames,
            upsertKnownTeaName,
        };
    });

    it('shows only the connect action when the scale is disconnected', () => {
        mockState.connectionStatus = 'disconnected';

        render(<BrewingZen />);

        expect(screen.getByRole('button', { name: /connect to scale/i })).toBeDefined();
        expect(screen.queryByText('End Session')).toBeNull();
    });

    it('renders the setup phase with live weight and editable fields', () => {
        render(<BrewingZen />);

        expect(screen.getByText('63.5 g')).toBeDefined();
        expect(screen.getByRole('button', { name: /^Vessel95\.2 g$/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Lid/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Tray/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Tea6.4 g/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /tea name/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /vessel name/i })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Confirm Setup' })).toBeDefined();
    });

    it('shows the tea placeholder in ready when no tea name exists and hides live weight', () => {
        mockState.brewingPhase = BrewingPhase.READY;
        mockState.editableInfusionMetadata = {
            infusionId: null,
            note: '',
            temperature: null,
            source: 'draft',
        };

        render(<BrewingZen />);

        expect(screen.getByRole('button', { name: /tea nameno tea selected/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /vessel nameno vessel selected/i })).toBeDefined();
        expect(screen.queryByText('63.5 g')).toBeNull();
    });

    it('hides the tea field in ready when a tea name has been selected', () => {
        mockState.brewingPhase = BrewingPhase.READY;
        mockState.activeSession!.teaName = 'Morning Sencha';
        mockState.editableInfusionMetadata = {
            infusionId: null,
            note: '',
            temperature: null,
            source: 'draft',
        };

        render(<BrewingZen />);

        expect(screen.queryByRole('button', { name: /Teaname/i })).toBeNull();
        expect(screen.queryByText('Morning Sencha')).toBeNull();
    });

    it('greys out the timer during rest', () => {
        mockState.brewingPhase = BrewingPhase.REST;
        mockState.editableInfusionMetadata = {
            infusionId: 'inf-1',
            note: '',
            temperature: 180,
            source: 'resting',
        };

        render(<BrewingZen />);

        const timer = screen.getByText('1:32');
        expect(timer.getAttribute('style')).toContain('color: rgb(154, 163, 153)');
    });

    it('renders a detailed session summary when ended', () => {
        mockState.brewingPhase = BrewingPhase.ENDED;
        mockState.activeSession!.teaName = 'Cloud Mist';

        render(<BrewingZen />);

        expect(screen.getByText('Session Summary')).toBeDefined();
        expect(screen.getAllByText('Cloud Mist')).toHaveLength(2);
        expect(screen.getByText('Setup')).toBeDefined();
        expect(screen.getByText('Infusion 1')).toBeDefined();
        expect(screen.getByText(/Water 100.5 g/)).toBeDefined();
        expect(screen.getByRole('button', { name: 'Start New Session' })).toBeDefined();
    });

    it('shows an end infusion action while infusing', () => {
        mockState.brewingPhase = BrewingPhase.INFUSION;
        mockState.editableInfusionMetadata = {
            infusionId: 'inf-1',
            note: '',
            temperature: null,
            source: 'current',
        };

        render(<BrewingZen />);

        expect(screen.getByRole('button', { name: 'End Infusion' })).toBeDefined();
    });

    it('cycles weak quick notes from the top controls', () => {
        mockState.brewingPhase = BrewingPhase.READY;
        mockState.editableInfusionMetadata = {
            infusionId: null,
            note: '',
            temperature: null,
            source: 'draft',
        };

        const { rerender } = render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: 'Weak note' }));
        expect(updateEditableInfusionNote).toHaveBeenCalledWith('weak');

        mockState.editableInfusionMetadata.note = 'weak';
        rerender(<BrewingZen />);
        fireEvent.click(screen.getByRole('button', { name: 'Weak note' }));
        expect(updateEditableInfusionNote).toHaveBeenLastCalledWith('very weak');

        mockState.editableInfusionMetadata.note = 'very weak';
        rerender(<BrewingZen />);
        fireEvent.click(screen.getByRole('button', { name: 'Weak note' }));
        expect(updateEditableInfusionNote).toHaveBeenLastCalledWith('');
    });

    it('replaces quick notes with a custom note', () => {
        mockState.brewingPhase = BrewingPhase.REST;
        mockState.editableInfusionMetadata = {
            infusionId: 'inf-1',
            note: 'strong',
            temperature: 180,
            source: 'resting',
        };

        render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: 'Custom note' }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'floral finish' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

        expect(updateEditableInfusionNote).toHaveBeenCalledWith('floral finish');
    });

    it('validates and saves infusion temperature from the top controls', () => {
        mockState.brewingPhase = BrewingPhase.INFUSION;
        mockState.editableInfusionMetadata = {
            infusionId: 'inf-1',
            note: '',
            temperature: null,
            source: 'current',
        };

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
        mockState.brewingPhase = BrewingPhase.ENDED;
        mockState.activeSession!.teaName = 'Cloud Mist';
        mockState.activeSession!.infusions[0].note = 'sweet';

        render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: /Infusion 1/i }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'fruitier than before' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

        expect(updateSavedInfusionNote).toHaveBeenCalledWith('inf-1', 'fruitier than before');
    });

    it('uses the shared tea editor suggestions when saving a tea name', () => {
        render(<BrewingZen />);

        fireEvent.click(screen.getByRole('button', { name: /tea nameno tea selected/i }));

        expect(loadKnownTeaNames).toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'ORT 2015 Gao Jia Shan' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(updateTeaName).toHaveBeenCalledWith('ORT 2015 Gao Jia Shan');
        expect(upsertKnownTeaName).toHaveBeenCalledWith('ORT 2015 Gao Jia Shan');
    });
});
