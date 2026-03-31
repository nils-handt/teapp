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
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
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
        getRememberedDeviceSupport: vi.fn(),
        requestDevice: vi.fn(),
        waitForDeviceAdvertisement: vi.fn(),
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
        clearScaleDevices: vi.fn().mockResolvedValue(undefined),
        saveScaleDevice: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('./logging', () => ({
    createLogger: () => hoisted.logger,
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        getPlatform: vi.fn(() => 'web'),
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
        vi.mocked(settingsRepository.getPreferredDeviceId).mockResolvedValue(null);
        vi.mocked(settingsRepository.getScaleDevice).mockResolvedValue(null);
        vi.mocked(settingsRepository.clearScaleDevices).mockResolvedValue(undefined);
        vi.mocked(settingsRepository.saveScaleDevice).mockResolvedValue(undefined);
        vi.mocked(bleAdapter.getDevices).mockResolvedValue([]);
        vi.mocked(bleAdapter.getRememberedDeviceSupport).mockReturnValue({
            canRestoreDevices: true,
            canWatchAdvertisements: true,
        });
        vi.mocked(bleAdapter.waitForDeviceAdvertisement).mockResolvedValue({
            status: 'advertisement-received',
            observedAt: '2026-03-23T10:00:05.000Z',
        });
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
        expect(settingsRepository.clearScaleDevices).toHaveBeenCalledTimes(1);
        expect(settingsRepository.saveScaleDevice).toHaveBeenCalledTimes(1);
        expect(vi.mocked(settingsRepository.clearScaleDevices).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(settingsRepository.saveScaleDevice).mock.invocationCallOrder[0]
        );
    });

    it('auto-connects on initialize when the preferred device is restored and advertising', async () => {
        vi.mocked(settingsRepository.getPreferredDeviceId).mockResolvedValue(device.id);
        vi.mocked(settingsRepository.getScaleDevice).mockResolvedValue({
            deviceId: device.id,
            name: device.name,
            address: device.id,
            isPreferred: true,
            lastConnected: '2026-03-23T10:00:00.000Z',
            scaleType: device.scaleType as never,
        });
        vi.mocked(bleAdapter.getDevices).mockResolvedValue([
            {
                deviceId: device.id,
                name: device.name,
            } as never,
        ]);

        await service.initialize();

        expect(vi.mocked(bleAdapter.getDevices)).toHaveBeenCalledWith([device.id]);
        expect(vi.mocked(bleAdapter.waitForDeviceAdvertisement)).toHaveBeenCalledWith(device.id, 25_000);
        expect(vi.mocked(bleAdapter.connect)).toHaveBeenCalledWith(device.id, expect.any(Function));
        expect(scaleStore.getState().connectionStatus).toBe('connected');
        expect(scaleStore.getState().connectedDevice).toMatchObject({
            id: device.id,
            name: device.name,
        });
    });

    it('skips auto-connect when the preferred device is not returned by getDevices', async () => {
        vi.mocked(settingsRepository.getPreferredDeviceId).mockResolvedValue(device.id);
        vi.mocked(settingsRepository.getScaleDevice).mockResolvedValue({
            deviceId: device.id,
            name: device.name,
            address: device.id,
            isPreferred: true,
            lastConnected: '2026-03-23T10:00:00.000Z',
            scaleType: device.scaleType as never,
        });
        vi.mocked(bleAdapter.getDevices).mockResolvedValue([
            {
                deviceId: 'different-scale',
                name: 'Another Scale',
            } as never,
        ]);

        await service.initialize();

        expect(vi.mocked(bleAdapter.connect)).not.toHaveBeenCalled();
        expect(vi.mocked(bleAdapter.waitForDeviceAdvertisement)).not.toHaveBeenCalled();
        expect(scaleStore.getState().connectionStatus).toBe('disconnected');
        expect(hoisted.logger.warn).toHaveBeenCalledWith(
            `Device ${device.id} was not returned from remembered web devices. Skipping auto-connect.`
        );
    });

    it('times out cleanly when the preferred device is restored but not advertising yet', async () => {
        vi.mocked(settingsRepository.getPreferredDeviceId).mockResolvedValue(device.id);
        vi.mocked(settingsRepository.getScaleDevice).mockResolvedValue({
            deviceId: device.id,
            name: device.name,
            address: device.id,
            isPreferred: true,
            lastConnected: '2026-03-23T10:00:00.000Z',
            scaleType: device.scaleType as never,
        });
        vi.mocked(bleAdapter.getDevices).mockResolvedValue([
            {
                deviceId: device.id,
                name: device.name,
            } as never,
        ]);
        vi.mocked(bleAdapter.waitForDeviceAdvertisement).mockResolvedValue({
            status: 'timeout',
        });

        await service.initialize();

        expect(vi.mocked(bleAdapter.connect)).not.toHaveBeenCalled();
        expect(scaleStore.getState().connectionStatus).toBe('disconnected');
        expect(hoisted.logger.warn).toHaveBeenCalledWith(
            `Timed out waiting for advertisements from ${device.name}.`
        );
    });

    it('exits with a distinct diagnostic path when remembered-device support is unavailable', async () => {
        vi.mocked(settingsRepository.getPreferredDeviceId).mockResolvedValue(device.id);
        vi.mocked(settingsRepository.getScaleDevice).mockResolvedValue({
            deviceId: device.id,
            name: device.name,
            address: device.id,
            isPreferred: true,
            lastConnected: '2026-03-23T10:00:00.000Z',
            scaleType: device.scaleType as never,
        });
        vi.mocked(bleAdapter.getRememberedDeviceSupport).mockReturnValue({
            canRestoreDevices: false,
            canWatchAdvertisements: false,
        });

        await service.initialize();

        expect(vi.mocked(bleAdapter.getDevices)).not.toHaveBeenCalled();
        expect(vi.mocked(bleAdapter.waitForDeviceAdvertisement)).not.toHaveBeenCalled();
        expect(vi.mocked(bleAdapter.connect)).not.toHaveBeenCalled();
        expect(hoisted.logger.warn).toHaveBeenCalledWith(
            'Browser does not support restoring permitted Bluetooth devices with advertisement watching. Skipping auto-connect.'
        );
    });

    it('can reconnect from persisted device data in a fresh service instance after advertisements resume', async () => {
        await service.connect(device);

        const savedDevice = vi.mocked(settingsRepository.saveScaleDevice).mock.calls[0]?.[0];
        expect(savedDevice).toMatchObject({
            deviceId: device.id,
            name: device.name,
            scaleType: device.scaleType,
            isPreferred: true,
        });

        const freshService = new RealScaleService();
        vi.mocked(settingsRepository.getPreferredDeviceId).mockResolvedValue(device.id);
        vi.mocked(settingsRepository.getScaleDevice).mockResolvedValue(savedDevice ?? null);
        vi.mocked(bleAdapter.getDevices).mockResolvedValue([
            {
                deviceId: device.id,
                name: device.name,
            } as never,
        ]);

        await freshService.initialize();

        expect(vi.mocked(bleAdapter.waitForDeviceAdvertisement)).toHaveBeenCalledWith(device.id, 25_000);
        expect(vi.mocked(bleAdapter.connect)).toHaveBeenCalledTimes(2);
        expect(scaleStore.getState().connectionStatus).toBe('connected');
        expect(scaleStore.getState().connectedDevice).toMatchObject({
            id: device.id,
            name: device.name,
        });
    });
});
