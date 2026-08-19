import type { AuthConfig } from "convex/server";

// Fail closed: authentication trust configuration must be explicit in the
// deployment environment. A production auth verifier must never silently
// fall back to a default third-party issuer.
const convexSiteUrl = process.env.CONVEX_SITE_URL;
if (!convexSiteUrl) {
  throw new Error("CONVEX_SITE_URL is required for authentication configuration");
}

const freebuffIssuer = process.env.VLY_CONVEX_AUTH_ISSUER;
if (!freebuffIssuer) {
  throw new Error("VLY_CONVEX_AUTH_ISSUER is required for federated authentication configuration");
}

// Validate the configured issuer before constructing the JWKS URL. This does
// not fetch the URL; it only prevents malformed/non-HTTPS issuer configuration.
let issuerUrl: URL;
try {
  issuerUrl = new URL(freebuffIssuer);
  if (issuerUrl.protocol !== "https:") throw new Error("issuer must use HTTPS");
} catch {
  throw new Error("VLY_CONVEX_AUTH_ISSUER must be a valid HTTPS URL");
}

export default {
  providers: [
    {
      domain: convexSiteUrl,
      applicationID: "convex",
    },
    {
      type: "customJwt",
      issuer: issuerUrl.origin,
      jwks: `${issuerUrl.origin}/api/web/.well-known/jwks.json`,
      applicationID: "vly-convex",
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
