import { ScaleDevice } from '../models/ScaleDevice';

const PREFERRED_DEVICE_KEY = 'teapp_preferred_device_id';
const KNOWN_DEVICES_KEY = 'teapp_known_devices';

class SettingsRepository {
    private static instance: SettingsRepository;

    private constructor() { }

    public static getInstance(): SettingsRepository {
        if (!SettingsRepository.instance) {
            SettingsRepository.instance = new SettingsRepository();
        }
        return SettingsRepository.instance;
    }

    async getPreferredDeviceId(): Promise<string | null> {
        return localStorage.getItem(PREFERRED_DEVICE_KEY);
    }

    async setPreferredDeviceId(deviceId: string): Promise<void> {
        localStorage.setItem(PREFERRED_DEVICE_KEY, deviceId);
    }

    async getScaleDevice(deviceId: string): Promise<ScaleDevice | null> {
        const devices = await this.getKnownDevices();
        return devices.find(d => d.deviceId === deviceId) || null;
    }

    async saveScaleDevice(device: ScaleDevice): Promise<void> {
        const devices = await this.getKnownDevices();
        const index = devices.findIndex(d => d.deviceId === device.deviceId);

        if (index >= 0) {
            devices[index] = device;
        } else {
            devices.push(device);
        }

        localStorage.setItem(KNOWN_DEVICES_KEY, JSON.stringify(devices));

        if (device.isPreferred) {
            await this.setPreferredDeviceId(device.deviceId);
        }
    }

    async getKnownDevices(): Promise<ScaleDevice[]> {
        const json = localStorage.getItem(KNOWN_DEVICES_KEY);
        if (!json) return [];
        try {
            return JSON.parse(json);
        } catch (e) {
            console.error('Failed to parse known devices', e);
            return [];
        }
    }
}

export const settingsRepository = SettingsRepository.getInstance();
