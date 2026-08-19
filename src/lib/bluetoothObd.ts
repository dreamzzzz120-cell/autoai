export type BluetoothObdReading = {
  rpm?: number;
  speedKph?: number;
  coolantC?: number;
  intakeAirC?: number;
  throttlePct?: number;
  dtcs?: string[];
  observedAt: number;
};

const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const HM10_SERVICE = "0000ffe0-0000-1000-8000-00805f9b34fb";
const HM10_CHAR = "0000ffe1-0000-1000-8000-00805f9b34fb";
const SERVICE_CANDIDATES = [NUS_SERVICE, HM10_SERVICE];

function assertBluetooth() {
  if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
    throw new Error("Web Bluetooth is unavailable in this browser. Use Chrome or Edge over HTTPS.");
  }
}

export function bluetoothSupported() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

function parseHexPayload(payload: string) {
  const bytes = payload.trim().split(/\s+/).filter(Boolean).map((x) => Number.parseInt(x, 16));
  return bytes.some((x) => Number.isNaN(x)) ? [] : bytes;
}

function decodeObdLine(line: string): { pid: number; bytes: number[] } | null {
  const match = line.match(/(?:41|61)\s+([0-9A-Fa-f]{2})((?:\s+[0-9A-Fa-f]{2})+)/);
  if (!match) return null;
  return { pid: Number.parseInt(match[1], 16), bytes: parseHexPayload(match[2]) };
}

function decodePidLine(line: string, output: BluetoothObdReading) {
  const decoded = decodeObdLine(line);
  if (!decoded) return;
  const { pid, bytes } = decoded;
  switch (pid) {
    case 0x0c:
      if (bytes.length >= 2) output.rpm = ((bytes[0] * 256) + bytes[1]) / 4;
      break;
    case 0x0d:
      if (bytes.length >= 1) output.speedKph = bytes[0];
      break;
    case 0x05:
      if (bytes.length >= 1) output.coolantC = bytes[0] - 40;
      break;
    case 0x0f:
      if (bytes.length >= 1) output.intakeAirC = bytes[0] - 40;
      break;
    case 0x11:
      if (bytes.length >= 1) output.throttlePct = (bytes[0] * 100) / 255;
      break;
  }
}

function decodeDtcResponse(line: string): string[] {
  const match = line.match(/(?:43|47)\s+(.+)/i);
  if (!match) return [];
  const bytes = parseHexPayload(match[1]);
  const result: string[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const a = bytes[i];
    const b = bytes[i + 1];
    if (a === 0 && b === 0) continue;
    const type = ["P", "C", "B", "U"][a >> 6] ?? "P";
    const digit1 = ((a >> 4) & 0x03).toString();
    const digit2 = (a & 0x0f).toString(16).toUpperCase();
    result.push(`${type}${digit1}${digit2}${((b >> 4) & 0x0f).toString(16).toUpperCase()}${(b & 0x0f).toString(16).toUpperCase()}`);
  }
  return result;
}

export class BluetoothObdConnection {
  private device: BluetoothDevice | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private rxBuffer = "";
  private handlers = new Set<(reading: BluetoothObdReading) => void>();
  private current: BluetoothObdReading = { observedAt: 0 };

  async connect() {
    assertBluetooth();
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: SERVICE_CANDIDATES }],
      optionalServices: SERVICE_CANDIDATES,
    });
    const server = await this.device.gatt?.connect();
    if (!server) throw new Error("Bluetooth GATT connection failed.");

    try {
      const service = await server.getPrimaryService(NUS_SERVICE);
      this.writeCharacteristic = await service.getCharacteristic(NUS_RX);
      this.notifyCharacteristic = await service.getCharacteristic(NUS_TX);
    } catch {
      const service = await server.getPrimaryService(HM10_SERVICE);
      this.writeCharacteristic = await service.getCharacteristic(HM10_CHAR);
      this.notifyCharacteristic = this.writeCharacteristic;
    }

    await this.notifyCharacteristic.startNotifications();
    this.notifyCharacteristic.addEventListener("characteristicvaluechanged", this.onValue);
    this.device.addEventListener("gattserverdisconnected", this.onDisconnected);

    await this.send("ATZ");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await this.send("ATE0");
    await this.send("ATL0");
    await this.send("ATS0");
    await this.send("ATSP0");
    this.current = { observedAt: Date.now() };
    return { name: this.device.name || "Bluetooth OBD adapter" };
  }

  private onDisconnected = () => {
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
  };

  async disconnectDevice() {
    if (this.notifyCharacteristic) {
      try { await this.notifyCharacteristic.stopNotifications(); } catch {}
      this.notifyCharacteristic.removeEventListener("characteristicvaluechanged", this.onValue);
    }
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    this.device?.gatt?.disconnect();
    this.device = null;
  }

  onReading(handler: (reading: BluetoothObdReading) => void) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private onValue = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    this.rxBuffer += new TextDecoder().decode(value);
    const lines = this.rxBuffer.split(/[>\r\n]+/);
    this.rxBuffer = lines.pop() || "";
    for (const line of lines) {
      const normalized = line.trim();
      if (!normalized) continue;
      decodePidLine(normalized, this.current);
      const dtcs = decodeDtcResponse(normalized);
      if (dtcs.length) this.current.dtcs = dtcs;
      this.current.observedAt = Date.now();
      for (const handler of this.handlers) handler({ ...this.current });
    }
  };

  private async send(command: string) {
    if (!this.writeCharacteristic) throw new Error("Bluetooth OBD adapter is not connected.");
    await this.writeCharacteristic.writeValue(new TextEncoder().encode(`${command}\r`));
  }

  async readLiveData() {
    await this.send("010C");
    await this.send("010D");
    await this.send("0105");
    await this.send("010F");
    await this.send("0111");
  }

  async readDtcs() {
    await this.send("03");
  }

  getSnapshot() {
    return { ...this.current };
  }
}
