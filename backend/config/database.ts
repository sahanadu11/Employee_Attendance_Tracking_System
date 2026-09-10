import { DATA_DRIVER } from '../data/driver';
import { logger } from '../utils/logger';

/**
 * Data-layer entry point.
 *
 *  supabase → all application data lives in Supabase Postgres (DATABASE_URL).
 *             The pg pool is opened and the runtime schema is ensured.
 *  mongo    → legacy development driver: local MongoDB, or an automatic
 *             in-memory MongoDB in dev so a fresh checkout runs with zero
 *             setup (data is not persisted across restarts in that mode).
 *
 * Both drivers expose the same Model API (see backend/data/shim.ts), so
 * services and controllers are identical underneath either one.
 */

export async function connectDatabase(): Promise<void> {
  if (DATA_DRIVER === 'supabase') {
    const { connectSupabase } = await import('../data/schema');
    await connectSupabase();
    return;
  }

  const mongoose = await import('mongoose');
  const { MONGODB_URI, IS_DEV } = mongoConfig();

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: IS_DEV ? 2500 : 10000 });
    logger.info(`MongoDB connected: ${MONGODB_URI}`);
    return;
  } catch (err) {
    if (!IS_DEV) {
      logger.error('MongoDB connection failed in production — aborting', err);
      throw err;
    }
    logger.warn(`Local MongoDB not reachable (${(err as Error).message}). Starting in-memory MongoDB for development...`);
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create({ instance: { port: 27017, ip: '127.0.0.1' } });
  await mongoose.connect(mem.getUri());
  logger.info(`In-memory MongoDB started at ${mem.getUri()} (development fallback, data is not persisted)`);
}

function mongoConfig() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_db';
  const IS_DEV = (process.env.NODE_ENV || 'development') !== 'production';
  return { MONGODB_URI, IS_DEV };
}

export async function disconnectDatabase(): Promise<void> {
  if (DATA_DRIVER === 'supabase') {
    const { disconnectSupabase } = await import('../data/schema');
    await disconnectSupabase();
    return;
  }
  const mongoose = await import('mongoose');
  await mongoose.disconnect();
}

export { DATA_DRIVER };
