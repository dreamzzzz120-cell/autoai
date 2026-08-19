export type BluetoothObdReading = {
  rpm?: number;
  speedKph?: number;
  coolantC?: number;
  intakeAirC?: number;
  throttlePct?: number;
  engineLoadPct?: number;
  shortFuelTrimPct?: number;
  longFuelTrimPct?: number;
  mapKpa?: number;
  mafGps?: number;
  fuelLevelPct?: number;
  controlModuleVoltageV?: number;
  ambientTempC?: number;
  oilTempC?: number;
  engineFuelRateLph?: number;
  dtcs?: string[];
  vin?: string;
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
    case 0x04: if (bytes.length >= 1) output.engineLoadPct = (bytes[0] * 100) / 255; break;
    case 0x05: if (bytes.length >= 1) output.coolantC = bytes[0] - 40; break;
    case 0x06: if (bytes.length >= 1) output.shortFuelTrimPct = (bytes[0] - 128) * 100 / 128; break;
    case 0x07: if (bytes.length >= 1) output.longFuelTrimPct = (bytes[0] - 128) * 100 / 128; break;
    case 0x0B: if (bytes.length >= 1) output.mapKpa = bytes[0]; break;
    case 0x0C: if (bytes.length >= 2) output.rpm = ((bytes[0] * 256) + bytes[1]) / 4; break;
    case 0x0D: if (bytes.length >= 1) output.speedKph = bytes[0]; break;
    case 0x0F: if (bytes.length >= 1) output.intakeAirC = bytes[0] - 40; break;
    case 0x10: if (bytes.length >= 2) output.mafGps = ((bytes[0] * 256) + bytes[1]) / 100; break;
    case 0x11: if (bytes.length >= 1) output.throttlePct = (bytes[0] * 100) / 255; break;
    case 0x2F: if (bytes.length >= 1) output.fuelLevelPct = (bytes[0] * 100) / 255; break;
    case 0x42: if (bytes.length >= 2) output.controlModuleVoltageV = ((bytes[0] * 256) + bytes[1]) / 1000; break;
    case 0x46: if (bytes.length >= 1) output.ambientTempC = bytes[0] - 40; break;
    case 0x5C: if (bytes.length >= 1) output.oilTempC = bytes[0] - 40; break;
    case 0x5E: if (bytes.length >= 2) output.engineFuelRateLph = ((bytes[0] * 256) + bytes[1]) / 20; break;
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
  return [...new Set(result)];
}

function decodeVinResponse(line: string): string | undefined {
  const match = line.match(/(?:49|69)\s+02\s+([0-9A-Fa-f\s]+)/i);
  if (!match) return undefined;
  const bytes = parseHexPayload(match[1]);
  const ascii = bytes.map((b) => String.fromCharCode(b)).join("").replace(/[^\x20-\x7E]/g, "").trim();
  return /^[A-HJ-NPR-Z0-9]{11,17}$/.test(ascii) ? ascii : undefined;
}

export class BluetoothObdConnection {
  private device: BluetoothDevice | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private rxBuffer = "";
  private handlers = new Set<(reading: BluetoothObdReading) => void>();
  private current: BluetoothObdReading = { observedAt: 0 };
  private monitorTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;

  async connect() {
    assertBluetooth();
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ services: SERVICE_CANDIDATES }], optionalServices: SERVICE_CANDIDATES });
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
    this.stopMonitoring();
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
  };

  async disconnectDevice() {
    this.stopMonitoring();
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
      const vin = decodeVinResponse(normalized);
      if (vin) this.current.vin = vin;
      this.current.observedAt = Date.now();
      for (const handler of this.handlers) handler({ ...this.current });
    }
  };

  private async send(command: string) {
    if (!this.writeCharacteristic) throw new Error("Bluetooth OBD adapter is not connected.");
    await this.writeCharacteristic.writeValue(new TextEncoder().encode(`${command}\r`));
  }

  async readLiveData() {
    for (const command of ["0104", "0105", "0106", "0107", "010B", "010C", "010D", "010F", "0110", "0111", "012F", "0142", "0146", "015C", "015E"]) {
      await this.send(command);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }

  async readDtcs() {
    await this.send("03");
  }

  async readVin() {
    await this.send("0902");
  }

  startMonitoring(intervalMs = 1500) {
    if (this.monitorTimer) return;
    this.monitorTimer = setInterval(async () => {
      if (this.pollInFlight || !this.writeCharacteristic) return;
      this.pollInFlight = true;
      try {
        await this.readLiveData();
        await this.readDtcs();
      } finally {
        this.pollInFlight = false;
      }
    }, Math.max(750, intervalMs));
  }

  stopMonitoring() {
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    this.monitorTimer = null;
  }

  getSnapshot() {
    return { ...this.current };
  }
}
