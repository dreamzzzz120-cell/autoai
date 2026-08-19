import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Bluetooth, Unplug, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { BluetoothObdConnection, bluetoothSupported, type BluetoothObdReading } from "@/lib/bluetoothObd";

function formatReading(reading: BluetoothObdReading) {
  return {
    rpm: reading.rpm == null ? "—" : `${Math.round(reading.rpm)} rpm`,
    speed: reading.speedKph == null ? "—" : `${Math.round(reading.speedKph)} km/h`,
    coolant: reading.coolantC == null ? "—" : `${reading.coolantC.toFixed(0)} °C`,
    intake: reading.intakeAirC == null ? "—" : `${reading.intakeAirC.toFixed(0)} °C`,
    throttle: reading.throttlePct == null ? "—" : `${reading.throttlePct.toFixed(0)}%`,
  };
}

export function DeviceConnector({ onEvidence }: { onEvidence?: (evidence: string) => Promise<void> }) {
  const connectionRef = useRef<BluetoothObdConnection | null>(null);
  const [status, setStatus] = useState("Disconnected");
  const [adapterName, setAdapterName] = useState("Not connected");
  const [reading, setReading] = useState<BluetoothObdReading>({ observedAt: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const connection = new BluetoothObdConnection();
    connectionRef.current = connection;
    const unsubscribe = connection.onReading((next) => setReading(next));
    return () => {
      unsubscribe();
      void connection.disconnectDevice();
    };
  }, []);

  const connect = async () => {
    if (!bluetoothSupported()) {
      setStatus("Bluetooth unavailable — use Chrome/Edge on HTTPS");
      return;
    }
    setBusy(true);
    try {
      setStatus("Choose your Bluetooth OBD adapter…");
      const result = await connectionRef.current!.connect();
      setAdapterName(result.name);
      setStatus("Bluetooth connected");
      await connectionRef.current!.readLiveData();
      await connectionRef.current!.readDtcs();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bluetooth connection failed");
      await connectionRef.current?.disconnectDevice();
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    const connection = connectionRef.current;
    if (!connection) return;
    setBusy(true);
    setStatus("Reading live vehicle data…");
    try {
      await connection.readLiveData();
      await connection.readDtcs();
      setStatus("Bluetooth connected · data refreshed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Read failed");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await connectionRef.current?.disconnectDevice();
    setAdapterName("Not connected");
    setReading({ observedAt: 0 });
    setStatus("Disconnected");
  };

  const sendToDiagnosis = async () => {
    if (!onEvidence) return;
    const values = formatReading(reading);
    const evidence = [
      "REAL VEHICLE OBSERVATION — Bluetooth OBD-II adapter",
      `Adapter: ${adapterName}`,
      `Engine RPM: ${values.rpm}`,
      `Vehicle speed: ${values.speed}`,
      `Coolant temperature: ${values.coolant}`,
      `Intake air temperature: ${values.intake}`,
      `Throttle position: ${values.throttle}`,
      `DTCs: ${reading.dtcs?.length ? reading.dtcs.join(", ") : "none returned"}`,
      `Observed at: ${new Date(reading.observedAt || Date.now()).toISOString()}`,
      "These are observed adapter values, not an AI-generated diagnosis.",
    ];
    await onEvidence(evidence.join("\n"));
  };

  const values = formatReading(reading);
  const connected = adapterName !== "Not connected";

  return (
    <div className="glass-subtle rounded-xl border border-border/40 p-3 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 mr-auto">
          <Wrench className="size-4 text-primary" />
          <span className="text-xs font-semibold">Vehicle Diagnostic Adapter</span>
          <Badge variant="secondary" className="text-[10px]">Bluetooth OBD-II</Badge>
        </div>
        <span className="text-[10px] text-muted-foreground">{status}</span>
        {!connected ? (
          <Button size="sm" onClick={connect} disabled={busy}>
            <Bluetooth className="size-3.5 mr-1.5" />
            Connect Bluetooth
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
              <RefreshCw className="size-3.5 mr-1.5" />
              Read vehicle
            </Button>
            <Button size="sm" variant="ghost" onClick={disconnect} disabled={busy}>
              <Unplug className="size-3.5 mr-1.5" />
              Disconnect
            </Button>
          </>
        )}
      </div>

      {connected && (
        <>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="size-3 text-primary" />
            Connected to: {adapterName}
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              ["RPM", values.rpm],
              ["Speed", values.speed],
              ["Coolant", values.coolant],
              ["IAT", values.intake],
              ["Throttle", values.throttle],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border/40 p-2">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="text-sm font-semibold mt-1">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={reading.dtcs?.length ? "destructive" : "secondary"}>
              DTCs: {reading.dtcs?.length ? reading.dtcs.join(", ") : "none returned"}
            </Badge>
            {onEvidence && (
              <Button size="sm" variant="secondary" onClick={sendToDiagnosis} disabled={!reading.observedAt}>
                <Send className="size-3.5 mr-1.5" />
                Send observed data to diagnosis
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
