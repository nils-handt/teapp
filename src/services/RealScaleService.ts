import { BleDevice, numberToUUID } from '@capacitor-community/bluetooth-le';
import { Subscription, Subject } from 'rxjs';
import { useStore } from '../stores/useStore';
import { bleAdapter } from './bluetooth/adapters/BleAdapter';
import { BluetoothScale } from './bluetooth/base/BluetoothScale';
import { AVAILABLE_SCALES } from './bluetooth/index';
import { DiscoveredDevice, LimitedPeripheralData, PeripheralData } from './bluetooth/types/ble.types';
import { ScaleType, WeightChangeEvent } from './bluetooth/types/scale.types';
import { Logger } from './bluetooth/utils/Logger';
import { settingsRepository } from '../repositories/SettingsRepository';
import { ScaleDevice } from '../entities/ScaleDevice.entity';
import { IScaleService } from './interfaces/IScaleService';

const logger = new Logger('RealScaleService');
const RECONNECT_DELAY_MS = [1000, 2000, 4000];
const MAX_RECONNECT_ATTEMPTS = 3;

// Collected Service UUIDs for optionalServices to ensure communication after connection
// todo load dynamically from available scales
const SCALE_OPTIONAL_SERVICES = [
    // '1820', // Acaia
    // '1825', // Felicita
    // '181d', // Timemore
    // 'ff08', // Skale
    // '06c31822-8682-4744-9211-febc93e3bece', // Jimmy
    // 'fff0', // Decent, Espressi, Eureka, SmartChef
    // '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // WeighMyBru
    '0000ffb0-0000-1000-8000-00805f9b34fb', // BlackCoffee
    numberToUUID(0x0FFE), // Bokoo
];

export class RealScaleService implements IScaleService {
    public weight$ = new Subject<number>();
    private currentScale: BluetoothScale | null = null;
    private subscriptions: Subscription[] = [];
    private reconnectAttempts = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private lastDevice: DiscoveredDevice | null = null;
    private disconnectInProgress = false;

    constructor() { }

    async initialize(): Promise<void> {
        const preferredId = await settingsRepository.getPreferredDeviceId();
        if (!preferredId) {
            logger.log('No preferred device saved.');
            return;
        }

        const savedDevice = await settingsRepository.getScaleDevice(preferredId);
        if (!savedDevice) {
            logger.log(`Preferred device ${preferredId} not found in known devices.`);
            return;
        }

        logger.log(`Attempting to auto-connect to preferred device: ${savedDevice.name}`);

        try {
            const connectedDevices = await bleAdapter.getDevices();
            const deviceAvailable = connectedDevices.find(d => d.deviceId === savedDevice.deviceId);

            // If strictly checking against currently advertising/connected devices:
            if (!deviceAvailable) {
                // Note: In a real scenario, we might want to scan again if not found, 
                // but for now we follow existing logic.
                logger.log(`Device ${savedDevice.deviceId} not found in permitted devices. Skipping auto-connect.`);
                return;
            }

            // Reconstruct a DiscoveredDevice from the saved info
            const device: DiscoveredDevice = {
                id: savedDevice.deviceId,
                name: savedDevice.name || 'Unknown Device',
                rssi: -100, // Placeholder
                scaleType: savedDevice.scaleType,
                peripheral: {
                    id: savedDevice.deviceId,
                    name: savedDevice.name || 'Unknown Device',
                    advertising: new ArrayBuffer(0),
                    rssi: -100
                }
            };

            await this.connect(device);
        } catch (error) {
            logger.error('Auto-connect failed:', error);
        }
    }


    async connectNewDevice(): Promise<void> {
        if (this.getConnectionStatus() === 'connected') {
            logger.log('Already connected to a device. Disconnect first.');
            return;
        }

        try {
            logger.log('Requesting device...');
            const device: BleDevice = await bleAdapter.requestDevice({
                optionalServices: SCALE_OPTIONAL_SERVICES,
            });

            if (!device) {
                logger.log('No device selected.');
                return;
            }

            logger.log(`Device selected: ${device.name} (${device.deviceId})`);

            const peripheral: LimitedPeripheralData = {
                id: device.deviceId,
                name: device.name || 'Unknown Device',
                advertising: new ArrayBuffer(0),
                rssi: 0,
            };

            const scaleType = this.identifyScale(peripheral);

            if (!scaleType) {
                throw new Error(`Device ${device.name} is not a supported scale.`);
            }

            const discoveredDevice: DiscoveredDevice = {
                id: device.deviceId,
                name: device.name || 'Unknown Device',
                rssi: 0,
                scaleType,
                peripheral,
            };

            await this.connect(discoveredDevice);

        } catch (error) {
            logger.error('Failed to connect to new device:', error);
            useStore.getState().setConnectionStatus('disconnected');
        }
    }

