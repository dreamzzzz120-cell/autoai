import { convexAuth } from "@convex-dev/auth/server";
import { emailOtp } from "./auth/emailOtp";

// AutoAI is authenticated-users-only. Anonymous/guest authentication is
// intentionally not registered and must never be reintroduced.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp],
});
