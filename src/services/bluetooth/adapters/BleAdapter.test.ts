import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bleAdapter } from './BleAdapter';
import { BleClient } from '@capacitor-community/bluetooth-le';

vi.mock('@capacitor-community/bluetooth-le', () => ({
    BleClient: {
        initialize: vi.fn().mockResolvedValue(undefined),
        requestLEScan: vi.fn(),
        requestDevice: vi.fn(),
        getDevices: vi.fn(),
        stopLEScan: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        write: vi.fn(),
        startNotifications: vi.fn(),
        stopNotifications: vi.fn(),
    },
}));

describe('BleAdapter.stopNotifications', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('downgrades already-disconnected GATT errors', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.mocked(BleClient.stopNotifications).mockRejectedValueOnce(
            new Error('NetworkError: Failed to execute getPrimaryService on BluetoothRemoteGATTServer: GATT Server is disconnected. Cannot retrieve services. (Re)connect first with device.gatt.connect.')
        );

        await bleAdapter.stopNotifications('scale-1', 'fff0', 'fff4');

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[BleAdapter] Notifications already stopped for characteristic fff4.'),
            expect.objectContaining({
                name: 'Error',
                message: expect.stringContaining('GATT Server is disconnected'),
            })
        );

        consoleSpy.mockRestore();
    });

    it('keeps logging unexpected stop notification failures as errors', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.mocked(BleClient.stopNotifications).mockRejectedValueOnce(
            new Error('Permission denied while stopping notifications')
        );

        await bleAdapter.stopNotifications('scale-1', 'fff0', 'fff4');

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[BleAdapter] Error stopping notifications for characteristic fff4:'),
            expect.objectContaining({
                name: 'Error',
                message: expect.stringContaining('Permission denied while stopping notifications'),
            })
        );

        consoleSpy.mockRestore();
    });
});

type WebBluetoothSupportShape = {
    requestDevice?: boolean;
    connect?: boolean;
    disconnect?: boolean;
    startNotifications?: boolean;
};

const setRequiredWebBluetoothSupport = ({
    requestDevice = false,
    connect = false,
    disconnect = false,
    startNotifications = false,
}: WebBluetoothSupportShape): void => {
    Object.defineProperty(navigator, 'bluetooth', {
        configurable: true,
        value: requestDevice ? { requestDevice: vi.fn() } : undefined,
    });

    const bluetoothRemoteGATTServerCtor = function BluetoothRemoteGATTServer() {} as unknown as {
        prototype: {
            connect?: () => void;
            disconnect?: () => void;
        };
    };
    bluetoothRemoteGATTServerCtor.prototype = {};
    if (connect) {
        bluetoothRemoteGATTServerCtor.prototype.connect = vi.fn();
    }
    if (disconnect) {
        bluetoothRemoteGATTServerCtor.prototype.disconnect = vi.fn();
    }

    Object.defineProperty(globalThis, 'BluetoothRemoteGATTServer', {
        configurable: true,
        value: bluetoothRemoteGATTServerCtor,
    });

    const bluetoothRemoteGATTCharacteristicCtor = function BluetoothRemoteGATTCharacteristic() {} as unknown as {
        prototype: {
            startNotifications?: () => void;
        };
    };
    bluetoothRemoteGATTCharacteristicCtor.prototype = {};
    if (startNotifications) {
        bluetoothRemoteGATTCharacteristicCtor.prototype.startNotifications = vi.fn();
    }

    Object.defineProperty(globalThis, 'BluetoothRemoteGATTCharacteristic', {
        configurable: true,
        value: bluetoothRemoteGATTCharacteristicCtor,
    });
};

describe('BleAdapter.getRequiredWebBluetoothSupport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setRequiredWebBluetoothSupport({});
    });

    it('reports requestDevice as missing when navigator.bluetooth.requestDevice is unavailable', () => {
        setRequiredWebBluetoothSupport({
            connect: true,
            disconnect: true,
            startNotifications: true,
        });

        expect(bleAdapter.getRequiredWebBluetoothSupport()).toEqual({
            supported: false,
            missing: ['requestDevice'],
        });
    });

    it('reports connect as missing when BluetoothRemoteGATTServer.connect is unavailable', () => {
        setRequiredWebBluetoothSupport({
            requestDevice: true,
            disconnect: true,
            startNotifications: true,
        });

        expect(bleAdapter.getRequiredWebBluetoothSupport()).toEqual({
            supported: false,
            missing: ['connect'],
        });
    });

    it('reports disconnect as missing when BluetoothRemoteGATTServer.disconnect is unavailable', () => {
        setRequiredWebBluetoothSupport({
            requestDevice: true,
            connect: true,
            startNotifications: true,
        });

        expect(bleAdapter.getRequiredWebBluetoothSupport()).toEqual({
            supported: false,
            missing: ['disconnect'],
        });
    });

    it('reports startNotifications as missing when BluetoothRemoteGATTCharacteristic.startNotifications is unavailable', () => {
        setRequiredWebBluetoothSupport({
            requestDevice: true,
            connect: true,
            disconnect: true,
        });

        expect(bleAdapter.getRequiredWebBluetoothSupport()).toEqual({
            supported: false,
            missing: ['startNotifications'],
        });
    });

    it('reports full support when all required Web Bluetooth functions are available', () => {
        setRequiredWebBluetoothSupport({
            requestDevice: true,
            connect: true,
            disconnect: true,
            startNotifications: true,
        });

        expect(bleAdapter.getRequiredWebBluetoothSupport()).toEqual({
            supported: true,
            missing: [],
        });
    });
});
