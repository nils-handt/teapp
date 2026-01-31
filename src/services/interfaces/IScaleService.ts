import { Observable } from 'rxjs';
import { DiscoveredDevice } from '../bluetooth/types/ble.types';

export interface IScaleService {
    weight$: Observable<number>;
    connect(device: DiscoveredDevice): Promise<void>;
    disconnect(): Promise<void>;
    tare(): Promise<void>;
    getConnectionStatus(): string;
    getConnectedDevice(): DiscoveredDevice | null;
    initialize(): Promise<void>;
    connectNewDevice(): Promise<void>;
}
