import crypto from "node:crypto";

export function randomBytes(length: number): Buffer {
  return crypto.randomBytes(length);
}

export function randomHex(length: number): string {
  return crypto.randomBytes(length).toString("hex");
}

export { randomUUID } from "node:crypto";
