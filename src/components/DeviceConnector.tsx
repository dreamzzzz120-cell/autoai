import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Plug, Unplug, RefreshCw, Send } from "lucide-react";

declare global {
  interface Navigator {
    serial?: Serial;
  }
  interface Serial {
    requestPort(options?: { filters?: Array<Record<string, number>> }): Promise<SerialPort>;
  }
  interface SerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readUntilPrompt(reader: ReadableStreamDefaultReader<Uint8Array>, timeoutMs = 4500) {
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let output = "";
  while (Date.now() < deadline) {
    const timeout = new Promise<IteratorResult<Uint8Array>>((resolve) => setTimeout(() => resolve({ done: true, value: undefined as never }), 500));
    const result = await Promise.race([reader.read(), timeout]);
    if (result.done) break;
    output += decoder.decode(result.value, { stream: true });
    if (output.includes(">")) break;
  }
  return output.replace(/[\r\n]/g, " ").replace(/\s+/g, " ").trim();
}

function hexBytes(text: string) {
  return (text.match(/\b[0-9A-F]{2}\b/gi) || []).map((x) => parseInt(x, 16));
}

function firstPidBytes(text: string, pid: string) {
  const normalized = text.toUpperCase();
  const idx = normalized.lastIndexOf(`41 ${pid}`);
  if (idx < 0) return null;
  return hexBytes(normalized.slice(idx + 5)).slice(0, 4);
}

function parsePid(pid: string, response: string): string {
  const bytes = firstPidBytes(response, pid);
  if (!bytes || bytes.length < 1) return "unavailable";
  if (pid === "0C" && bytes.length >= 2) return `${Math.round(((bytes[0] * 256) + bytes[1]) / 4)} rpm`;
  if (pid === "0D") return `${bytes[0]} km/h`;
  if (pid === "05") return `${bytes[0] - 40} °C`;
  if (pid === "0F") return `${bytes[0] - 40} °C`;
  if (pid === "11") return `${Math.round((bytes[0] * 100) / 255)}%`;
  return `raw ${bytes.slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join(" ")}`;
}

function parseDtcs(response: string) {
  const bytes = hexBytes(response.toUpperCase());
  const start = bytes.findIndex((b, i) => bytes[i - 1] === 0x43 && b !== 0x43);
  if (start < 0) return [] as string[];
  const data = bytes.slice(start);
  const codes: string[] = [];
  for (let i = 0; i + 1 < data.length; i += 2) {
    const a = data[i]; const b = data[i + 1];
    if (a === 0 && b === 0) continue;
    const type = ["P", "C", "B", "U"][a >> 6] || "P";
    const digit1 = (a >> 4) & 0x3;
    const digit2 = a & 0xf;
    codes.push(`${type}${digit1}${digit2}${(b >> 4) & 0xf}${b & 0xf}`);
  }
  return [...new Set(codes)];
}

export function DeviceConnector({ onEvidence }: { onEvidence?: (evidence: string) => Promise<void> }) {
  const [port, setPort] = useState<SerialPort | null>(null);
  const [reader, setReader] = useState<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const [status, setStatus] = useState("Disconnected");
  const [adapterInfo, setAdapterInfo] = useState("Not connected");
  const [data, setData] = useState<Record<string, string>>({});
  const [dtcs, setDtcs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const writeCommand = async (command: string) => {
    if (!port?.writable || !reader) throw new Error("Adapter is not connected");
    const writer = port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(`${command}\r`));
      await sleep(120);
      return await readUntilPrompt(reader);
    } finally {
      writer.releaseLock();
    }
  };

  const connect = async () => {
    if (!navigator.serial) {
      setStatus("Browser unsupported: use Chrome/Edge on desktop");
      return;
    }
    setBusy(true);
    try {
      setStatus("Selecting adapter…");
      const selected = await navigator.serial.requestPort();
      await selected.open({ baudRate: 38400 });
      if (!selected.readable) throw new Error("Adapter has no readable stream");
      const r = selected.readable.getReader();
      setPort(selected); setReader(r);
      setStatus("Initializing ELM327-compatible adapter…");
      const commands = ["ATZ", "ATE0", "ATL0", "ATS0", "ATSP0"];
      let info = "";
      for (const cmd of commands) info += ` ${await (async () => { const writer = selected.writable!.getWriter(); try { await writer.write(new TextEncoder().encode(`${cmd}\r`)); } finally { writer.releaseLock(); } await sleep(200); return readUntilPrompt(r, 2500); })()}`;
      setAdapterInfo(info.slice(0, 140));
      setStatus("Connected");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection failed");
      setPort(null); setReader(null);
    } finally { setBusy(false); }
  };

  const refresh = async () => {
    if (!port || !reader) return;
    setBusy(true); setStatus("Reading live data and DTCs…");
    try {
      const results: Record<string, string> = {};
      for (const pid of ["0C", "0D", "05", "0F", "11"]) results[pid] = parsePid(pid, await writeCommand(`01${pid}`));
      const dtcResponse = await writeCommand("03");
      setData(results); setDtcs(parseDtcs(dtcResponse)); setStatus("Connected · data refreshed");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Read failed"); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    try { await reader?.cancel(); } catch {}
    try { await port?.close(); } catch {}
    setReader(null); setPort(null); setStatus("Disconnected"); setAdapterInfo("Not connected"); setData({}); setDtcs([]);
  };

  const sendToDiagnosis = async () => {
    if (!onEvidence) return;
    const lines = ["REAL VEHICLE OBSERVATION — OBD-II adapter", `Adapter: ${adapterInfo}`, ...Object.entries(data).map(([pid, value]) => ({ "0C": "Engine RPM", "0D": "Vehicle speed", "05": "Coolant temperature", "0F": "Intake air temperature", "11": "Throttle position" } as Record<string, string>)[pid] + `: ${value}`), `DTCs: ${dtcs.length ? dtcs.join(", ") : "none returned"}`, "These are observed adapter values, not an AI-generated diagnosis."];
    await onEvidence(lines.join("\n"));
  };

  return <div className="glass-subtle rounded-xl border border-border/40 p-3 mb-4">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 mr-auto"><Wrench className="size-4 text-primary" /><span className="text-xs font-semibold">Vehicle Diagnostic Adapter</span><Badge variant="secondary" className="text-[10px]">OBD-II / ELM327</Badge></div>
      <span className="text-[10px] text-muted-foreground">{status}</span>
      {!port ? <Button size="sm" onClick={connect} disabled={busy}><Plug className="size-3.5 mr-1.5" />Connect</Button> : <><Button size="sm" variant="outline" onClick={refresh} disabled={busy}><RefreshCw className="size-3.5 mr-1.5" />Read vehicle</Button><Button size="sm" variant="ghost" onClick={disconnect}><Unplug className="size-3.5 mr-1.5" />Disconnect</Button></>}
    </div>
    {port && <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">{[["0C", "RPM"], ["0D", "Speed"], ["05", "Coolant"], ["0F", "IAT"], ["11", "Throttle"]].map(([pid, label]) => <div key={pid} className="rounded-lg border border-border/40 p-2"><div className="text-[10px] text-muted-foreground">{label}</div><div className="text-sm font-semibold mt-1">{data[pid] || "—"}</div></div>)}</div>}
    {port && <div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant={dtcs.length ? "destructive" : "secondary"}>DTCs: {dtcs.length ? dtcs.join(", ") : "none returned"}</Badge>{onEvidence && <Button size="sm" variant="secondary" onClick={sendToDiagnosis} disabled={!Object.keys(data).length}><Send className="size-3.5 mr-1.5" />Send observed data to diagnosis</Button>}</div>}
  </div>;
}
