export type BluetoothObdReading = {
  rpm?: number;
  speedKph?: number;
  engineLoadPct?: number;
  coolantC?: number;
  intakeAirC?: number;
  throttlePct?: number;
  shortFuelTrimBank1Pct?: number;
  longFuelTrimBank1Pct?: number;
  mapKpa?: number;
  mafGps?: number;
  fuelLevelPct?: number;
  controlModuleVoltageV?: number;
  ambientAirC?: number;
  oilTempC?: number;
  fuelRateLph?: number;
  vin?: string;
  supportedPids?: number[];
  dtcs?: string[];
  observedAt: number;
};

const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const HM10_SERVICE = "0000ffe0-0000-1000-8000-00805f9b34fb";
const HM10_CHAR = "0000ffe1-0000-1000-8000-00805f9b34fb";
const SERVICE_CANDIDATES = [NUS_SERVICE, HM10_SERVICE];
const MAX_RX_BUFFER = 16 * 1024;
const MAX_LINE_LENGTH = 1024;
const COMMAND_TIMEOUT_MS = 5000;
const MIN_COMMAND_GAP_MS = 35;
const SUPPORTED_STANDARD_PIDS = ["04", "05", "06", "07", "0B", "0C", "0D", "0F", "10", "11", "2F", "42", "46", "5C", "5E"] as const;

function assertBluetooth() {
  if (typeof navigator === "undefined" || !("bluetooth" in navigator)) throw new Error("Web Bluetooth is unavailable in this browser. Use Chrome or Edge over HTTPS.");
  if (!window.isSecureContext) throw new Error("Bluetooth access requires a secure HTTPS context.");
}
export function bluetoothSupported() { return typeof navigator !== "undefined" && "bluetooth" in navigator && (typeof window === "undefined" || window.isSecureContext); }

function parseHexPayload(payload: string) {
  if (payload.length > MAX_LINE_LENGTH) return [];
  const bytes = payload.trim().split(/\s+/).filter(Boolean).map((x) => Number.parseInt(x, 16));
  return bytes.some((x) => !Number.isInteger(x) || x < 0 || x > 255) ? [] : bytes;
}

function decodeObdLine(line: string): { pid: number; bytes: number[] } | null {
  if (line.length > MAX_LINE_LENGTH) return null;
  const match = line.match(/(?:41|61)\s+([0-9A-Fa-f]{2})((?:\s+[0-9A-Fa-f]{2})+)/);
  if (!match) return null;
  return { pid: Number.parseInt(match[1], 16), bytes: parseHexPayload(match[2]) };
}

function decodePidLine(line: string, output: BluetoothObdReading) {
  const decoded = decodeObdLine(line); if (!decoded) return;
  const { pid, bytes } = decoded; const a = bytes[0];
  switch (pid) {
    case 0x04: if (a != null) output.engineLoadPct = (a * 100) / 255; break;
    case 0x05: if (a != null) output.coolantC = a - 40; break;
    case 0x06: if (a != null) output.shortFuelTrimBank1Pct = (a - 128) * 100 / 128; break;
    case 0x07: if (a != null) output.longFuelTrimBank1Pct = (a - 128) * 100 / 128; break;
    case 0x0B: if (a != null) output.mapKpa = a; break;
    case 0x0C: if (bytes.length >= 2) output.rpm = ((bytes[0] * 256) + bytes[1]) / 4; break;
    case 0x0D: if (a != null) output.speedKph = a; break;
    case 0x0F: if (a != null) output.intakeAirC = a - 40; break;
    case 0x10: if (bytes.length >= 2) output.mafGps = ((bytes[0] * 256) + bytes[1]) / 100; break;
    case 0x11: if (a != null) output.throttlePct = (a * 100) / 255; break;
    case 0x2F: if (a != null) output.fuelLevelPct = (a * 100) / 255; break;
    case 0x42: if (bytes.length >= 2) output.controlModuleVoltageV = ((bytes[0] * 256) + bytes[1]) / 1000; break;
    case 0x46: if (a != null) output.ambientAirC = a - 40; break;
    case 0x5C: if (a != null) output.oilTempC = a - 40; break;
    case 0x5E: if (bytes.length >= 2) output.fuelRateLph = ((bytes[0] * 256) + bytes[1]) / 20; break;
  }
}

function decodeDtcResponse(line: string): string[] {
  const match = line.match(/(?:43|47)\s+(.+)/i); if (!match) return [];
  const bytes = parseHexPayload(match[1]); const result: string[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const a = bytes[i], b = bytes[i + 1]; if (a === 0 && b === 0) continue;
    const type = ["P", "C", "B", "U"][a >> 6] ?? "P";
    result.push(`${type}${((a >> 4) & 0x03).toString()}${(a & 0x0f).toString(16).toUpperCase()}${((b >> 4) & 0x0f).toString(16).toUpperCase()}${(b & 0x0f).toString(16).toUpperCase()}`);
  }
  return [...new Set(result)].slice(0, 32);
}

function decodeSupportedPids(line: string): number[] {
  const match = line.match(/41\s+(00|20|40)\s+(.+)/i); if (!match) return [];
  const base = Number.parseInt(match[1], 16); const bytes = parseHexPayload(match[2]); if (bytes.length < 4) return [];
  const supported: number[] = [];
  bytes.slice(0, 4).forEach((byte, byteIndex) => { for (let bit = 7; bit >= 0; bit--) if (byte & (1 << bit)) supported.push(base + byteIndex * 8 + (8 - bit)); });
  return supported;
}

