import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired rate limit rows every 10 minutes
crons.interval(
  "cleanup-expired-rate-limits",
  { minutes: 10 },
  internal.diagnostics.cleanupRateLimits,
);

export default crons;
