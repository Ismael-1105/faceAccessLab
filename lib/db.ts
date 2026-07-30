import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI no está definida en las variables de entorno');
}

let isConnecting = false;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (isConnecting) {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (mongoose.connection.readyState === 1) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
    return mongoose;
  }

  isConnecting = true;
  console.log('[DB] Connecting to MongoDB...');

  try {
    await mongoose.connect(MONGODB_URI!, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    console.log('[DB] MongoDB connected');
    return mongoose;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[DB] Connection failed:', msg);
    throw new Error(`MongoDB connection failed: ${msg}`);
  } finally {
    isConnecting = false;
  }
}
