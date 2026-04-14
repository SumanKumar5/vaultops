import { createClient } from "redis";
import { env } from "../config/env";

const client = createClient({ url: env.REDIS_URL });

client.on("error", (err) => console.error("Redis error:", err));

let connected = false;

async function ensureConnected() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
}

function cacheKey(
  projectId: string,
  environment: string,
  keyName: string,
): string {
  return `secret:${projectId}:${environment}:${keyName}`;
}

let hits = 0;
let misses = 0;

export const secretCache = {
  async get(
    projectId: string,
    environment: string,
    keyName: string,
  ): Promise<string | null> {
    await ensureConnected();
    const val = await client.get(cacheKey(projectId, environment, keyName));
    if (val !== null) hits++;
    else misses++;
    return val;
  },

  async set(
    projectId: string,
    environment: string,
    keyName: string,
    value: string,
  ): Promise<void> {
    await ensureConnected();
    await client.setEx(cacheKey(projectId, environment, keyName), 300, value);
  },

  async invalidate(
    projectId: string,
    environment: string,
    keyName: string,
  ): Promise<void> {
    await ensureConnected();
    await client.del(cacheKey(projectId, environment, keyName));
  },

  getMetrics() {
    return {
      hits,
      misses,
      hit_rate: hits + misses === 0 ? 0 : hits / (hits + misses),
    };
  },
};

export async function disconnectRedis() {
  if (connected) {
    await client.disconnect();
    connected = false;
  }
}
