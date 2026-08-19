import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bluetooth, Brain, Gauge, Play, Square, Send, ShieldCheck } from "lucide-react";
import { BluetoothObdConnection, type BluetoothObdReading } from "@/lib/bluetoothObd";
import { buildDiagnosticEvidence, capabilityMatrix, detectVehicleAlerts, type VehicleObservation, type VehicleSnapshot } from "@/lib/vehicleIntelligence";

function toSnapshot(reading: BluetoothObdReading): VehicleSnapshot {
  const observedAt = reading.observedAt || Date.now();
  const observations: VehicleObservation[] = [];
  const add = (key: string, value: number | undefined, unit: string) => { if (typeof value === "number" && Number.isFinite(value)) observations.push({ key, value, unit, observedAt, source: "obdii", verified: true }); };
  add("engineRpm", reading.rpm, "rpm"); add("vehicleSpeedKph", reading.speedKph, "km/h"); add("coolantC", reading.coolantC, "°C"); add("intakeAirC", reading.intakeAirC, "°C"); add("throttlePct", reading.throttlePct, "%");
  if (typeof reading.engineLoadPct === "number") add("engineLoadPct", reading.engineLoadPct, "%");
  if (typeof reading.controlModuleVoltageV === "number") add("controlModuleVoltageV", reading.controlModuleVoltageV, "V");
  if (typeof reading.fuelLevelPct === "number") add("fuelLevelPct", reading.fuelLevelPct, "%");
  if (typeof reading.oilTempC === "number") add("oilTempC", reading.oilTempC, "°C");
  if (typeof reading.fuelRateLph === "number") add("fuelRateLph", reading.fuelRateLph, "L/h");
  return { observedAt, protocol: "Bluetooth LE → ELM327-compatible OBD-II", capabilities: capabilityMatrix().map((c) => c.id.startsWith("obdii-") ? { ...c, status: "verified" } : c), observations, dtcs: reading.dtcs || [] };
}

export function VehicleIntelligencePanel({ onEvidence }: { onEvidence: (evidence: string) => void }) {
  const connectionRef = useRef<BluetoothObdConnection | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connected, setConnected] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [adapterName, setAdapterName] = useState("");
  const [reading, setReading] = useState<BluetoothObdReading>({ observedAt: 0 });
  const snapshot = useMemo(() => toSnapshot(reading), [reading]);
  const alerts = useMemo(() => detectVehicleAlerts(snapshot), [snapshot]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); void connectionRef.current?.disconnectDevice(); }, []);

  const connect = async () => {
    const connection = new BluetoothObdConnection();
    connection.onReading((next) => setReading(next));
    const result = await connection.connect();
    connectionRef.current = connection;
    setAdapterName(result.name);
    setConnected(true);
    await connection.readLiveData();
    await connection.readDtcs();
  };

  const start = async () => {
    if (!connectionRef.current) return;
    setMonitoring(true);
    await connectionRef.current.readLiveData(); await connectionRef.current.readDtcs();
    timerRef.current = setInterval(() => { void connectionRef.current?.readLiveData(); void connectionRef.current?.readDtcs(); }, 2000);
  };

  const stop = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; setMonitoring(false); };
  const disconnect = async () => { stop(); await connectionRef.current?.disconnectDevice(); connectionRef.current = null; setConnected(false); setAdapterName(""); setReading({ observedAt: 0 }); };
  const send = () => onEvidence(buildDiagnosticEvidence(snapshot, alerts));

  const fields = [
    ["RPM", reading.rpm != null ? `${Math.round(reading.rpm)}` : "—"],
    ["Speed", reading.speedKph != null ? `${Math.round(reading.speedKph)} km/h` : "—"],
    ["Coolant", reading.coolantC != null ? `${reading.coolantC.toFixed(0)} °C` : "—"],
    ["IAT", reading.intakeAirC != null ? `${reading.intakeAirC.toFixed(0)} °C` : "—"],
    ["Throttle", reading.throttlePct != null ? `${reading.throttlePct.toFixed(1)}%` : "—"],
    ["Load", reading.engineLoadPct != null ? `${reading.engineLoadPct.toFixed(1)}%` : "—"],
    ["Voltage", reading.controlModuleVoltageV != null ? `${reading.controlModuleVoltageV.toFixed(1)} V` : "—"],
    ["Fuel", reading.fuelLevelPct != null ? `${reading.fuelLevelPct.toFixed(0)}%` : "—"],
  ];

  return <div className="glass-subtle rounded-2xl border border-border/40 p-4 mb-4">
    <div className="flex flex-wrap items-center gap-2 mb-3"><Bluetooth className="size-4 text-primary" /><div className="font-semibold text-sm">Continuous Vehicle Intelligence</div><Badge variant={connected ? "secondary" : "outline"}>{connected ? "Connected" : "Disconnected"}</Badge>{monitoring && <Badge variant="secondary">Monitoring</Badge>}<span className="text-[10px] text-muted-foreground ml-auto">{adapterName || "Bluetooth OBD-II"}</span></div>
    <div className="flex flex-wrap gap-2 mb-4">{!connected ? <Button size="sm" onClick={() => void connect()}><Bluetooth className="size-3.5 mr-1.5" />Connect Bluetooth</Button> : <><Button size="sm" onClick={() => void (monitoring ? stop() : start())}>{monitoring ? <Square className="size-3.5 mr-1.5" /> : <Play className="size-3.5 mr-1.5" />}{monitoring ? "Stop monitoring" : "Start monitoring"}</Button><Button size="sm" variant="outline" onClick={send}><Send className="size-3.5 mr-1.5" />Send vehicle state to AI</Button><Button size="sm" variant="ghost" onClick={() => void disconnect()}>Disconnect</Button></>}</div>
    {connected && <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{fields.map(([label, value]) => <div key={label} className="rounded-xl border border-border/40 p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><Gauge className="size-3" />{label}</div><div className="text-sm font-semibold mt-1">{value}</div></div>)}</div>}
    {connected && <div className="mt-3 flex flex-wrap gap-2"><Badge variant={snapshot.dtcs.length ? "destructive" : "secondary">DTCs: {snapshot.dtcs.length ? snapshot.dtcs.join(", ") : "none observed"}</Badge><Badge variant="outline"><ShieldCheck className="size-3 mr-1" />Observed data only</Badge></div>}
    {alerts.length > 0 && <div className="mt-3 space-y-1">{alerts.map((a) => <div key={a.id} className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs"><AlertTriangle className="size-3.5 text-destructive mt-0.5" /><div><strong>{a.title}</strong><div className="text-muted-foreground">{a.detail}</div></div></div>)}</div>}
    <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1"><Brain className="size-3" />AutoAI analyzes what the connected interface actually exposes; unavailable ECU/proprietary data stays explicitly unavailable.</p>
  </div>;
}