function decodeVin(line: string): string | null {
  if (!/(?:49\s+02|4A\s+02)/i.test(line)) return null;
  const bytes = (line.match(/\b[0-9A-F]{2}\b/gi) || []).map((x) => parseInt(x, 16));
  const ascii = bytes.filter((b) => b >= 0x21 && b <= 0x7e).map((b) => String.fromCharCode(b)).join("").replace(/^.*?02/, "");
  const vin = ascii.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return vin.length >= 11 && vin.length <= 17 ? vin.slice(-17) : null;
}

export class BluetoothObdConnection {
  private device: BluetoothDevice | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private rxBuffer = "";
  private handlers = new Set<(reading: BluetoothObdReading) => void>();
  private current: BluetoothObdReading = { observedAt: 0 };
  private commandChain = Promise.resolve();
  private lastCommandAt = 0;
  private closed = false;

  async connect() {
    assertBluetooth(); this.closed = false;
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: SERVICE_CANDIDATES }], optionalServices: SERVICE_CANDIDATES });
    const server = await device.gatt?.connect(); if (!server) throw new Error("Bluetooth GATT connection failed.");
    this.device = device;
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
    await this.send("ATZ", 5000);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    for (const command of ["ATE0", "ATL0", "ATS0", "ATSP0"]) await this.send(command, 2500);
    this.current = { observedAt: Date.now() };
    return { name: this.device.name || "Bluetooth OBD adapter" };
  }

  private onDisconnected = () => { this.closed = true; this.writeCharacteristic = null; this.notifyCharacteristic = null; };

  async disconnectDevice() {
    this.closed = true;
    try { await this.commandChain; } catch {}
    if (this.notifyCharacteristic) { try { await this.notifyCharacteristic.stopNotifications(); } catch {} try { this.notifyCharacteristic.removeEventListener("characteristicvaluechanged", this.onValue); } catch {} }
    this.writeCharacteristic = null; this.notifyCharacteristic = null;
    try { this.device?.gatt?.disconnect(); } catch {}
    this.device = null; this.rxBuffer = ""; this.current = { observedAt: 0 };
  }

  onReading(handler: (reading: BluetoothObdReading) => void) { this.handlers.add(handler); return () => this.handlers.delete(handler); }

  private emit() { const snapshot = { ...this.current, dtcs: this.current.dtcs ? [...this.current.dtcs] : undefined, supportedPids: this.current.supportedPids ? [...this.current.supportedPids] : undefined }; for (const handler of this.handlers) handler(snapshot); }

  private onValue = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value; if (!value || this.closed) return;
    this.rxBuffer += new TextDecoder().decode(value);
    if (this.rxBuffer.length > MAX_RX_BUFFER) this.rxBuffer = this.rxBuffer.slice(-MAX_RX_BUFFER);
    const lines = this.rxBuffer.split(/[>\r\n]+/); this.rxBuffer = lines.pop() || "";
    for (const line of lines.slice(-32)) {
      const normalized = line.trim().slice(0, MAX_LINE_LENGTH); if (!normalized) continue;
      const supported = decodeSupportedPids(normalized); if (supported.length) this.current.supportedPids = [...new Set([...(this.current.supportedPids || []), ...supported])].slice(0, 128);
      decodePidLine(normalized, this.current);
      const dtcs = decodeDtcResponse(normalized); if (dtcs.length) this.current.dtcs = dtcs;
      const vin = decodeVin(normalized); if (vin) this.current.vin = vin;
      if (decodeObdLine(normalized) || dtcs.length || supported.length || vin) { this.current.observedAt = Date.now(); this.emit(); }
    }
  };

  private async rawSend(command: string) {
    if (this.closed || !this.writeCharacteristic) throw new Error("Bluetooth OBD adapter is not connected.");
    const now = Date.now(); const delay = Math.max(0, MIN_COMMAND_GAP_MS - (now - this.lastCommandAt)); if (delay) await new Promise((r) => setTimeout(r, delay));
    await this.writeCharacteristic.writeValue(new TextEncoder().encode(`${command}\r`)); this.lastCommandAt = Date.now();
  }

  private async send(command: string, timeoutMs = COMMAND_TIMEOUT_MS) {
    const task = this.commandChain.then(async () => {
      await this.rawSend(command);
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(timeoutMs, 250)));
    });
    this.commandChain = task.catch(() => undefined);
    return task;
  }

  async readSupportedPids() { await this.send("0100"); await this.send("0120"); await this.send("0140"); }
  async readLiveData() {
    const supported = new Set(this.current.supportedPids || []);
    if (!supported.size) await this.readSupportedPids();
    for (const pid of SUPPORTED_STANDARD_PIDS) if (supported.size === 0 || supported.has(parseInt(pid, 16))) await this.send(`01${pid}`);
  }
  async readVin() { await this.send("0902"); }
  async readDtcs() { await this.send("03"); }
  getSnapshot() { return { ...this.current, dtcs: this.current.dtcs ? [...this.current.dtcs] : undefined, supportedPids: this.current.supportedPids ? [...this.current.supportedPids] : undefined }; }
}
