import crypto from "node:crypto";

export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function sha256Buffer(data: string): Buffer {
  return crypto.createHash("sha256").update(data).digest();
}
