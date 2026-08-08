import type { RedisOptions, SentinelAddress } from "ioredis";

const DEFAULT_REDIS_URL = "redis://localhost:6379";
const DEFAULT_SENTINEL_PORT = 26379;

function parseSentinelAddress(value: string): SentinelAddress {
  const trimmed = value.trim();
  const bracketed = /^\[([^\]]+)\]:(\d+)$/.exec(trimmed);
  const unbracketed = /^([^:]+):(\d+)$/.exec(trimmed);
  const host = bracketed?.[1] ?? unbracketed?.[1];
  const portText = bracketed?.[2] ?? unbracketed?.[2] ?? String(DEFAULT_SENTINEL_PORT);

  if (!host || !portText) {
    throw new Error(`Invalid Redis Sentinel address: ${value}`);
  }

  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid Redis Sentinel port: ${portText}`);
  }

  return { host, port };
}

export function getRedisConnectionOptions(): string | RedisOptions {
  const sentinelList = process.env.REDIS_SENTINELS?.trim();
  const sentinelName = process.env.REDIS_SENTINEL_NAME?.trim();

  if (!sentinelList && !sentinelName) {
    return process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
  }

  if (!sentinelList) {
    throw new Error("REDIS_SENTINELS is required when REDIS_SENTINEL_NAME is configured");
  }
  if (!sentinelName) {
    throw new Error("REDIS_SENTINEL_NAME is required when REDIS_SENTINELS is configured");
  }

  const sentinels = sentinelList.split(",").filter((value) => value.trim()).map(parseSentinelAddress);
  if (sentinels.length === 0) {
    throw new Error("REDIS_SENTINELS must contain at least one address");
  }

  const options: RedisOptions = { name: sentinelName, sentinels };
  const redisPassword = process.env.REDIS_PASSWORD;
  const sentinelPassword = process.env.REDIS_SENTINEL_PASSWORD;
  if (redisPassword) options.password = redisPassword;
  if (sentinelPassword) options.sentinelPassword = sentinelPassword;

  return options;
}
