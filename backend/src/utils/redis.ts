import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient: ReturnType<typeof createClient> | null = null;
let redisAvailable = false;

export const initRedis = async () => {
  try {
    redisClient = createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '22489'}`,
    });

    redisClient.on('error', (err) => console.error('Redis Client Error', err));

    await redisClient.connect();
    redisAvailable = true;
    console.log('[OK] Redis 连接成功');
    return redisClient;
  } catch (error) {
    console.warn('[WARN] Redis 连接失败，缓存功能将不可用:', String(error));
    redisAvailable = false;
    redisClient = null;
    return null;
  }
};

export const isRedisAvailable = () => redisAvailable;

export const getRedisClient = () => {
  if (!redisClient || !redisAvailable) {
    return null;
  }
  return redisClient;
};

export const cacheSet = async (key: string, value: any, ttlSeconds?: number) => {
  const client = getRedisClient();
  if (!client) return;
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (ttlSeconds) {
    await client.setEx(key, ttlSeconds, serialized);
  } else {
    await client.set(key, serialized);
  }
};

export const cacheGet = async <T = any>(key: string): Promise<T | null> => {
  const client = getRedisClient();
  if (!client) return null;
  const value = await client.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
};

export const cacheDel = async (key: string) => {
  const client = getRedisClient();
  if (!client) return;
  await client.del(key);
};
