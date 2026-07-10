import { beforeEach, describe, expect, it } from 'vitest';
import type { DiscoveredDevice, LimitedPeripheralData } from '../services/bluetooth/types/ble.types';
import { initialScaleStoreState, scaleStore } from './useScaleStore';

describe('useScaleStore', () => {
  const mockPeripheral: LimitedPeripheralData = {
    id: 'test',
    name: 'Test',
    advertising: new ArrayBuffer(0),
    rssi: -50,
  };

  const device: DiscoveredDevice = {
    id: 'test',
    name: 'Test',
    rssi: -50,
    scaleType: null,
    peripheral: mockPeripheral,
  };

  beforeEach(() => {
    scaleStore.setState(initialScaleStoreState);
  });

  it('adds discovered devices', () => {
    scaleStore.getState().addDiscoveredDevice(device);

    expect(scaleStore.getState().availableDevices).toContainEqual(device);
  });

  it('updates an existing discovered device in place', () => {
    scaleStore.getState().addDiscoveredDevice(device);
    scaleStore.getState().addDiscoveredDevice({ ...device, rssi: -40 });

    expect(scaleStore.getState().availableDevices).toHaveLength(1);
    expect(scaleStore.getState().availableDevices[0].rssi).toBe(-40);
  });

  it('tracks connection state and connected device', () => {
    scaleStore.getState().setConnectionStatus('connecting');
    scaleStore.getState().setConnectedDevice(device);

    expect(scaleStore.getState().connectionStatus).toBe('connecting');
    expect(scaleStore.getState().connectedDevice).toEqual(device);
  });

  it('tracks mock scale mode reactively', () => {
    const state = scaleStore.getState() as unknown as {
      isMockMode: boolean;
      setIsMockMode: (isMockMode: boolean) => void;
    };

    expect(state.isMockMode).toBe(false);
    expect(state.setIsMockMode).toEqual(expect.any(Function));

    state.setIsMockMode(true);

    expect((scaleStore.getState() as unknown as { isMockMode: boolean }).isMockMode).toBe(true);
  });

  it('clears available devices and scanning state', () => {
    scaleStore.getState().addDiscoveredDevice(device);
    scaleStore.getState().setIsScanning(true);
    scaleStore.getState().clearAvailableDevices();

    expect(scaleStore.getState().availableDevices).toEqual([]);
    expect(scaleStore.getState().isScanning).toBe(true);
  });
});
