export interface ScaleDevice {
    deviceId: string;
    name: string;
    address?: string; // Optional, might be same as deviceId depending on platform
    isPreferred: boolean;
    lastConnected: string; // ISO date string
    scaleType?: string; // To know which driver to use
}