    async connect(device: DiscoveredDevice): Promise<void> {
        if (!device.scaleType) {
            throw new Error(`Device ${device.id} is not a supported scale.`);
        }

        useStore.getState().setConnectionStatus('connecting');

        const scaleInfo = AVAILABLE_SCALES.find((s) => s.scaleType === device.scaleType);
        if (!scaleInfo) {
            throw new Error(`Implementation for scale type ${device.scaleType} not found.`);
        }

        this.currentScale = new scaleInfo.class(device.peripheral as PeripheralData);
        if (!this.currentScale) {
            throw new Error('Failed to instantiate scale class.');
        }
        this.currentScale.setDisconnectHandler(this.handleScaleDisconnect.bind(this));
        logger.log(`Connecting to ${this.currentScale.device_name}...`);

        try {
            await this.currentScale.connect();
            this.subscribeToScaleEvents();
            useStore.getState().setConnectionStatus('connected');
            useStore.getState().setConnectedDevice(device);
            this.lastDevice = device;
            this.reconnectAttempts = 0;
            logger.log(`Successfully connected to ${this.currentScale.device_name}.`);

            const scaleDevice: ScaleDevice = {
                deviceId: device.id,
                name: device.name,
                address: device.id,
                isPreferred: true,
                lastConnected: new Date().toISOString(),
                scaleType: device.scaleType || undefined,
            };
            await settingsRepository.saveScaleDevice(scaleDevice);

        } catch (error) {
            logger.error(`Connection to ${device.name} failed:`, error);
            await this.handleDisconnect(false);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (!this.currentScale) return;
        const connectedDevice = this.getConnectedDevice();
        logger.log(`Disconnecting from ${this.currentScale.device_name}...`);
        this.disconnectInProgress = true;
        try {
            await this.currentScale.disconnectTriggered();
        } catch (err) {
            logger.error('Error during scale specific disconnect cleanup:', err);
        }
        try {
            if (connectedDevice) {
                await bleAdapter.disconnect(connectedDevice.id);
            }
        } finally {
            await this.handleDisconnect(false);
            this.disconnectInProgress = false;
        }
    }

    async tare(): Promise<void> {
        if (!this.currentScale || this.getConnectionStatus() !== 'connected') {
            throw new Error('Not connected to any scale.');
        }
        await this.currentScale.tare();
    }

    getConnectionStatus() {
        return useStore.getState().connectionStatus;
    }

    getConnectedDevice() {
        return useStore.getState().connectedDevice;
    }

    private identifyScale(peripheral: LimitedPeripheralData): ScaleType | null {
        for (const scale of AVAILABLE_SCALES) {
            if (scale.class.test(peripheral as PeripheralData)) {
                return scale.scaleType;
            }
        }
        return null;
    }

    private subscribeToScaleEvents() {
        if (!this.currentScale) return;
        this.cleanupSubscriptions();

        this.subscriptions.push(
            this.currentScale.weightChange.subscribe((event: WeightChangeEvent) => {
                useStore.getState().setCurrentWeight(event.weight.actual);
                this.weight$.next(event.weight.actual);
            }),
            this.currentScale.tareEvent.subscribe(() => logger.log('Tare event received')),
            this.currentScale.timerEvent.subscribe(() => logger.log('Timer event received')),
            this.currentScale.flowChange.subscribe(() => logger.log('Flow change event received'))
        );
    }

    private async handleDisconnect(unexpected: boolean) {
        const lastConnectedDevice = this.lastDevice;
        this.cleanup();

        useStore.getState().setConnectionStatus('disconnected');
        useStore.getState().setConnectedDevice(null);
        useStore.getState().setCurrentWeight(0);

        if (unexpected && lastConnectedDevice) {
            logger.log('Unexpected disconnection. Attempting to reconnect...');
            this.attemptReconnect(lastConnectedDevice);
        } else {
            logger.log('Scale disconnected.');
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectAttempts = 0;
        }
    }

    private async handleScaleDisconnect(): Promise<void> {
        if (this.disconnectInProgress) {
            logger.log('Ignoring disconnect callback during manual disconnect.');
            return;
        }

        await this.handleDisconnect(true);
    }

    private attemptReconnect(device: DiscoveredDevice) {
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            logger.error('Max reconnection attempts reached. Giving up.');
            this.reconnectAttempts = 0;
            return;
        }

        const delay = RECONNECT_DELAY_MS[this.reconnectAttempts];
        this.reconnectAttempts++;

        logger.log(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);

        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connect(device);
            } catch {
                logger.error(`Reconnect attempt ${this.reconnectAttempts} failed.`);
            }
        }, delay);
    }

    private cleanupSubscriptions() {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.subscriptions = [];
    }

    private cleanup() {
        this.cleanupSubscriptions();
        if (this.currentScale) {
            this.currentScale.cleanup();
            this.currentScale = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
