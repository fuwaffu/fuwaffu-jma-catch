import express from 'express';
import cors from 'cors';
import { WEATHER_DATA_STORE } from './localKv';

// Mock Cloudflare's global `caches` object before importing index.ts
(global as any).caches = {
  default: {
    match: async () => null,
    put: async () => {},
    delete: async () => {}
  }
};

import Logic from './index';
import { syncMapJsonState } from './mapSync';

const app = express();
app.use(cors());

// Fake environment object that mimics Cloudflare Workers Env for index.ts
const env = { WEATHER_DATA_STORE, XML_QUEUE: null };
// We don't need a real ExecutionContext since waituntil is only used in scheduled Work which we bypass
const ctx: any = { waitUntil: (p: any) => p };

async function cachedKvQuery(cacheKey: string) {
  let data: any = await env.WEATHER_DATA_STORE.get(cacheKey, { type: 'json' });
  if (data === null) {
    if (cacheKey === 'status') data = { lastUpdated: null };
    else data = [];
  } else if (Array.isArray(data)) {
    data = data.filter((d: any) => !d.isCancelled);
  }
  return data;
}

app.get('/api/warnings', async (req, res) => res.json(await cachedKvQuery('warnings')));
app.get('/api/earthquakes', async (req, res) => res.json(await cachedKvQuery('earthquakes')));
app.get('/api/typhoons', async (req, res) => res.json(await cachedKvQuery('typhoons')));

app.get('/api/status', async (req, res) => {
  let status: any = { lastUpdated: null, isSyncing: false, progress: 0 };
  try {
    const raw = await env.WEATHER_DATA_STORE.get('status');
    if (raw) status = { ...status, ...JSON.parse(raw) };
    const state: any = await env.WEATHER_DATA_STORE.get('sync_state', { type: 'json' }) || { items: [], total: 0 };
    const remaining = (state.items || []).length;
    const total = state.total || 0;
    const current = total - remaining;
    status.current = current;
    status.target = total;
    if (total > 0) {
      status.isSyncing = remaining > 0;
      status.progress = Math.min(100, Math.round((current / total) * 100));
    } else {
      status.isSyncing = false;
      status.progress = 100;
    }
  } catch(e) {
    console.error('Status error:', e);
  }
  res.json(status);
});

app.get('/api/trigger-update', (req, res) => {
  // 1分間の定期実行を待たずに即座に強制同期を走らせる
  runBackgroundSync().catch(console.error);
  res.json({ ok: true, message: 'Sync triggered' });
});

let isSyncingNow = false;
let hasInitialSyncRun = false;

async function runBackgroundSync() {
  if (isSyncingNow) return;
  isSyncingNow = true;
  try {
    const isInitial = !hasInitialSyncRun;
    console.log(`[Sync] Checking for new JMA data... (isInitial: ${isInitial})`);
    // updateJmaData fetches the feeds and populates the sync queue
    await Logic.updateJmaData(env as any, isInitial);
    
    // ハイブリッド同期：JSONから最新の絶対状態を取得して古いデータをパージする
    if (isInitial) {
      await syncMapJsonState(env as any);
    }
    
    hasInitialSyncRun = true;

    let state: any = await env.WEATHER_DATA_STORE.get('sync_state', { type: 'json' }) || { items: [], total: 0 };
    if (state.items && state.items.length > 0) {
        console.log(`[Sync] Processing ${state.items.length} items...`);
        let totalProcessed = 0;
        
        while (state.items.length > 0) {
            // 50件ずつ処理して進捗を保存する（フロントエンドのプログレスバーを動かすため）
            const batchSize = Math.min(50, state.items.length);
            const batch = state.items.splice(0, batchSize);
            
            const processed = await Logic.processQueueAdaptive(batch, env as any, ctx, 500000 * 10);
            
            // 処理しきれなかったものがあれば先頭に戻す
            if (batch.length > 0) {
                state.items.unshift(...batch);
            }
            
            // Poison pill対策: 1件も処理できず、かつバッチが減らない場合は先頭を捨てる
            if (processed === 0 && batch.length === batchSize) {
                state.items.shift();
            }
            
            totalProcessed += processed;
            
            // 途中経過を保存
            await env.WEATHER_DATA_STORE.put('sync_state', JSON.stringify(state));
            
            // ちょっとだけ待機してCPUとネットワークを休ませる
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log(`[Sync] Processing complete! Processed ${totalProcessed} items.`);
    } else {
        // console.log('[Sync] No new items.');
    }
  } catch (e) {
    console.error('[Sync Error]', e);
  } finally {
    isSyncingNow = false;
  }
}

// 1分ごとに裏側で自動処理
setInterval(runBackgroundSync, 60 * 1000);
// 初回起動時にも実行
setTimeout(runBackgroundSync, 2000);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
