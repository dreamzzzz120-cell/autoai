import fixtures from "./vehicle-fixtures.json" with { type: "json" };

const allowedOperations = new Set([
  "vehicle_info",
  "supported_pids",
  "current_data",
  "freeze_frame",
  "stored_dtcs",
  "pending_dtcs",
  "permanent_dtcs",
  "readiness",
  "monitor_results",
]);

export function createSimulator(fixture) {
  return {
    async read(operation) {
      if (!allowedOperations.has(operation)) throw new Error(`Blocked scan operation: ${operation}`);
      const obd = fixture.obd;
      if (operation === "stored_dtcs" || operation === "pending_dtcs" || operation === "permanent_dtcs") return { dtcs: obd.dtcs };
      if (operation === "freeze_frame") return obd.freezeFrame;
      if (operation === "current_data") return obd.liveData;
      if (operation === "readiness") return obd.readiness;
      if (operation === "vehicle_info") return fixture.vehicle;
      return {};
    },
  };
}

for (const fixture of fixtures.fixtures) {
  const scanner = createSimulator(fixture);
  const codes = await scanner.read("stored_dtcs");
  const live = await scanner.read("current_data");
  console.log(`${fixture.id}: DTCs=${codes.dtcs.join(",") || "none"}; live=${JSON.stringify(live)}`);
}
