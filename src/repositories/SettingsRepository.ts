import { AppDataSource } from '../database/dataSource';
import { ScaleDevice } from '../entities/ScaleDevice.entity';
import { Settings } from '../entities/Settings.entity';
import { Repository } from 'typeorm';

const PREFERRED_DEVICE_KEY = 'teapp_preferred_device_id';

class SettingsRepository {
    private static instance: SettingsRepository;
    private settingsRepo: Repository<Settings>;
    private scaleDeviceRepo: Repository<ScaleDevice>;

    private constructor() {
        this.settingsRepo = AppDataSource.getRepository(Settings);
        this.scaleDeviceRepo = AppDataSource.getRepository(ScaleDevice);
    }

    public static getInstance(): SettingsRepository {
        if (!SettingsRepository.instance) {
            SettingsRepository.instance = new SettingsRepository();
        }
        return SettingsRepository.instance;
    }

    async getPreferredDeviceId(): Promise<string | null> {
        const setting = await this.settingsRepo.findOne({ where: { key: PREFERRED_DEVICE_KEY } });
        return setting ? setting.value : null;
    }

    async setPreferredDeviceId(deviceId: string): Promise<void> {
        const setting = new Settings();
        setting.key = PREFERRED_DEVICE_KEY;
        setting.value = deviceId;
        await this.settingsRepo.save(setting);
    }

    async getScaleDevice(deviceId: string): Promise<ScaleDevice | null> {
        return this.scaleDeviceRepo.findOne({ where: { deviceId } });
    }

    async clearScaleDevices(): Promise<void> {
        await this.scaleDeviceRepo.clear();
    }

    async saveScaleDevice(device: ScaleDevice): Promise<void> {
        await this.scaleDeviceRepo.save(device);

        if (device.isPreferred) {
            await this.setPreferredDeviceId(device.deviceId);
        }
    }

    async getKnownDevices(): Promise<ScaleDevice[]> {
        return this.scaleDeviceRepo.find();
    }

    // General Settings Methods

    async saveSetting(key: string, value: string): Promise<void> {
        const setting = new Settings();
        setting.key = key;
        setting.value = value;
        await this.settingsRepo.save(setting);
    }

    async getSetting(key: string): Promise<string | null> {
        const setting = await this.settingsRepo.findOne({ where: { key } });
        return setting ? setting.value : null;
    }

    async getAllSettings(): Promise<Record<string, string>> {
        const settings = await this.settingsRepo.find();
        return settings.reduce((acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
        }, {} as Record<string, string>);
    }

    async saveSettingsState(settings: Record<string, unknown>): Promise<void> {
        const promises = Object.entries(settings).map(([key, value]) => {
            let stringValue = '';
            if (typeof value === 'string') {
                stringValue = value;
            } else {
                stringValue = JSON.stringify(value);
            }
            return this.saveSetting(key, stringValue);
        });
        await Promise.all(promises);
    }
}

export const settingsRepository = SettingsRepository.getInstance();
