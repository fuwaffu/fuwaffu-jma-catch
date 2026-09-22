const fs = require('fs');
let code = fs.readFileSync('index.ts', 'utf8');

// 1. Remove Cloudflare types and imports
code = code.replace(/export interface Env \{[\s\S]*?\}/, '');
code = code.replace(/import \{.*\} from '@cloudflare\/workers-types';?/, '');

// 2. Add Express and localKv imports
code = `import express from 'express';
import cors from 'cors';
import { WEATHER_DATA_STORE } from './localKv';
const env = { WEATHER_DATA_STORE };

` + code;

// 3. Replace default export fetch with Express setup
const fetchStart = code.indexOf('export default {');
if (fetchStart !== -1) {
  code = code.substring(0, fetchStart);
}

// Remove cachedKvQuery function as we'll inline it in Express
code = code.replace(/async function cachedKvQuery[\s\S]*?return response;\n\}/, '');
code = code.replace(/async function invalidateApiCaches[\s\S]*?\}\n/, '');

// Add Express routes and Cron logic
code += `

const app = express();
app.use(cors());

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

let isSyncingNow = false;

// 背景で自動同期処理を実行する関数
async function runBackgroundSync() {
  if (isSyncingNow) return;
  isSyncingNow = true;
  try {
    // まず新着データをチェックしてキューに入れる
    await Logic.updateJmaData(env);

    // キューを全件処理する (CPU制限がないため一気に処理)
    const state: any = await env.WEATHER_DATA_STORE.get('sync_state', { type: 'json' }) || { items: [], total: 0 };
    if (state.items && state.items.length > 0) {
        console.log(\`[Sync] Processing \${state.items.length} items...\`);
        // Node.jsなので ctx がないためダミーを渡す
        await Logic.processQueueAdaptive(state.items, env, {} as any, undefined);
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
runBackgroundSync();

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
`;

// Also, the old code had functions directly in the global scope or inside an object?
// Let's check how the functions were defined.
// processWarningToMemory etc. were actually inside an object or module scope?
// Ah! In index.ts they were standalone functions maybe? Or methods of export default object?
fs.writeFileSync('server.ts', code);
console.log('Done');
