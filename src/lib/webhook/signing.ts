import { hmacSign, hmacVerify } from "@/lib/crypto";
import { decrypt } from "@/lib/crypto/encrypt";

export function signPayload(payload: string, secret: string): string {
  return hmacSign(payload, secret);
}

export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  return hmacVerify(payload, signature, secret);
}

export function decryptSecret(encryptedSecret: string): string {
  const parts = encryptedSecret.split(":");
  if (parts.length === 3) {
    return decrypt({ iv: parts[0]!, ciphertext: parts[1]!, tag: parts[2]! });
  }
  return encryptedSecret;
}

/** Thrown when a stored webhook secret cannot be decrypted (encryption key changed). */
export class WebhookSecretUndecryptableError extends Error {}

export function webhookSecretState(stored: string): "ok" | "broken" {
  try {
    decryptSecret(stored);
    return "ok";
  } catch {
    return "broken";
  }
}