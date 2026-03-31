import { BleDevice, numberToUUID } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { Subscription, Subject } from 'rxjs';
import { bleAdapter } from './bluetooth/adapters/BleAdapter';
import { BluetoothScale } from './bluetooth/base/BluetoothScale';
import { AVAILABLE_SCALES } from './bluetooth/index';
import { DiscoveredDevice, LimitedPeripheralData, PeripheralData } from './bluetooth/types/ble.types';
import { ScaleType, WeightChangeEvent } from './bluetooth/types/scale.types';
import { settingsRepository } from '../repositories/SettingsRepository';
import { ScaleDevice } from '../entities/ScaleDevice.entity';
import { IScaleService } from './interfaces/IScaleService';
import { createLogger } from './logging';
import { scaleStore } from '../stores/useScaleStore';

const logger = createLogger('RealScaleService');
const RECONNECT_DELAY_MS = [1000, 2000, 4000];
const MAX_RECONNECT_ATTEMPTS = 3;
const WEB_RECONNECT_ADVERTISEMENT_TIMEOUT_MS = 25_000;

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
    private initializePromise: Promise<void> | null = null;

    constructor() { }

    async initialize(): Promise<void> {
        if (this.initializePromise) {
            return this.initializePromise;
        }

        this.initializePromise = this.performInitialize().finally(() => {
            this.initializePromise = null;
        });

        return this.initializePromise;
    }

    private async performInitialize(): Promise<void> {
        const preferredId = await settingsRepository.getPreferredDeviceId();
        if (!preferredId) {
            logger.debug('No preferred device saved');
            return;
        }

        const savedDevice = await settingsRepository.getScaleDevice(preferredId);
        if (!savedDevice) {
            logger.warn(`Preferred device ${preferredId} was not found in known devices`);
            return;
        }

        logger.info(`Attempting to auto-connect to preferred device: ${savedDevice.name}`);

        if (Capacitor.getPlatform() === 'web') {
            await this.initializeWebPreferredDevice(savedDevice);
            return;
        }

        await this.initializeNativePreferredDevice(savedDevice);
    }

    /**
     * Note this does not really work reliably right now
     * 
     * Chrome behavior with remembering devices via navigator.bluetooth.getDevices() seems to be the main issue
     * Devices are shared across all tabs and websites, including incognito windows.
     * As long as one tab that uses the navigator.bluetooth.requestDevice() API stays open(and probably active), the device will remain available to all tabs after reload.
     * If only a single tab is open and then reloaded navigator.bluetooth.getDevices() seems to always return an empty array - despite chrome still showing the device as paired in the connect dialog.
     * See https://googlechrome.github.io/samples/web-bluetooth/watch-advertisements-and-connect.html for an example.
     * 
     * @param savedDevice 
     * @returns 
     */
    private async initializeWebPreferredDevice(savedDevice: ScaleDevice): Promise<void> {
        const support = bleAdapter.getRememberedDeviceSupport();
        try {
            if (!support.canRestoreDevices || !support.canWatchAdvertisements) {
                logger.warn('Browser does not support restoring permitted Bluetooth devices with advertisement watching. Skipping auto-connect.');
                return;
            }

            const connectedDevices = await bleAdapter.getDevices([savedDevice.deviceId]);
            const restoredDevice = connectedDevices.find((device) => device.deviceId === savedDevice.deviceId);

            if (!restoredDevice) {
                logger.warn(`Device ${savedDevice.deviceId} was not returned from remembered web devices. Skipping auto-connect.`);
                return;
            }

            const watchResult = await bleAdapter.waitForDeviceAdvertisement(
                savedDevice.deviceId,
                WEB_RECONNECT_ADVERTISEMENT_TIMEOUT_MS
            );

            if (watchResult.status === 'advertisement-received') {
                logger.info(`Observed advertisement for ${savedDevice.name}. Proceeding with reconnect.`);
                await this.connectWithSource(this.createDiscoveredDevice(savedDevice, restoredDevice), 'auto-connect');
                return;
            }

            if (watchResult.status === 'timeout') {
                logger.warn(`Timed out waiting for advertisements from ${savedDevice.name}.`);
                return;
            }

            if (watchResult.status === 'device-not-restored') {
                logger.warn(`Device ${savedDevice.deviceId} was not restored while preparing advertisement watch.`);
                return;
            }

            if (watchResult.status === 'unsupported') {
                logger.warn('Browser could not start advertisement watching for remembered reconnect.');
                return;
            }

            logger.error('Advertisement watch failed', watchResult.error);
        } catch (error) {
            logger.error('Web auto-connect failed', error);
        }
    }

    private async initializeNativePreferredDevice(savedDevice: ScaleDevice): Promise<void> {
        try {
            const connectedDevices = await bleAdapter.getDevices([savedDevice.deviceId]);
            const deviceAvailable = connectedDevices.find((device) => device.deviceId === savedDevice.deviceId);

            if (!deviceAvailable) {
                logger.warn(`Device ${savedDevice.deviceId} was not found in permitted devices. Skipping auto-connect.`);
                return;
            }

            await this.connectWithSource(this.createDiscoveredDevice(savedDevice, deviceAvailable), 'auto-connect');
        } catch (error) {
            logger.error('Auto-connect failed', error);
        }
    }

    private createDiscoveredDevice(savedDevice: ScaleDevice, restoredDevice?: BleDevice): DiscoveredDevice {
        return {
            id: savedDevice.deviceId,
            name: restoredDevice?.name || savedDevice.name || 'Unknown Device',
            rssi: -100,
            scaleType: savedDevice.scaleType,
            peripheral: {
                id: savedDevice.deviceId,
                name: restoredDevice?.name || savedDevice.name || 'Unknown Device',
                advertising: new ArrayBuffer(0),
                rssi: -100,
            },
        };
    }

    async connectNewDevice(): Promise<void> {
        if (this.getConnectionStatus() === 'connected') {
            logger.warn('Already connected to a device. Disconnect first.');
            return;
        }

        try {
            logger.info('Requesting device');
            const device: BleDevice = await bleAdapter.requestDevice({
                optionalServices: SCALE_OPTIONAL_SERVICES,
            });

            if (!device) {
                logger.info('No device selected');
                return;
            }

            logger.info(`Device selected: ${device.name} (${device.deviceId})`);

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
            logger.error('Failed to connect to new device', error);
            scaleStore.getState().setConnectionStatus('disconnected');
        }
    }

    async connect(device: DiscoveredDevice): Promise<void> {
        await this.connectWithSource(device, 'manual');
    }

    private async connectWithSource(device: DiscoveredDevice, _source: 'manual' | 'auto-connect' | 'reconnect'): Promise<void> {
        if (!device.scaleType) {
            throw new Error(`Device ${device.id} is not a supported scale.`);
        }

        scaleStore.getState().setConnectionStatus('connecting');

        const scaleInfo = AVAILABLE_SCALES.find((s) => s.scaleType === device.scaleType);
        if (!scaleInfo) {
            throw new Error(`Implementation for scale type ${device.scaleType} not found.`);
        }

        this.currentScale = new scaleInfo.class(device.peripheral as PeripheralData);
        if (!this.currentScale) {
            throw new Error('Failed to instantiate scale class.');
        }
        this.currentScale.setDisconnectHandler(this.handleScaleDisconnect.bind(this));
        logger.info(`Connecting to ${this.currentScale.device_name}`);

        try {
            await this.currentScale.connect();
            this.subscribeToScaleEvents();
            scaleStore.getState().setConnectionStatus('connected');
            scaleStore.getState().setConnectedDevice(device);
            this.lastDevice = device;
            this.reconnectAttempts = 0;
            logger.info(`Successfully connected to ${this.currentScale.device_name}`);

            const scaleDevice: ScaleDevice = {
                deviceId: device.id,
                name: device.name,
                address: device.id,
                isPreferred: true,
                lastConnected: new Date().toISOString(),
                scaleType: device.scaleType || undefined,
            };
            await settingsRepository.clearScaleDevices();
            await settingsRepository.saveScaleDevice(scaleDevice);

        } catch (error) {
            logger.error(`Connection to ${device.name} failed`, error);
            await this.handleDisconnect(false);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (!this.currentScale) return;
        const connectedDevice = this.getConnectedDevice();
        logger.info(`Disconnecting from ${this.currentScale.device_name}`);
        this.disconnectInProgress = true;
        try {
            await this.currentScale.disconnectTriggered();
        } catch (err) {
            logger.error('Error during scale-specific disconnect cleanup', err);
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
        return scaleStore.getState().connectionStatus;
    }

    getConnectedDevice() {
        return scaleStore.getState().connectedDevice;
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
                scaleStore.getState().setCurrentWeight(event.weight.actual);
                this.weight$.next(event.weight.actual);
            }),
            this.currentScale.tareEvent.subscribe(() => logger.debug('Tare event received')),
            this.currentScale.timerEvent.subscribe(() => logger.debug('Timer event received')),
            this.currentScale.flowChange.subscribe(() => logger.debug('Flow change event received'))
        );
    }

    private async handleDisconnect(unexpected: boolean) {
        const lastConnectedDevice = this.lastDevice;
        this.cleanup();

        scaleStore.getState().setConnectionStatus('disconnected');
        scaleStore.getState().setConnectedDevice(null);
        scaleStore.getState().setCurrentWeight(0);

        if (unexpected && lastConnectedDevice) {
            logger.warn('Unexpected disconnection. Attempting to reconnect');
            this.attemptReconnect(lastConnectedDevice);
        } else {
            logger.info('Scale disconnected');
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectAttempts = 0;
        }
    }

    private async handleScaleDisconnect(): Promise<void> {
        if (this.disconnectInProgress) {
            logger.debug('Ignoring disconnect callback during manual disconnect');
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

        logger.warn(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`);

        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connectWithSource(device, 'reconnect');
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
