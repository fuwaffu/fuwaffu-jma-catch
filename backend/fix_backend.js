const fs = require('fs');

const code = fs.readFileSync('index.cloudflare.ts', 'utf8');

const output = `import express from 'express';
import cors from 'cors';
import { WEATHER_DATA_STORE } from './localKv';
import { XMLParser } from 'fast-xml-parser';

const env = { WEATHER_DATA_STORE };
type Env = any;
type ExecutionContext = any;

const OFFICE_CODE_TO_PREF: Record<string, string> = {
  "011000": "北海道", "012000": "北海道", "013000": "北海道", "014030": "北海道", "014100": "北海道", "015000": "北海道", "016000": "北海道", "017000": "北海道",
  "020000": "青森県", "030000": "岩手県", "040000": "宮城県", "050000": "秋田県", "060000": "山形県", "070000": "福島県",
  "080000": "茨城県", "090000": "栃木県", "100000": "群馬県", "110000": "埼玉県", "120000": "千葉県", "130000": "東京都", "140000": "神奈川県",
  "150000": "新潟県", "160000": "富山県", "170000": "石川県", "180000": "福井県", "190000": "山梨県", "200000": "長野県",
  "210000": "岐阜県", "220000": "静岡県", "230000": "愛知県", "240000": "三重県",
  "250000": "滋賀県", "260000": "京都府", "270000": "大阪府", "280000": "兵庫県", "290000": "奈良県", "300000": "和歌山県",
  "310000": "鳥取県", "320000": "島根県", "330000": "岡山県", "340000": "広島県", "350000": "山口県",
  "360000": "徳島県", "370000": "香川県", "380000": "愛媛県", "390000": "高知県",
  "400000": "福岡県", "410000": "佐賀県", "420000": "長崎県", "430000": "熊本県", "440000": "大分県", "450000": "宮崎県", 
  "460040": "鹿児島県", "460100": "鹿児島県",
  "471000": "沖縄県", "472000": "沖縄県", "473000": "沖縄県", "474000": "沖縄県"
};

export function normalizePrefectureName(prefecture: string): string {
  if (prefecture.includes('地方') && (prefecture.includes('宗谷') || prefecture.includes('上川') || prefecture.includes('留萌') || prefecture.includes('網走') || prefecture.includes('北見') || prefecture.includes('紋別') || prefecture.includes('十勝') || prefecture.includes('釧路') || prefecture.includes('根室') || prefecture.includes('胆振') || prefecture.includes('日高') || prefecture.includes('石狩') || prefecture.includes('空知') || prefecture.includes('後志') || prefecture.includes('渡島') || prefecture.includes('檜山'))) {
    return '北海道';
  } else if (prefecture.includes('沖縄') || prefecture.includes('大東島') || prefecture.includes('宮古島') || prefecture.includes('八重山')) {
    return '沖縄県';
  } else if (prefecture.includes('奄美') || prefecture.includes('鹿児島')) {
    return '鹿児島県';
  } else if (prefecture === '東京地方') {
    return '東京都';
  }
  return prefecture;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});

`;

// Extract everything from `export default {` to the end, then extract the functions inside.
const match = code.match(/export default\s*\{([\s\S]*)\};?\s*$/);
if (!match) throw new Error("Could not find export default");

let logicBody = match[1];

// We need to wrap it in `const Logic = { ... }` but remove `fetch`.
// Find the fetch function.
const fetchMatch = logicBody.match(/async fetch\([\s\S]*?\}\s*\n\s*\n\s*async updateJmaData/);
if (fetchMatch) {
    logicBody = logicBody.replace(fetchMatch[0], 'async updateJmaData');
}

const finalCode = output + '\nconst Logic = {\n' + logicBody + '};\n' + `

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

async function runBackgroundSync() {
  if (isSyncingNow) return;
  isSyncingNow = true;
  try {
    console.log('[Sync] Checking for new JMA data...');
    await Logic.updateJmaData(env);

    const state: any = await env.WEATHER_DATA_STORE.get('sync_state', { type: 'json' }) || { items: [], total: 0 };
    if (state.items && state.items.length > 0) {
        console.log(\`[Sync] Processing \${state.items.length} items without CPU limits...\`);
        // We pass maxXmlLengthOpt = 999999999 to process everything
        await Logic.processQueueAdaptive(state.items, env, {} as any, 999999999);
        console.log('[Sync] Processing complete!');
    } else {
        console.log('[Sync] No items to process.');
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
  console.log(\`Server running on port \${port}\`);
});
`;

fs.writeFileSync('index.ts', finalCode);
console.log('Fixed index.ts successfully!');
