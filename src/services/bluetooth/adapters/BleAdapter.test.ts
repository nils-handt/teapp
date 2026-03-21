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
