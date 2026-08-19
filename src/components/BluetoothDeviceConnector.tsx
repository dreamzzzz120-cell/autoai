import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bluetooth, Link2, Link2Off, Play, Square, Send } from "lucide-react";
import { BluetoothObdConnection, bluetoothSupported, type BluetoothObdReading } from "@/lib/bluetoothObd";

function fmt(value: number | undefined, suffix = "") { return value == null ? "—" : `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}${suffix}`; }

export function BluetoothDeviceConnector({ onEvidence }: { onEvidence?: (evidence: string) => Promise<void> }) {
  const connection = useRef<BluetoothObdConnection | null>(null);
  const [supported, setSupported] = useState(false);
  const [connected, setConnected] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [name, setName] = useState("Bluetooth OBD adapter");
  const [reading, setReading] = useState<BluetoothObdReading>({ observedAt: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    setSupported(bluetoothSupported());
    return () => { connection.current?.disconnectDevice().catch(() => {}); };
  }, []);

  const connect = async () => {
    setError("");
    try {
      const c = new BluetoothObdConnection();
      const info = await c.connect();
      connection.current = c;
      c.onReading(setReading);
      setName(info.name);
      setConnected(true);
      await c.readVin();
      await c.readLiveData();
      await c.readDtcs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bluetooth connection failed");
      await connection.current?.disconnectDevice().catch(() => {});
      connection.current = null;
      setConnected(false);
    }
  };

  const toggleMonitoring = () => {
    const c = connection.current;
    if (!c) return;
    if (monitoring) { c.stopMonitoring(); setMonitoring(false); }
    else { c.startMonitoring(1500); setMonitoring(true); }
  };

  const disconnect = async () => {
    const c = connection.current;
    connection.current = null;
    setMonitoring(false);
    setConnected(false);
    await c?.disconnectDevice().catch(() => {});
  };

  const sendEvidence = async () => {
    if (!onEvidence) return;
    const lines = [
      "REAL VEHICLE OBSERVATION — Bluetooth OBD-II continuous monitor",
      `Adapter: ${name}`,
      reading.vin ? `VIN observed: ${reading.vin}` : "VIN: not exposed by adapter/vehicle",
      `Engine RPM: ${fmt(reading.rpm)}`,
      `Vehicle speed: ${fmt(reading.speedKph, " km/h")}`,
      `Engine load: ${fmt(reading.engineLoadPct, "%")}`,
      `Coolant: ${fmt(reading.coolantC, " °C")}`,
      `Intake air: ${fmt(reading.intakeAirC, " °C")}`,
      `MAP: ${fmt(reading.mapKpa, " kPa")}`,
      `MAF: ${fmt(reading.mafGps, " g/s")}`,
      `Throttle: ${fmt(reading.throttlePct, "%")}`,
      `STFT B1: ${fmt(reading.shortFuelTrimPct, "%")}`,
      `LTFT B1: ${fmt(reading.longFuelTrimPct, "%")}`,
      `Fuel level: ${fmt(reading.fuelLevelPct, "%")}`,
      `Module voltage: ${fmt(reading.controlModuleVoltageV, " V")}`,
      `Ambient: ${fmt(reading.ambientTempC, " °C")}`,
      `Oil temperature: ${fmt(reading.oilTempC, " °C")}`,
      `Engine fuel rate: ${fmt(reading.engineFuelRateLph, " L/h")}`,
      `DTCs observed: ${reading.dtcs?.length ? reading.dtcs.join(", ") : "none returned"}`,
      `Observed at: ${new Date(reading.observedAt || Date.now()).toISOString()}`,
      "These are adapter-observed values. Do not treat unavailable fields as zero or as evidence that a component is healthy.",
    ];
    await onEvidence(lines.join("\n"));
  };

  return <div className="glass-subtle rounded-xl border border-border/40 p-3 mb-4">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 mr-auto"><Bluetooth className="size-4 text-primary" /><span className="text-xs font-semibold">Bluetooth Vehicle Monitor</span><Badge variant="secondary" className="text-[10px]">BLE / ELM327</Badge></div>
      {!supported && <span className="text-[10px] text-muted-foreground">Use Chrome/Edge over HTTPS</span>}
      {supported && !connected && <Button size="sm" onClick={connect}><Link2 className="size-3.5 mr-1.5" />Connect</Button>}
      {connected && <><Button size="sm" variant={monitoring ? "destructive" : "outline"} onClick={toggleMonitoring}>{monitoring ? <><Square className="size-3.5 mr-1.5" />Stop monitoring</> : <><Play className="size-3.5 mr-1.5" />Continuous monitor</>}</Button><Button size="sm" variant="ghost" onClick={disconnect}><Link2Off className="size-3.5 mr-1.5" />Disconnect</Button></>}
    </div>
    {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    {connected && <><div className="mt-3 text-[10px] text-muted-foreground">{name} · {monitoring ? "monitoring every ~1.5s" : "connected"}{reading.vin ? ` · VIN ${reading.vin}` : ""}</div><div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2">{[["RPM", fmt(reading.rpm)], ["Speed", fmt(reading.speedKph, " km/h")], ["Coolant", fmt(reading.coolantC, " °C")], ["Throttle", fmt(reading.throttlePct, "%")], ["Voltage", fmt(reading.controlModuleVoltageV, " V")]].map(([label, value]) => <div key={label} className="rounded-lg border border-border/40 p-2"><div className="text-[10px] text-muted-foreground">{label}</div><div className="text-sm font-semibold mt-1">{value}</div></div>)}</div><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant={reading.dtcs?.length ? "destructive" : "secondary"}>DTCs: {reading.dtcs?.length ? reading.dtcs.join(", ") : "none returned"}</Badge>{onEvidence && <Button size="sm" variant="secondary" onClick={sendEvidence}><Send className="size-3.5 mr-1.5" />Send vehicle state to diagnosis</Button>}</div></>}
  </div>;
}
