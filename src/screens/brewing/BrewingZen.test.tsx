import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import BrewingZen from './BrewingZen';
import { BrewingPhase } from '../../services/interfaces/brewing.types';

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
}));

let mockState: any;

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
    },
}));

vi.mock('@ionic/react', () => ({
    IonAlert: () => null,
    IonButton: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
    IonContent: ({ children }: any) => <div>{children}</div>,
    IonHeader: ({ children }: any) => <div>{children}</div>,
    IonPage: ({ children }: any) => <div>{children}</div>,
    IonTitle: ({ children }: any) => <div>{children}</div>,
    IonToolbar: ({ children }: any) => <div>{children}</div>,
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
                    },
                ],
            },
            brewingPhase: BrewingPhase.SETUP,
            connectionStatus: 'connected',
            currentWeight: 63.5,
            timerValue: 92000,
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

        render(<BrewingZen />);

        expect(screen.getByRole('button', { name: /tea nameno tea selected/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /vessel nameno vessel selected/i })).toBeDefined();
        expect(screen.queryByText('63.5 g')).toBeNull();
    });

    it('hides the tea field in ready when a tea name has been selected', () => {
        mockState.brewingPhase = BrewingPhase.READY;
        mockState.activeSession.teaName = 'Morning Sencha';

        render(<BrewingZen />);

        expect(screen.queryByRole('button', { name: /Teaname/i })).toBeNull();
        expect(screen.queryByText('Morning Sencha')).toBeNull();
    });

    it('greys out the timer during rest', () => {
        mockState.brewingPhase = BrewingPhase.REST;

        render(<BrewingZen />);

        const timer = screen.getByText('1:32');
        expect(timer.getAttribute('style')).toContain('color: rgb(154, 163, 153)');
    });

    it('renders a detailed session summary when ended', () => {
        mockState.brewingPhase = BrewingPhase.ENDED;
        mockState.activeSession.teaName = 'Cloud Mist';

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

        render(<BrewingZen />);

        expect(screen.getByRole('button', { name: 'End Infusion' })).toBeDefined();
    });
});
