export type UUID = string;

export enum Property {
  READ = 'read',
  WRITE = 'write',
  WRITE_WITHOUT_RESPONSE = 'writeWithoutResponse',
  NOTIFY = 'notify',
}

export interface Descriptor {
  uuid: UUID;
  value?: any; // Adjust based on actual usage
}

export interface Characteristic {
  service: UUID;
  characteristic: UUID;
  properties: Property[];
  descriptors?: Descriptor[];
}

export interface IOSAdvertisingData {
  localName: string;
  txPowerLevel: number;
  isConnectable: boolean;
  serviceUUIDs: UUID[];
}

export interface LimitedPeripheralData {
  name: string;
  id: string;
  advertising: ArrayBuffer | IOSAdvertisingData;
  rssi: number;
}

export interface PeripheralData extends LimitedPeripheralData {
  services: UUID[];
  characteristics: Characteristic[];
}
