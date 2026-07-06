import crypto from "node:crypto";

export function hmacSign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function hmacVerify(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = hmacSign(payload, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}
