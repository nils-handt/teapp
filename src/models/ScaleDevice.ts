import { ScaleType } from "../services/bluetooth/types/scale.types";

export interface ScaleDevice {
    deviceId: string;
    name: string;
    address?: string; // Optional, might be same as deviceId depending on platform
    isPreferred: boolean;
    lastConnected: string; // ISO date string
    scaleType: ScaleType; // To know which driver to use
}
