/**
 * TOTP two-factor authentication.
 *
 * Implements RFC 6238 (TOTP) with SHA-1 (most compatible across Google
 * Authenticator, Authy, Bitwarden, etc.). Secrets are encrypted at rest
 * using the instance crypto key (AES-256-GCM via lib/crypto/encrypt.ts).
 *
 * Flows:
 *   Enrollment: POST /api/v1/auth/2fa/enroll
 *     → Generates a TOTP secret, returns QR-code URI + plaintext secret.
 *   Verify enrollment: POST /api/v1/auth/2fa/enroll/verify { token }
 *     → Verifies the token against the pending secret, enables 2FA on the user,
 *       generates and returns 8 recovery codes (hashed for DB storage).
 *   Disable: POST /api/v1/auth/2fa/disable { password }
 *     → Re-validates password, clears 2FA fields.
 *   Login step: POST /api/v1/auth/2fa/verify { tempToken, token }
 *     → Verifies TOTP, issues session. Handled in credentials provider flow.
 */

import { createHmac, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";

/** Number of recovery codes issued on enrollment. */
const RECOVERY_CODE_COUNT = 8;
/** Seconds of drift tolerance (1 tick = 30 s → 1 tick before/after). */
const DRIFT_TOLERANCE = 1;

/**
 * Generate a new TOTP secret (20 bytes, base32).
 * Label and issuer are used only for the QR-code URI.
 */
export function generateSecret(): string {
  // 20 bytes → 32-char base32
  return base32Encode(randomBytes(20));
}

/**
 * Build an `otpauth://` URI that authenticator apps scan as a QR code.
 */
export function generateQrCodeUri(label: string, issuer: string, secret: string): string {
  const encodedLabel = encodeURIComponent(label);
  const encodedIssuer = encodeURIComponent(issuer);
  const params = new URLSearchParams({ secret, issuer: encodedIssuer });
  return `otpauth://totp/${encodedIssuer}:${encodedLabel}?${params.toString()}`;
}

/**
 * Verify a TOTP token against a secret. Returns true if the token is valid
 * at `now` (± DRIFT_TOLERANCE 30-second intervals).
 */
export function verifyTotp(secret: string, token: string, now: number = Date.now()): boolean {
  if (token.length !== 6 || !/^\d{6}$/.test(token)) return false;

  const key = base32Decode(secret);
  const currentWindow = Math.floor(now / 30000);

  for (let offset = -DRIFT_TOLERANCE; offset <= DRIFT_TOLERANCE; offset++) {
    if (computeTotp(key, currentWindow + offset) === token) return true;
  }

  return false;
}

/** RFC 6238 TOTP = HOTP(time-based counter, key). */
function computeTotp(key: Buffer, counter: number): string {
  return hotp(key, counter, 6);
}

/**
 * Generate the TOTP code valid for `now` (RFC 6238, 30 s window).
 * Exported for e2e tests and automations that must produce a code for a
 * known secret (e.g. enrollment verification in Playwright).
 */
export function generateTotpToken(secret: string, now: number = Date.now()): string {
  const key = base32Decode(secret);
  const currentWindow = Math.floor(now / 30000);
  return computeTotp(key, currentWindow);
}

/** RFC 4226 HMAC-based OTP. */
function hotp(key: Buffer, counter: number, digits: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  return (binCode % Math.pow(10, digits)).toString().padStart(digits, "0");
}

/**
 * Generate NUM recovery codes. Each is 12 alphanumeric chars.
 * Returns [plaintext codes] and [SHA-256 hashes] (store the latter).
 */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): {
  plain: string[];
  hashed: string[];
} {
  const plain: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = randomBytes(9).toString("base64url").slice(0, 12);
    plain.push(code);
    hashed.push(createHash("sha256").update(code).digest("hex"));
  }

  return { plain, hashed };
}

/**
 * Verify a recovery code against the stored hashes. If valid, remove it
 * from the user's recovery-codes array and return true. Single-use.
 */
export async function verifyRecoveryCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const codeHash = createHash("sha256").update(code).digest("hex");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpRecoveryCodesHashed: true },
  });

  if (!user?.totpRecoveryCodesHashed?.length) return false;

  // constant-time-ish: scan all, then filter out the match
  let found = false;
  const remaining = user.totpRecoveryCodesHashed.filter((h) => {
    if (h === codeHash) {
      found = true;
      return false;
    }
    return true;
  });

  if (!found) return false;

  await prisma.user.update({
    where: { id: userId },
    data: { totpRecoveryCodesHashed: remaining },
  });

  return true;
}

/**
 * Enroll a user: generate secret, encrypt it, store on user, return URI.
 */
export async function enrollTotp(
  userId: string,
  email: string,
): Promise<{ secret: string; uri: string }> {
  const secret = generateSecret();
  const encrypted = JSON.stringify(encrypt(secret));
  const uri = generateQrCodeUri(email, "uTask", secret);

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encrypted },
  });

  return { secret, uri };
}

/**
 * Confirm enrollment: verify token, enable 2FA, issue recovery codes.
 */
export async function confirmTotpEnrollment(
  userId: string,
  token: string,
): Promise<{ plainCodes: string[] } | { error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user?.totpSecret) return { error: "No TOTP secret pending enrollment" };
  if (user.totpEnabled) return { error: "2FA is already enabled" };

  const secret = decrypt(JSON.parse(user.totpSecret));
  if (!verifyTotp(secret, token)) return { error: "Invalid TOTP code" };

  const { plain, hashed } = generateRecoveryCodes();

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled: true,
      totpRecoveryCodesHashed: hashed,
    },
  });

  return { plainCodes: plain };
}

/**
 * Disable 2FA on a user account.
 */
export async function disableTotp(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled: false,
      totpSecret: null,
      totpRecoveryCodesHashed: [],
    },
  });
}

// ---------------------------------------------------------------------------
// Base32 helpers (RFC 4648, no padding)
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const upper = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of upper) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(output);
}

/** Exported only for unit tests. */
export const _internals = { base32Encode, base32Decode };