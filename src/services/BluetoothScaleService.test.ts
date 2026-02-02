import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bluetoothScaleService } from './BluetoothScaleService';
import { DiscoveredDevice, LimitedPeripheralData } from './bluetooth/types/ble.types';

vi.mock('./RealScaleService', { spy: true });
vi.mock('./MockScaleService', { spy: true });

describe('BluetoothScaleService', () => {
    let realService: any;
    let mockService: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Access private instances
        realService = (bluetoothScaleService as any).realService;
        mockService = (bluetoothScaleService as any).mockService;

        // Reset the mode to Real (default)
        (bluetoothScaleService as any).activeService = realService;
    });

    it('should be defined', () => {
        expect(bluetoothScaleService).toBeDefined();
    });

    it('should initialize successfully', async () => {
        await bluetoothScaleService.initialize();
        expect(realService.initialize).toHaveBeenCalled();
        expect(mockService.initialize).not.toHaveBeenCalled();
    });

    describe('Mode Switching', () => {
        it('should switch to mock mode', async () => {
            await bluetoothScaleService.setMockMode(true);

            expect(bluetoothScaleService.isMockMode).toBe(true);
            expect(mockService.initialize).toHaveBeenCalled();
            expect((bluetoothScaleService as any).activeService).toBe(mockService);
        });

        it('should switch back to real mode', async () => {
            await bluetoothScaleService.setMockMode(true);
            vi.clearAllMocks();

            await bluetoothScaleService.setMockMode(false);

            expect(bluetoothScaleService.isMockMode).toBe(false);
            expect(realService.initialize).toHaveBeenCalled();
            expect((bluetoothScaleService as any).activeService).toBe(realService);
        });

        it('should disconnect current service before switching', async () => {
            realService.getConnectionStatus.mockReturnValue('connected');
            await bluetoothScaleService.setMockMode(true);
            expect(realService.disconnect).toHaveBeenCalled();
        });
    });

    describe('Delegation', () => {
        const mockPeripheral: LimitedPeripheralData = {
            id: 'test', name: 'Test', advertising: new ArrayBuffer(0), rssi: -50
        };
        const device: DiscoveredDevice = {
            id: 'test', name: 'Test', rssi: -50, scaleType: null, peripheral: mockPeripheral
        };

        it('should delegate connect to active service', async () => {
            // Real mode
            expect(bluetoothScaleService.connect(device)).rejects.toThrowError();
            expect(realService.connect).toHaveBeenCalledWith(device);

            // Mock mode
            await bluetoothScaleService.setMockMode(true);
            await bluetoothScaleService.connect(device);
            expect(mockService.connect).toHaveBeenCalledWith(device);
        });

        it('should delegate disconnect to active service', async () => {
            await bluetoothScaleService.disconnect();
            expect(realService.disconnect).toHaveBeenCalled();
        });
    });

    describe('Weight Propagation', () => {
        it('should propagate weight from real service when in real mode', () => {
            const weightSpy = vi.fn();
            const sub = bluetoothScaleService.weight$.subscribe(weightSpy);

            // In real mode, use the mock's .next method
            realService.weight$.next(100);
            expect(weightSpy).toHaveBeenCalledWith(100);

            mockService.weight$.next(200);
            expect(weightSpy).not.toHaveBeenCalledWith(200);

            sub.unsubscribe();
        });

        it('should propagate weight from mock service when in mock mode', async () => {
            const weightSpy = vi.fn();
            const sub = bluetoothScaleService.weight$.subscribe(weightSpy);

            await bluetoothScaleService.setMockMode(true);

            mockService.weight$.next(300);
            expect(weightSpy).toHaveBeenCalledWith(300);

            realService.weight$.next(400);
            expect(weightSpy).not.toHaveBeenCalledWith(400);

            sub.unsubscribe();
        });
    });
});
