import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const nhtsaBase = "https://api.nhtsa.gov";

function clean(value: string, max = 120) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
}

export const lookupVehicleEvidence = action({
  args: { year: v.number(), make: v.string(), model: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {});
    if (!user) throw new Error("Authentication required");
    const year = Math.trunc(args.year);
    if (year < 1981 || year > 2100) throw new Error("Invalid model year");
    const make = clean(args.make);
    const model = clean(args.model);
    if (!make || !model) throw new Error("Make and model are required");
    const url = `${nhtsaBase}/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Recall service unavailable");
    const data = await response.json();
    return { source: "NHTSA", sourceType: "government_recall_database", retrievedAt: Date.now(), vehicle: { year, make, model }, recalls: Array.isArray(data.results) ? data.results.slice(0, 50) : [], verified: true };
  },
});

export const decodeVin = action({
  args: { vin: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {});
    if (!user) throw new Error("Authentication required");
    const vin = clean(args.vin, 17).toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error("Invalid VIN");
    const response = await fetch(`${nhtsaBase}/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("VIN service unavailable");
    const data = await response.json();
    const row = Array.isArray(data.Results) ? data.Results[0] : null;
    return { source: "NHTSA vPIC", retrievedAt: Date.now(), vin, vehicle: row, verified: Boolean(row) };
  },
});
