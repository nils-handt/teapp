import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { RealScaleService } from './RealScaleService';
import { bleAdapter } from './bluetooth/adapters/BleAdapter';
import { settingsRepository } from '../repositories/SettingsRepository';
import { DiscoveredDevice, PeripheralData } from './bluetooth/types/ble.types';
import { initialScaleStoreState, scaleStore } from '../stores/useScaleStore';

const hoisted = vi.hoisted(() => {
    let disconnectCallback: (() => void | Promise<void>) | undefined;
    let failDisconnectCleanup = false;

    const connect = vi.fn(async (_deviceId: string, onDisconnect?: () => void | Promise<void>) => {
        disconnectCallback = onDisconnect;
    });
    const disconnect = vi.fn(async () => undefined);

    class FakeScale {
        public device_name: string;
        public weightChangeSubject = new Subject<{ weight: { actual: number; old: number; smoothed: number; oldSmoothed: number }; stable: boolean; timestamp: number }>();
        public weightChange = this.weightChangeSubject.asObservable();
        public tareEventSubject = new Subject<void>();
        public tareEvent = this.tareEventSubject.asObservable();
        public timerEventSubject = new Subject<void>();
        public timerEvent = this.timerEventSubject.asObservable();
        public flowChangeSubject = new Subject<void>();
        public flowChange = this.flowChangeSubject.asObservable();
        private disconnectHandler: (() => void | Promise<void>) | null = null;

        constructor(public peripheral: Partial<PeripheralData>) {
            this.device_name = peripheral.name || 'Fake Scale';
        }

        async connect(): Promise<void> {
            await connect(this.peripheral.id || '', async () => {
                try {
                    await this.disconnectTriggered();
                } catch {
                    // Real BluetoothScale swallows cleanup errors before notifying the service.
                }

                if (this.disconnectHandler) {
                    await this.disconnectHandler();
                }
            });
        }

        async tare(): Promise<void> {
            return;
        }

        async setLed(): Promise<void> {
            return;
        }

        async setTimer(): Promise<void> {
            return;
        }

        async getWeight(): Promise<void> {
            return;
        }

        async disconnectTriggered(): Promise<void> {
            if (failDisconnectCleanup) {
                throw new Error('stopNotifications failed');
            }
        }

        setDisconnectHandler(handler: (() => void | Promise<void>) | null): void {
            this.disconnectHandler = handler;
        }

        cleanup(): void {
            this.weightChangeSubject.complete();
            this.tareEventSubject.complete();
            this.timerEventSubject.complete();
            this.flowChangeSubject.complete();
        }
    }

    return {
        connect,
        disconnect,
        getDisconnectCallback: () => disconnectCallback,
        resetDisconnectCallback: () => {
            disconnectCallback = undefined;
        },
        setFailDisconnectCleanup: (value: boolean) => {
            failDisconnectCleanup = value;
        },
        FakeScale,
    };
});

vi.mock('./bluetooth/adapters/BleAdapter', () => ({
    bleAdapter: {
        connect: hoisted.connect,
        disconnect: hoisted.disconnect,
        getDevices: vi.fn(),
        requestDevice: vi.fn(),
        startNotifications: vi.fn(),
        stopNotifications: vi.fn(),
        write: vi.fn(),
        numbersToData: vi.fn(),
    },
}));

vi.mock('../repositories/SettingsRepository', () => ({
    settingsRepository: {
        getPreferredDeviceId: vi.fn().mockResolvedValue(null),
        getScaleDevice: vi.fn().mockResolvedValue(null),
        saveScaleDevice: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('./bluetooth/index', () => ({
    AVAILABLE_SCALES: [
        {
            scaleType: 'TIMEMORE',
            class: hoisted.FakeScale,
        },
    ],
}));

describe('RealScaleService', () => {
    let service: RealScaleService;

    const device: DiscoveredDevice = {
        id: 'scale-1',
        name: 'Timemore Scale',
        rssi: -40,
        scaleType: 'TIMEMORE' as never,
        peripheral: {
            id: 'scale-1',
            name: 'Timemore Scale',
            advertising: new ArrayBuffer(0),
            rssi: -40,
        },
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        hoisted.resetDisconnectCallback();
        hoisted.setFailDisconnectCleanup(false);
        scaleStore.setState(initialScaleStoreState);
        service = new RealScaleService();
    });

    it('reflects unexpected disconnects in the store and schedules reconnect', async () => {
        await service.connect(device);
        scaleStore.getState().setCurrentWeight(42.5);

        const onDisconnect = hoisted.getDisconnectCallback();
        expect(onDisconnect).toBeTypeOf('function');

        await onDisconnect?.();

        expect(scaleStore.getState().connectionStatus).toBe('disconnected');
        expect(scaleStore.getState().connectedDevice).toBeNull();
        expect(scaleStore.getState().currentWeight).toBe(0);

        await vi.advanceTimersByTimeAsync(1000);

        expect(vi.mocked(bleAdapter.connect)).toHaveBeenCalledTimes(2);
    });

    it('does not schedule reconnect on manual disconnect', async () => {
        await service.connect(device);

        await service.disconnect();
        await vi.runAllTimersAsync();

        expect(scaleStore.getState().connectionStatus).toBe('disconnected');
        expect(scaleStore.getState().connectedDevice).toBeNull();
        expect(scaleStore.getState().currentWeight).toBe(0);
        expect(vi.mocked(bleAdapter.connect)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(bleAdapter.disconnect)).toHaveBeenCalledWith(device.id);
    });

    it('still updates disconnect state when scale cleanup throws during unexpected disconnect', async () => {
        hoisted.setFailDisconnectCleanup(true);
        await service.connect(device);

        const onDisconnect = hoisted.getDisconnectCallback();
        await onDisconnect?.();

        expect(scaleStore.getState().connectionStatus).toBe('disconnected');
        expect(scaleStore.getState().connectedDevice).toBeNull();

        await vi.advanceTimersByTimeAsync(1000);

        expect(vi.mocked(bleAdapter.connect)).toHaveBeenCalledTimes(2);
    });

    it('persists the connected scale after a successful connection', async () => {
        await service.connect(device);

        expect(scaleStore.getState().connectionStatus).toBe('connected');
        expect(scaleStore.getState().connectedDevice).toEqual(device);
        expect(settingsRepository.saveScaleDevice).toHaveBeenCalledTimes(1);
    });
});
