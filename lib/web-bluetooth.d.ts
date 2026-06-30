// Minimal ambient typings for the Web Bluetooth APIs used in this project.
// The full spec surface is much larger; this only covers what ChaseRunner uses.

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(
    type: "characteristicvaluechanged",
    listener: (event: Event) => void
  ): void;
  removeEventListener(
    type: "characteristicvaluechanged",
    listener: (event: Event) => void
  ): void;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(
    characteristic: string
  ): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice extends EventTarget {
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(
    type: "gattserverdisconnected",
    listener: (event: Event) => void
  ): void;
  removeEventListener(
    type: "gattserverdisconnected",
    listener: (event: Event) => void
  ): void;
}

interface RequestDeviceOptions {
  acceptAllDevices?: boolean;
  filters?: Array<Record<string, unknown>>;
  optionalServices?: string[];
}

interface Bluetooth {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}