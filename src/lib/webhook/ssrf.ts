import { lookup } from "node:dns/promises";

const BLOCKED_CIDR = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "192.0.0.0/24",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
  "::1/128",
  "::/128",
  "fc00::/7",
  "fe80::/10",
  "::ffff:0:0/96",
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  ".local",
  ".internal",
  ".localhost",
];

function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr ?? "32", 10);

  if (ip.includes(".")) {
    const ipBytes = ip.split(".").map(Number);
    const rangeBytes = range!.split(".").map(Number);
    if (ipBytes.length !== 4 || rangeBytes.length !== 4) return false;
    const ipInt = (ipBytes[0]! << 24) + (ipBytes[1]! << 16) + (ipBytes[2]! << 8) + ipBytes[3]!;
    const rangeInt = (rangeBytes[0]! << 24) + (rangeBytes[1]! << 16) + (rangeBytes[2]! << 8) + rangeBytes[3]!;
    const mask = ~0 << (32 - bits);
    return (ipInt & mask) === (rangeInt & mask);
  }

  const parseIpv6 = (addr: string): string | null => {
    const parts = addr.split("::");
    if (parts.length > 2) return null;
    const [head, tail] = parts;
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return null;
    const full = [...headParts, ...Array(missing).fill("0"), ...tailParts];
    if (full.length !== 8) return null;
    return full.map((p) => p.padStart(4, "0")).join("");
  };

  const ipHex = parseIpv6(ip);
  const rangeHex = parseIpv6(range ?? "");
  if (!ipHex || !rangeHex) return false;

  const totalHexChars = 32;
  const maskChars = Math.floor(bits / 4);
  const maskPartialBits = bits % 4;

  let maskedIp = ipHex.slice(0, maskChars);
  let maskedRange = rangeHex.slice(0, maskChars);

  if (maskPartialBits > 0 && maskChars < totalHexChars) {
    const partialMask = (0xf0 >> maskPartialBits) & 0xf;
    maskedIp += (parseInt(ipHex[maskChars]!, 16) & partialMask).toString(16);
    maskedRange += (parseInt(rangeHex[maskChars]!, 16) & partialMask).toString(16);
    maskedIp += ipHex.slice(maskChars + 1);
    maskedRange += rangeHex.slice(maskChars + 1);
  } else {
    maskedIp += ipHex.slice(maskChars);
    maskedRange += rangeHex.slice(maskChars);
  }

  return maskedIp === maskedRange;
}

export function isPrivateIp(host: string): boolean {
  const normalizedHost = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const mappedIpv4 = normalizedHost.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedIpv4) return isPrivateIp(mappedIpv4[1]!);
  const mappedHex = normalizedHost.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const first = parseInt(mappedHex[1]!, 16);
    const second = parseInt(mappedHex[2]!, 16);
    return isPrivateIp(`${first >> 8}.${first & 0xff}.${second >> 8}.${second & 0xff}`);
  }

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(normalizedHost)) {
    const ipBytes = normalizedHost.split(".").map(Number);
    if (ipBytes.some((byte) => byte > 255)) return true;
    for (const cidr of BLOCKED_CIDR) {
      if (cidr.includes(":")) continue;
      if (ipInCidr(normalizedHost, cidr)) return true;
    }
    return false;
  }

  if (normalizedHost.includes(":")) {
    if (normalizedHost === "::" || normalizedHost === "::1") return true;
    const firstHextet = parseInt(normalizedHost.split(":")[0] || "0", 16);
    if ((firstHextet >= 0xfe80 && firstHextet <= 0xfebf) || firstHextet >= 0xfc00) return true;
    for (const cidr of BLOCKED_CIDR) {
      if (!cidr.includes(":")) continue;
      if (ipInCidr(normalizedHost, cidr)) return true;
    }
    return false;
  }

  return false;
}

export function validateWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");

    for (const suffix of BLOCKED_HOSTNAMES) {
      if (host === suffix.slice(1) || host.endsWith(suffix)) return false;
    }

    if (isPrivateIp(host)) return false;

    return true;
  } catch {
    return false;
  }
}

export type ResolvedWebhookAddress = {
  address: string;
  family: 4 | 6;
};

export async function resolveSafeWebhookAddress(url: string): Promise<ResolvedWebhookAddress | null> {
  if (!validateWebhookUrl(url)) return null;

  let host: string;
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) {
    return isPrivateIp(host) ? null : { address: host, family: host.includes(":") ? 6 : 4 };
  }

  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((addr) => isPrivateIp(addr.address))) return null;
    const publicAddress = addresses[0]!;
    return { address: publicAddress.address, family: publicAddress.family === 6 ? 6 : 4 };
  } catch {
    return null;
  }
}

export async function validateWebhookUrlResolved(url: string): Promise<boolean> {
  return (await resolveSafeWebhookAddress(url)) !== null;
}