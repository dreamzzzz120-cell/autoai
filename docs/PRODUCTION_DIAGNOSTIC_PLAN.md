# AutoAI Production Diagnostic Standard

## Evidence hierarchy
1. Machine identity: VIN or manufacturer/year/model/engine/variant.
2. Direct observations: DTCs, freeze-frame, live data, measurements, photos, verified audio features.
3. Authoritative evidence: OEM service information, TSBs, recalls, regulatory data.
4. Diagnostic reasoning: competing hypotheses and discriminating tests.
5. Repair recommendation only after evidence crosses the required gate.

## OEM/service information
AutoAI must never invent a manual, page, torque, wiring pinout, specification, TSB or part number. OEM information must be retrieved from a licensed source or supplied by the technician/customer. Government sources may be used for recalls, VIN decoding and public safety information. NHTSA exposes vehicle decoding and recall APIs; its API policy prohibits bulk VIN lookup use. See the NHTSA sources in the architecture notes.

## DTC/OBD
The OBD evidence model records DTCs, freeze-frame, readiness and live-data snapshots separately. A DTC is an observation, not a failed-part verdict. OBD-II diagnostic modes include current data, freeze-frame, DTCs, clearing information, monitoring results and vehicle information; AutoAI must respect the capabilities actually returned by the connected tool.

## Scan-tool architecture
Use a hardware adapter/bridge outside the Convex backend. The bridge communicates with the vehicle and sends normalized, signed snapshots to AutoAI. AutoAI never sends arbitrary actuator commands from the LLM. Any bidirectional control requires an explicit, technician-confirmed workflow with manufacturer-specific safety checks.

## Diagnostic trees
A tree must select the smallest safe test that separates hypotheses. It must preserve conflicting evidence and never skip machine identity for vehicle-specific procedures.

## Audio
Until an acoustic model is integrated, label uploaded audio as transcription only. True mechanical acoustic diagnosis requires waveform/feature extraction, a controlled dataset, vehicle/component labels, noise handling and benchmark validation.

## Privacy
Users can request deletion. Diagnostic sessions, messages, claims, rate-limit state and user-linked audit data must be removed according to the retention policy. Storage objects must be garbage-collected when no longer referenced.

## AI budget
Every AI Action is subject to user/hour/day request limits and an estimated token budget before provider invocation. Provider rate limits are not a substitute for application-level budgets.

## Testing
CI must run typecheck/build, security guard, adversarial diagnostic tests, authorization tests, malformed-model-output tests, upload tests and production smoke tests. Real-vehicle validation is performed only on controlled, stationary equipment with a qualified technician.

## Production gate
Production is blocked until the deployed build passes health, authentication, diagnostic Action, evidence retrieval, upload, deletion, rate-limit and adversarial smoke tests. No test may claim a vehicle was diagnosed without observed evidence.
