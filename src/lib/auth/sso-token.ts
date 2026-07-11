import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 60_000;

function secret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "insecure-dev-sso-token-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * Mint a short-lived, server-signed token after an external (LDAP/SAML)
 * identity provider has authenticated the user. This replaces the previous
 * `_ssoVerified` credential flag, which was client-supplied and therefore
 * forgeable: any caller could request SSO login for an arbitrary email.
 *
 * The token is never exposed to the browser; it is only passed internally to
 * the credentials `authorize` step from the trusted SSO route handler.
 */
export function createSsoToken(email: string, provider: "ldap" | "saml"): string {
  const payload = Buffer.from(
    JSON.stringify({ email, provider, exp: Date.now() + TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export type VerifiedSso = { email: string; provider: string };

export function verifySsoToken(token: string | undefined | null): VerifiedSso | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
      provider?: string;
      exp?: number;
    };
    if (!data.email || typeof data.exp !== "number") return null;
    if (data.exp < Date.now()) return null;
    return { email: data.email, provider: data.provider ?? "unknown" };
  } catch {
    return null;
  }
}
