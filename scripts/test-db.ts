import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

async function test() {
  const uri = process.env.MONGODB_URI!;
  console.log('[Test] Conectando...');
  const started = Date.now();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000, connectTimeoutMS: 20000 });
  console.log(`[Test] Conectado en ${Date.now() - started}ms`);
  console.log('[Test] readyState:', mongoose.connection.readyState);
  await mongoose.disconnect();
  console.log('[Test] Done');
}

test().catch(e => { console.error('[Test] Error:', e.message); process.exit(1); });
