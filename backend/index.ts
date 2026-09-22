import { XMLParser } from 'fast-xml-parser';

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

const WARNING_CODES: Record<string, { name: string; level: string; color: string }> = {
  '33': { name: '大雨特別警報', level: 'special', color: '#8B008B' },
  '35': { name: '暴風特別警報', level: 'special', color: '#8B008B' },
  '32': { name: '暴風雪特別警報', level: 'special', color: '#8B008B' },
  '36': { name: '大雪特別警報', level: 'special', color: '#8B008B' },
  '37': { name: '波浪特別警報', level: 'special', color: '#8B008B' },
  '38': { name: '高潮特別警報', level: 'special', color: '#8B008B' },
  '03': { name: '大雨警報', level: 'warning', color: '#FF2800' },
  '04': { name: '洪水警報', level: 'warning', color: '#FF2800' },
  '05': { name: '暴風警報', level: 'warning', color: '#FF2800' },
  '06': { name: '暴風雪警報', level: 'warning', color: '#FF2800' },
  '07': { name: '大雪警報', level: 'warning', color: '#FF2800' },
  '08': { name: '波浪警報', level: 'warning', color: '#FF2800' },
  '09': { name: '高潮警報', level: 'warning', color: '#FF2800' },
  '10': { name: '大雨注意報', level: 'advisory', color: '#FFD700' },
  '13': { name: '洪水注意報', level: 'advisory', color: '#FFD700' },
  '14': { name: '雷注意報', level: 'advisory', color: '#FFD700' },
  '15': { name: '強風注意報', level: 'advisory', color: '#FFD700' },
  '16': { name: '風雪注意報', level: 'advisory', color: '#FFD700' },
  '17': { name: '大雪注意報', level: 'advisory', color: '#FFD700' },
  '18': { name: '濃霧注意報', level: 'advisory', color: '#FFD700' },
  '19': { name: '波浪注意報', level: 'advisory', color: '#FFD700' },
  '20': { name: '高潮注意報', level: 'advisory', color: '#FFD700' },
  '21': { name: 'なだれ注意報', level: 'advisory', color: '#FFD700' },
  '22': { name: '着氷注意報', level: 'advisory', color: '#FFD700' },
  '23': { name: '着雪注意報', level: 'advisory', color: '#FFD700' },
  '24': { name: '融雪注意報', level: 'advisory', color: '#FFD700' },
  '25': { name: '霜注意報', level: 'advisory', color: '#FFD700' },
  '26': { name: '低温注意報', level: 'advisory', color: '#FFD700' },
  '27': { name: '乾燥注意報', level: 'advisory', color: '#FFD700' },
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

export interface Env {
  WEATHER_DATA_STORE: KVNamespace;
  XML_QUEUE: any;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});

// Cache TTL: 10分
const CACHE_TTL_SECONDS = 60;

async function cachedKvQuery(
  cacheKey: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const cache = caches.default;
  const cacheUrl = new URL(`https://cache-internal/${cacheKey}`);
  const cacheRequest = new Request(cacheUrl.toString());

  const cached = await cache.match(cacheRequest);
  if (cached) {
    const newHeaders = new Headers(cached.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      newHeaders.set(k, v);
    }
    return new Response(cached.body, { status: cached.status, headers: newHeaders });
  }

  // KVからデータを取得
  let data: any = await env.WEATHER_DATA_STORE.get(cacheKey, { type: 'json' });
  if (data === null) {
    if (cacheKey === 'status') data = { lastUpdated: null };
    else data = [];
  } else if (Array.isArray(data)) {
    // クライアントに返す前に論理削除(isCancelled)されたデータを除外
    data = data.filter((d: any) => !d.isCancelled);
  }

  const body = JSON.stringify(data);
  const response = new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  });

  await cache.put(cacheRequest, response.clone());
  return response;
}

async function invalidateApiCaches(): Promise<void> {
  const cache = caches.default;
  const keys = ['warnings', 'earthquakes', 'typhoons', 'status'];
  for (const key of keys) {
    const cacheUrl = new URL(`https://cache-internal/${key}`);
    await cache.delete(new Request(cacheUrl.toString()));
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      if (url.pathname === "/api/warnings") return await cachedKvQuery('warnings', env, corsHeaders);
      if (url.pathname === "/api/earthquakes") return await cachedKvQuery('earthquakes', env, corsHeaders);
      if (url.pathname === "/api/typhoons") return await cachedKvQuery('typhoons', env, corsHeaders);
      if (url.pathname === "/api/status") {
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
        return new Response(JSON.stringify(status), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      if (url.pathname === "/api/trigger-update") {
        // Obsolete route, now handled by sync-initial
        return new Response(JSON.stringify({ error: "Use /api/sync-initial instead" }), { status: 400, headers: corsHeaders });
      }

      if (url.pathname === "/api/sync-step") {
        try {
          const state: any = await env.WEATHER_DATA_STORE.get('sync_state', { type: 'json' }) || { items: [], total: 0 };
          let syncQueue: any[] = state.items || [];
          const total = state.total || 0;
          
          if (syncQueue.length === 0) {
              return new Response(JSON.stringify({ ok: true, isSyncing: false, progress: 100 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          
          const maxXmlLengthOpt = url.searchParams.has('maxXmlLength') ? parseInt(url.searchParams.get('maxXmlLength') as string, 10) : undefined;
          const skipOpt = url.searchParams.has('skip') ? parseInt(url.searchParams.get('skip') as string, 10) : 0;
          
          if (skipOpt > 0) {
              for (let i = 0; i < skipOpt && syncQueue.length > 0; i++) {
                  console.warn(`[Adaptive] Skipping poison pill item by client request: ${syncQueue[0].link}`);
                  syncQueue.shift();
              }
          }
          
          // 制限ギリギリまで処理: 逐次処理しながら時間を計測
          const processed = await this.processQueueAdaptive(syncQueue, env, ctx, maxXmlLengthOpt);
          
          state.items = syncQueue;
          await env.WEATHER_DATA_STORE.put('sync_state', JSON.stringify(state));
          
          const current = total - syncQueue.length;
          const progress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
          return new Response(JSON.stringify({ ok: true, isSyncing: syncQueue.length > 0, progress, current, target: total, batchProcessed: processed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (stepErr: any) {
          console.error('sync-step error:', stepErr);
          return new Response(JSON.stringify({ ok: false, error: stepErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      if (url.pathname === "/api/sync-initial") {
        ctx.waitUntil(this.syncInitialJmaData(env));
        return new Response(JSON.stringify({ ok: true, message: "Sync started in background" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/debug-kv") {
        const state: any = await env.WEATHER_DATA_STORE.get('sync_state', { type: 'json' }) || { items: [], total: 0 };
        const queueError = await env.WEATHER_DATA_STORE.get('debug_queue_error');
        return new Response(JSON.stringify({ total: state.total, remaining: (state.items || []).length, queueError }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/clear-cache") {
        await env.WEATHER_DATA_STORE.delete('processed_feeds');
        await env.WEATHER_DATA_STORE.delete('typhoons');
        await env.WEATHER_DATA_STORE.delete('warnings');
        await env.WEATHER_DATA_STORE.delete('earthquakes');
        await env.WEATHER_DATA_STORE.delete('sync_state');
        await invalidateApiCaches();
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },

  // 制限ギリギリまで適応的にキューを処理する
  // syncQueue は in-place で splice されるので呼び出し元でそのまま保存可能
  async processQueueAdaptive(syncQueue: any[], env: Env, ctx: ExecutionContext, maxXmlLengthOpt?: number): Promise<number> {
    const MAX_SUBREQUESTS = 99999; // Render.com 無制限
    // クライアントからの指定があればそれを使用、なければ500KB
    const MAX_XML_LENGTH_PER_BATCH = maxXmlLengthOpt || 500000; 
    let processed = 0;
    let totalXmlLength = 0;
    
    // 必要なデータストアを先にロード（スマートGET）
    let warningsData: any[] | null = null;
    let earthquakesData: any[] | null = null;
    let typhoonsData: any[] | null = null;
    let warningsUpdated = false;
    let earthquakesUpdated = false;
    let typhoonsUpdated = false;
    
    try {
      while (syncQueue.length > 0 && processed < MAX_SUBREQUESTS) {
        // CPU予算チェック (XML文字列長の合計で判定)
        // すでに上限を超えていたら次のリクエストに回す
        if (totalXmlLength > MAX_XML_LENGTH_PER_BATCH && processed > 0) {
          console.log(`[Adaptive] XML length budget reached: ${totalXmlLength} bytes used, stopping after ${processed} items`);
          break;
        }
        
        const item = syncQueue[0]; // peek (まだ消さない)
        const { id, link, updated, telegramCode } = item;
        
        try {
          // XML取得 (I/O: CPU時間に含まれない)
          const xmlRes = await fetch(link, { headers: { 'User-Agent': 'Jma-Dashboard/1.0' } });
          if (!xmlRes.ok) {
            syncQueue.shift(); processed++;
            continue;
          }
          const xmlText = await xmlRes.text();
          
          // サイズが大きすぎるファイル(Poison Pill)はパースすると即座に10ms制限を超えてクラッシュするためスキップ。
          // 500KB以上の単一ファイルは無料枠では安全にパースできない可能性が高い
          if (xmlText.length > 600000) {
            console.warn(`[Adaptive] Skipping extremely large file (size: ${xmlText.length} bytes): ${link}`);
            syncQueue.shift(); processed++; continue;
          }
          
          // XML長を加算
          totalXmlLength += xmlText.length;
          
          // XMLパース (CPU集約)
          const xmlData = parser.parse(xmlText);
          
          const report = xmlData.Report;
          if (!report) { syncQueue.shift(); processed++; continue; }
          
          const status = report.Control?.Status;
          if (status !== '通常') { syncQueue.shift(); processed++; continue; }
          
          const infoType = report.Head?.InfoType;
          const reportDateTime = report.Head?.ReportDateTime;
          
          // データストアの遅延ロード（初回のみKVからGET）
          if (telegramCode === 'VPWW') {
            if (warningsData === null) warningsData = await env.WEATHER_DATA_STORE.get('warnings', { type: 'json' }) || [];
            this.processWarningToMemory(report, id, reportDateTime, infoType, status, warningsData);
            warningsUpdated = true;
          } else if (telegramCode === 'VXSE') {
            if (earthquakesData === null) earthquakesData = await env.WEATHER_DATA_STORE.get('earthquakes', { type: 'json' }) || [];
            this.processEarthquakeToMemory(report, id, infoType, earthquakesData);
            earthquakesUpdated = true;
          } else if (telegramCode === 'VPTW') {
            if (typhoonsData === null) typhoonsData = await env.WEATHER_DATA_STORE.get('typhoons', { type: 'json' }) || [];
            this.processTyphoonToMemory(report, id, updated, typhoonsData);
            typhoonsUpdated = true;
          }
        } catch (e) {
          console.error('Failed to process id: ' + id, e);
        }
        
        syncQueue.shift(); // 正常完了 → キューから除去
        processed++;
      }
      
      // 変更があったデータストアだけPUT
      if (warningsUpdated && warningsData) {
        // KVの肥大化を防ぐため、論理削除(isCancelled)されてから48時間経過した古いデータは物理削除する
        const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
        warningsData = warningsData.filter(w => !(w.isCancelled && new Date(w.reportDateTime).getTime() < twoDaysAgo));
        await env.WEATHER_DATA_STORE.put('warnings', JSON.stringify(warningsData));
      }
      if (earthquakesUpdated && earthquakesData) {
        await env.WEATHER_DATA_STORE.put('earthquakes', JSON.stringify(earthquakesData));
      }
      if (typhoonsUpdated && typhoonsData) {
        await env.WEATHER_DATA_STORE.put('typhoons', JSON.stringify(typhoonsData));
      }
      if (warningsUpdated || earthquakesUpdated || typhoonsUpdated) {
        await invalidateApiCaches();
      }
      
      console.log(`[Adaptive] Processed ${processed} items, total XML length: ${totalXmlLength} bytes, remaining: ${syncQueue.length}`);
    } catch (queueErr) {
      await env.WEATHER_DATA_STORE.put('debug_queue_error', String(queueErr));
      console.error('[Adaptive] Error:', queueErr);
    }
    
    return processed;
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(this.scheduledWork(env, ctx));
  },

  async scheduledWork(env: Env, ctx: ExecutionContext) {
    // 1. フィードをチェックして新着があればキューに追加
    await this.updateJmaData(env);
    
    // 2. キューに残りがあれば適応的にバッチ処理（ユーザーアクセス不要）
    const state: any = await env.WEATHER_DATA_STORE.get('sync_state', { type: 'json' }) || { items: [], total: 0 };
    let syncQueue: any[] = state.items || [];
    
    if (syncQueue.length > 0) {
      try {
        const processed = await this.processQueueAdaptive(syncQueue, env, ctx);
        state.items = syncQueue;
        await env.WEATHER_DATA_STORE.put('sync_state', JSON.stringify(state));
        console.log(`[Cron] Adaptive processed ${processed} items, ${syncQueue.length} remaining`);
      } catch (e) {
        console.error('[Cron] Batch processing error:', e);
      }
    }
  },

  async updateJmaData(env: Env, isInitialSync = false) {
    const feedUrls = [
      'https://www.data.jma.go.jp/developer/xml/feed/extra.xml',
      'https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml'
    ];

    let processedFeeds: string[] = await env.WEATHER_DATA_STORE.get('processed_feeds', { type: 'json' }) || [];
    if (isInitialSync) {
      processedFeeds = []; // Force clear cache for initial sync so it reparses
    }
    const processedFeedsSet = new Set(processedFeeds);
    
    let fetchCount = 0;
    const MAX_SUBREQUESTS = 99999; // Render.com 無制限
    let globalMaxEntryTime = 0;
    let warningsUpdated = false;
    let earthquakesUpdated = false;
    let typhoonsUpdated = false;

    for (const feedUrl of feedUrls) {
      if (fetchCount >= MAX_SUBREQUESTS) break;
      try {
        const res = await fetch(feedUrl, { headers: { "User-Agent": "Jma-Dashboard/1.0" } });
        fetchCount++;
        if (!res.ok) continue;
        const text = await res.text();
        
        let candidateEntries: any[] = [];
        const entryBlocks = text.split('<entry>').slice(1);
        for (const block of entryBlocks) {
           const idMatch = block.match(/<id>(.*?)<\/id>/);
           const updatedMatch = block.match(/<updated>(.*?)<\/updated>/);
           const linkMatch = block.match(/<link[^>]*?href="(.*?)"/);
           if (idMatch && updatedMatch && linkMatch) {
               const link = linkMatch[1];
               if (link.match(/_(VPWW(5[3-9]|6[0-1])|VXWW[4-5][0-9]|VXXX50)_/) || 
                   link.includes('_VXSE51_') || link.includes('_VXSE52_') || link.includes('_VXSE53_') || 
                   link.includes('_VPTW6') || link.includes('_VPTI5')) {
                   candidateEntries.push({
                       id: idMatch[1],
                       updated: updatedMatch[1],
                       link: { '@_href': linkMatch[1] }
                   });
               }
           }
        }

        const statusStr = await env.WEATHER_DATA_STORE.get('status');
        const status = statusStr ? JSON.parse(statusStr) : {};
        const lastUpdated = status.lastUpdated ? new Date(status.lastUpdated).getTime() : 0;

        if (isInitialSync) {
            const typhoons = candidateEntries.filter((e: any) => e.link?.['@_href'].includes('_VPTW'));
            const earthquakes = candidateEntries.filter((e: any) => e.link?.['@_href'].includes('_VXSE'));
            const warnings = candidateEntries.filter((e: any) => e.link?.['@_href'].match(/_(VPWW|VXWW|VXXX)/));
            
            // ユーザー指定通り、警報・地震・台風を全て取得する
            // 初期同期でのAPIコール上限超過を防ぐため、警報は直近50件に制限
            candidateEntries = [
                ...typhoons.slice(0, 2),
                ...earthquakes.slice(0, 10),
                ...warnings.slice(0, 50)
            ].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
        } else {
            candidateEntries = candidateEntries.slice(0, 150);
        }

        const newEntries = [];
        for (const entry of candidateEntries) {
          if (processedFeedsSet.has(entry.id)) continue;
          
          // <updated>タイムスタンプによる差分判定 (l-telopスキル準拠)
          const entryTime = new Date(entry.updated).getTime();
          if (entryTime > globalMaxEntryTime) globalMaxEntryTime = entryTime;
          if (!isInitialSync && entryTime <= lastUpdated) continue;

          newEntries.push(entry);
        }

        
        const messagesToSend = [];
        // リアルタイム性重視のため、ATOMフィードの並び順（新しい順）のまま処理する
        for (const entry of newEntries) {
          const id = entry.id;
          const updated = entry.updated;
          const link = entry.link?.['@_href'];

          if (!id || !link) continue;

          let telegramCode = '';
          if (link.match(/_(VPWW(5[3-9]|6[0-1])|VXWW[4-5][0-9]|VXXX50)_/)) telegramCode = 'VPWW';
          else if (link.includes('_VXSE51_') || link.includes('_VXSE52_') || link.includes('_VXSE53_')) telegramCode = 'VXSE';
          else if (link.includes('_VPTW6') || link.includes('_VPTI5')) telegramCode = 'VPTW';
          
          if (!telegramCode) {
            processedFeedsSet.add(id);
            continue;
          }

          messagesToSend.push({ id, link, updated, telegramCode });
          processedFeedsSet.add(id);
        }

        if (messagesToSend.length > 0) {
          try {
            const state: any = await env.WEATHER_DATA_STORE.get('sync_state', { type: 'json' }) || { items: [], total: 0 };
            let syncQueue: any[] = state.items || [];
            const remaining = syncQueue.length;
            
            if (remaining === 0) {
              // Previous sync complete, start fresh
              state.total = messagesToSend.length;
              state.items = messagesToSend;
            } else {
              // 新しいデータを優先して処理するため、キューの先頭に追加(LIFO)
              // 重複を排除してから追加する
              const existingIds = new Set(syncQueue.map(i => i.id));
              const uniqueMessages = messagesToSend.filter(m => !existingIds.has(m.id));
              state.total = (state.total || 0) + uniqueMessages.length;
              state.items = [...uniqueMessages, ...syncQueue];
            }
            await env.WEATHER_DATA_STORE.put('sync_state', JSON.stringify(state));
          } catch(e) {
            console.error('Failed to update sync_state in KV', e);
          }
        }

      } catch (e) {
        console.error(`Failed to process feed ${feedUrl}`, e);
      }
    }

    if (processedFeedsSet.size > processedFeeds.length) {
      // 履歴は最新の1000件のみ保持する
      const newProcessedFeeds = Array.from(processedFeedsSet).slice(-1000);
      await env.WEATHER_DATA_STORE.put('processed_feeds', JSON.stringify(newProcessedFeeds));
    }

    if (globalMaxEntryTime > 0) {
      const statusStr = await env.WEATHER_DATA_STORE.get('status');
      const status = statusStr ? JSON.parse(statusStr) : {};
      const currentLastUpdated = status.lastUpdated ? new Date(status.lastUpdated).getTime() : 0;
      if (globalMaxEntryTime > currentLastUpdated) {
        status.lastUpdated = new Date(globalMaxEntryTime).toISOString();
        await env.WEATHER_DATA_STORE.put('status', JSON.stringify(status));
      }
    }
  },

  processWarningToMemory(report: any, xmlId: string, reportDateTime: string, infoType: string, status: string, warningsData: any[]) {
    if (infoType === '取消') return;

    const warnings = Array.isArray(report.Body?.Warning) ? report.Body.Warning : (report.Body?.Warning ? [report.Body.Warning] : []);
    if (warnings.length === 0) return;

    let prefecture = '';
    const idMatch = xmlId.match(/_(?:VPWW|VXWW|VXXX)[0-9]{2}_(\d{6})\.xml/);
    if (idMatch) {
      prefecture = OFFICE_CODE_TO_PREF[idMatch[1]] || '';
    }
    
    // 取得できなかった場合、または「北海道」と大まかに判定された場合はTitleから詳細な地域名を取得
    if (!prefecture || prefecture === '北海道') {
      const title = report.Head?.Title || '';
      const titleWithoutParen = title.replace(/（[^）]+）/, '');
      const prefMatch = titleWithoutParen.match(/^(.+地方|.+県|.+府|北海道|東京都)/);
      if (prefMatch) {
        prefecture = prefMatch[1];
      }

      if (prefecture.includes('沖縄') || prefecture.includes('大東島') || prefecture.includes('宮古島') || prefecture.includes('八重山')) {
        prefecture = '沖縄県';
      } else if (prefecture.includes('奄美') || prefecture.includes('鹿児島')) {
        prefecture = '鹿児島県';
      } else if (prefecture === '東京地方') {
        prefecture = '東京都';
      }
    }

    for (const warning of warnings) {
      if (!warning) continue;
      
      const wType = warning['@_type'] || '';
      let areaType = 'unknown';
      if (wType.includes('府県予報区')) areaType = 'prefecture';
      else if (wType.includes('細分区域')) areaType = 'region';
      else if (wType.includes('まとめた地域')) areaType = 'subregion';
      else if (wType.includes('市町村等')) areaType = 'municipality';

      const items = Array.isArray(warning.Item) ? warning.Item : (warning.Item ? [warning.Item] : []);

      for (const item of items) {
        if (!item) continue;
        
        let areas = [];
        if (item.Area) {
          areas = Array.isArray(item.Area) ? item.Area : [item.Area];
        } else if (item.Areas && item.Areas.Area) {
          areas = Array.isArray(item.Areas.Area) ? item.Areas.Area : [item.Areas.Area];
        }
        if (areas.length === 0) continue;

        for (const area of areas) {
          if (!area) continue;
          const region = area.Name;
        
          const kinds = Array.isArray(item.Kind) ? item.Kind : (item.Kind ? [item.Kind] : []);
          
          for (const kind of kinds) {
            if (!kind) continue;
            const kindName = kind.Name;
            const kindCode = kind.Code;
            if (!kindName) continue;

            let wName = kindName;
            let level = 'advisory';
            
            // 既存のレベル表記を一旦削除して正規化
            wName = wName.replace(/^レベル[１-５1-5]\s*/, '');
            
            // レベル5
            if (wName.includes('特別警報') || wName.includes('氾濫発生')) {
              level = 'special';
            } 
            // レベル4
            else if (wName.includes('土砂災害警戒情報') || (wName.includes('高潮') && wName.includes('警報')) || wName.includes('氾濫危険')) {
              level = 'warning_l4';
            }
            // レベル3
            else if (wName.includes('警報') || wName.includes('氾濫警戒')) {
              level = 'warning';
            }
            // レベル2
            else {
              level = 'advisory';
            }

            // 大雨、洪水（氾濫）、高潮、土砂災害のみレベルを付与する
            if (wName.includes('大雨') || wName.includes('洪水') || wName.includes('氾濫') || wName.includes('高潮') || wName.includes('土砂災害')) {
              if (level === 'special') {
                wName = `レベル5 ${wName}`;
                level = 'level_5';
              } else if (level === 'warning_l4') {
                wName = `レベル4 ${wName}`;
                level = 'level_4';
              } else if (level === 'warning') {
                wName = `レベル3 ${wName}`;
                level = 'level_3';
              } else {
                wName = `レベル2 ${wName}`;
                level = 'level_2';
              }
            } else {
              // それ以外（強風、波浪など）はレベル文字列を付けず、元のlevelのまま
              if (level === 'special') level = 'special';
              else if (level === 'warning_l4' || level === 'warning') level = 'warning';
              else level = 'advisory';
            }

            // 1. 「解除」の場合：配列から直接削除せず、isCancelledフラグを立てて論理削除とする
            // これにより「新しい解除」が先に処理され、後から「古い発表」が来ても時系列比較で弾ける
            if (kindName.includes('解除') || kindName === 'なし' || kind.Status === '解除') {
              let found = false;
              for (let i = warningsData.length - 1; i >= 0; i--) {
                if (warningsData[i].region === region && warningsData[i].areaType === areaType && warningsData[i].warningName === wName) {
                  found = true;
                  const existingDate = new Date(warningsData[i].reportDateTime).getTime();
                  const newDate = new Date(reportDateTime).getTime();
                  // 既存のデータより新しい解除情報の場合のみ更新
                  if (newDate >= existingDate) {
                    warningsData[i].isCancelled = true;
                    warningsData[i].reportDateTime = reportDateTime;
                  }
                }
              }
              // まだDBにないが、未来の解除情報が先に来た場合はダミーとして登録しておく
              if (!found) {
                warningsData.push({
                  xmlId, region, reportDateTime, infoType, warningName: wName, level, areaType, prefecture, status, isCancelled: true
                });
              }
              continue;
            }

          // 2. 「発表」またはそれ以外の場合：DB(配列)に追加
          // 同じ警報が既にある場合は重複を防ぐため削除してから追加する
          let existingIndex = -1;
          for (let i = warningsData.length - 1; i >= 0; i--) {
            if (warningsData[i].region === region && warningsData[i].areaType === areaType && warningsData[i].warningName === wName) {
              existingIndex = i;
              break;
            }
          }

          if (existingIndex >= 0) {
            const existingDate = new Date(warningsData[existingIndex].reportDateTime).getTime();
            const newDate = new Date(reportDateTime).getTime();
            
            if (newDate < existingDate) {
               continue; // 新しいデータ（または解除）がすでにあるなら、古いデータでの上書きを防ぐ
            }
            
            // 既存データを更新 (解除フラグを落とす)
            warningsData[existingIndex] = { ...warningsData[existingIndex], xmlId, reportDateTime, warningCode: kindCode || '', warningLevel: level, infoType, status, isCancelled: false };
          } else {
            warningsData.push({
              xmlId, reportDateTime, region, prefecture, areaType, 
              warningCode: kindCode || '', warningName: wName, warningLevel: level, infoType, status, isCancelled: false
            });
          }
          }
        }
      }
    }
  },

  processEarthquakeToMemory(report: any, xmlId: string, infoType: string, earthquakesData: any[]) {
    const earthquakes = Array.isArray(report.Body?.Earthquake) ? report.Body.Earthquake : (report.Body?.Earthquake ? [report.Body.Earthquake] : []);
    
    for (const earthquake of earthquakes) {
      if (!earthquake) continue;
      
      const originTime = earthquake.OriginTime;
      const hypocenter = earthquake.Hypocenter?.Area?.Name;
      let magnitude = earthquake.Magnitude?.['#text'] || earthquake.Magnitude;
      if (typeof magnitude !== 'string' && typeof magnitude !== 'number') magnitude = '';

      const maxInt = report.Body?.Intensity?.Observation?.MaxInt;

      if (originTime && hypocenter) {
        earthquakesData.push({
          xmlId, originTime, hypocenterName: hypocenter, 
          magnitude: magnitude || '', maxIntensity: maxInt || '', depth: 0
        });
        
        // 直近200件に制限
        if (earthquakesData.length > 200) {
          earthquakesData.shift(); // 古いものを削除
        }
      }
    }
  },

  processTyphoonToMemory(report: any, xmlId: string, updated: string, typhoonsData: any[]) {
    const infos = report.Body?.MeteorologicalInfos;
    if (!infos) return;

    const metInfos = Array.isArray(infos.MeteorologicalInfo) ? infos.MeteorologicalInfo : (infos.MeteorologicalInfo ? [infos.MeteorologicalInfo] : []);
    
    let tcNumber = '';
    let name = '';
    let nameEn = '';
    let typhoonClass = '';
    let intensityClass = '';
    let areaClass = '';
    let centerLat = 0;
    let centerLon = 0;
    let location = '';
    let direction = '';
    let speedKmh = 0;
    let pressure = 0;
    let maxWind = 0;
    let gustWind = 0;
    let stormRadii: any[] = [];
    let galeRadii: any[] = [];
    let stormCenterLat: number | null = null;
    let stormCenterLon: number | null = null;
    let galeCenterLat: number | null = null;
    let galeCenterLon: number | null = null;
    let currentDateTimeStr = '';
    const forecasts: any[] = [];
    let headlineText = report.Head?.Headline?.Text || '';

    for (const info of metInfos) {
      const dateTimeObj = info.DateTime || info['@_dateTime'];
      let dateTimeStr = '';
      let forecastType = '';
      if (dateTimeObj && typeof dateTimeObj === 'object') {
        dateTimeStr = dateTimeObj['#text'] || '';
        forecastType = dateTimeObj['@_type'] || '';
      } else {
        dateTimeStr = dateTimeObj || '';
      }
      
      const isCurrent = forecastType === '実況' || forecastType.includes('推定');

      const items = info.Item ? (Array.isArray(info.Item) ? info.Item : [info.Item]) : [];
      
      for (const item of items) {
        const kinds = item.Kind ? (Array.isArray(item.Kind) ? item.Kind : [item.Kind]) : [];
        
        let fLat = 0, fLon = 0, fPressure = 0, fMaxWind = 0, fGustWind = 0;
        let fDirection = '', fSpeedKmh = 0, fClass = '', fIntensity = '', fLocation = '';
        let fCircleRadiusKm = 0;
        let fStormRadii: any[] = [];
        let fGaleRadii: any[] = [];
        let fStormCenterLat: number | null = null;
        let fStormCenterLon: number | null = null;
        let fGaleCenterLat: number | null = null;
        let fGaleCenterLon: number | null = null;
        
        for (const kind of kinds) {
          const prop = kind?.Property;
          if (!prop) continue;
          
          if (prop.TyphoonNamePart) {
            tcNumber = prop.TyphoonNamePart.Number || tcNumber;
            name = prop.TyphoonNamePart.NameKana || name;
            nameEn = prop.TyphoonNamePart.Name || nameEn;
          }
          
          if (prop.ClassPart) {
            const tc = prop.ClassPart.TyphoonClass;
            const ic = prop.ClassPart.IntensityClass;
            const ac = prop.ClassPart.AreaClass;
            const tcText = typeof tc === 'object' ? tc['#text'] : tc;
            const icText = typeof ic === 'object' ? ic['#text'] : ic;
            const acText = typeof ac === 'object' ? ac['#text'] : ac;
            if (forecastType === '実況') {
              typhoonClass = tcText || typhoonClass;
              intensityClass = icText || intensityClass;
              areaClass = acText || areaClass;
            }
            fClass = tcText || '';
            fIntensity = icText || '';
          }
          
          if (prop.CenterPart) {
            const cp = prop.CenterPart;
            const coords = cp.Coordinate ? (Array.isArray(cp.Coordinate) ? cp.Coordinate : [cp.Coordinate]) : [];
            let parsedLat: number | null = null;
            let parsedLon: number | null = null;
            let precision = 0; // 0: none, 1: 度, 2: 度分

            for (const c of coords) {
              const ct = typeof c === 'object' ? (c['@_type'] || '') : '';
              const cv = typeof c === 'object' ? (c['#text'] || '') : String(c);
              
              if (ct.includes('度分') && precision < 2) {
                const m = String(cv).match(/([+-]\d+)(\d{2})([+-]\d+)(\d{2})/);
                if (m) {
                  const isLatNeg = m[1].startsWith('-');
                  const isLonNeg = m[3].startsWith('-');
                  parsedLat = (Math.abs(parseInt(m[1], 10)) + parseInt(m[2], 10) / 60) * (isLatNeg ? -1 : 1);
                  parsedLon = (Math.abs(parseInt(m[3], 10)) + parseInt(m[4], 10) / 60) * (isLonNeg ? -1 : 1);
                  precision = 2;
                }
              } else if (ct.includes('度）') && precision < 1) {
                const m = String(cv).match(/([+-]\d+\.?\d*)([+-]\d+\.?\d*)/);
                if (m) {
                  parsedLat = parseFloat(m[1]);
                  parsedLon = parseFloat(m[2]);
                  precision = 1;
                }
              }
            }

            if (parsedLat !== null && parsedLon !== null) {
              if (isCurrent) {
                centerLat = parsedLat;
                centerLon = parsedLon;
                currentDateTimeStr = dateTimeStr;
              }
              fLat = parsedLat;
              fLon = parsedLon;
            }
            
            if (cp.Location) { if (isCurrent) location = cp.Location; fLocation = cp.Location; }
            if (cp.Direction) {
              const dText = typeof cp.Direction === 'object' ? cp.Direction['#text'] : cp.Direction;
              if (isCurrent) direction = dText || '';
              fDirection = dText || '';
            }
            if (cp.Speed) {
              const speeds = Array.isArray(cp.Speed) ? cp.Speed : [cp.Speed];
              for (const s of speeds) {
                if (s['@_unit'] === 'km/h') {
                  if (isCurrent) speedKmh = s['#text'] || 0;
                  fSpeedKmh = s['#text'] || 0;
                }
              }
            }
            if (cp.Pressure) {
              if (isCurrent) pressure = cp.Pressure['#text'] || 0;
              fPressure = cp.Pressure['#text'] || 0;
            }
            // 予報円
            if (cp.ProbabilityCircle) {
              const pc = cp.ProbabilityCircle;
              const bps = pc.BasePoint ? (Array.isArray(pc.BasePoint) ? pc.BasePoint : [pc.BasePoint]) : [];
              for (const bp of bps) {
                const bpType = bp['@_type'] || '';
                if (bpType.includes('度）') && !bpType.includes('度分')) {
                  const m = String(bp['#text'] || '').match(/([+-]\d+\.?\d*)([+-]\d+\.?\d*)/);
                  if (m) { fLat = parseFloat(m[1]); fLon = parseFloat(m[2]); }
                }
              }
              if (pc.Axes?.Axis) {
                const axes = Array.isArray(pc.Axes.Axis) ? pc.Axes.Axis : [pc.Axes.Axis];
                for (const ax of axes) {
                  const radii = ax.Radius ? (Array.isArray(ax.Radius) ? ax.Radius : [ax.Radius]) : [];
                  for (const r of radii) {
                    if (r['@_unit'] === 'km' && String(r['@_type']).includes('確率半径')) {
                      fCircleRadiusKm = r['#text'] || 0;
                    }
                  }
                }
              }
              if (cp.Location) fLocation = cp.Location;
              if (cp.Direction) { const d2 = typeof cp.Direction === 'object' ? cp.Direction['#text'] : cp.Direction; fDirection = d2 || ''; }
              if (cp.Speed) { const sp2 = Array.isArray(cp.Speed) ? cp.Speed : [cp.Speed]; for (const s2 of sp2) { if (s2['@_unit'] === 'km/h') fSpeedKmh = s2['#text'] || 0; } }
              if (cp.Pressure) fPressure = cp.Pressure['#text'] || 0;
            }
          }
          
          if (prop.WindPart) {
            const ws = prop.WindPart.WindSpeed;
            if (ws) {
              const wsArr = Array.isArray(ws) ? ws : [ws];
              for (const w of wsArr) {
                if (w['@_unit'] === 'm/s') {
                  const wType = w['@_type'] || '';
                  if (wType.includes('最大風速')) {
                    if (isCurrent) maxWind = w['#text'] || 0;
                    fMaxWind = w['#text'] || 0;
                  }
                  if (wType.includes('最大瞬間風速')) {
                    if (isCurrent) gustWind = w['#text'] || 0;
                    fGustWind = w['#text'] || 0;
                  }
                }
              }
            }
            if (prop.WarningAreaPart) {
              const waps = Array.isArray(prop.WarningAreaPart) ? prop.WarningAreaPart : [prop.WarningAreaPart];
              for (const wap of waps) {
                const wapType = wap['@_type'] || '';
                if (wap.Circle) {
                  const circles = Array.isArray(wap.Circle) ? wap.Circle : [wap.Circle];
                  for (const c of circles) {
                    if (c.Axes && c.Axes.Axis) {
                      const axArr = Array.isArray(c.Axes.Axis) ? c.Axes.Axis : [c.Axes.Axis];
                      const radiiData: any[] = [];
                      for (const ax of axArr) {
                        const dir = ax.Direction ? (typeof ax.Direction === 'object' ? ax.Direction['#text'] : ax.Direction) : '';
                        const rArr = ax.Radius ? (Array.isArray(ax.Radius) ? ax.Radius : [ax.Radius]) : [];
                        for (const r of rArr) {
                          if (r['@_unit'] === 'km') {
                            radiiData.push({ direction: dir, radiusKm: parseFloat(r['#text']) || 0 });
                          }
                        }
                      }
                      
                      let bpLat: number | null = null;
                      let bpLon: number | null = null;
                      if (c.BasePoint) {
                        const bps = Array.isArray(c.BasePoint) ? c.BasePoint : [c.BasePoint];
                        let precision = 0;
                        for (const bp of bps) {
                          const ct = typeof bp === 'object' ? (bp['@_type'] || '') : '';
                          const cv = typeof bp === 'object' ? (bp['#text'] || '') : String(bp);
                          if (ct.includes('度分') && precision < 2) {
                            const m = String(cv).match(/([+-]\d+)(\d{2})([+-]\d+)(\d{2})/);
                            if (m) {
                              const isLatNeg = m[1].startsWith('-');
                              const isLonNeg = m[3].startsWith('-');
                              bpLat = (Math.abs(parseInt(m[1], 10)) + parseInt(m[2], 10) / 60) * (isLatNeg ? -1 : 1);
                              bpLon = (Math.abs(parseInt(m[3], 10)) + parseInt(m[4], 10) / 60) * (isLonNeg ? -1 : 1);
                              precision = 2;
                            }
                          } else if (ct.includes('度）') && precision < 1) {
                            const m = String(cv).match(/([+-]\d+\.?\d*)([+-]\d+\.?\d*)/);
                            if (m) {
                              bpLat = parseFloat(m[1]);
                              bpLon = parseFloat(m[2]);
                              precision = 1;
                            }
                          }
                        }
                      }

                      if (radiiData.length > 0) {
                        if (wapType.includes('暴風')) {
                          if (isCurrent) { stormRadii = radiiData; stormCenterLat = bpLat; stormCenterLon = bpLon; }
                          else { fStormRadii = radiiData; fStormCenterLat = bpLat; fStormCenterLon = bpLon; }
                        } else if (wapType.includes('強風')) {
                          if (isCurrent) { galeRadii = radiiData; galeCenterLat = bpLat; galeCenterLon = bpLon; }
                          else { fGaleRadii = radiiData; fGaleCenterLat = bpLat; fGaleCenterLon = bpLon; }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        
        // 暴風域・強風域の抽出（Areaから）
        if (item.Area) {
          const areas = Array.isArray(item.Area) ? item.Area : [item.Area];
          for (const area of areas) {
            if (area.Circle) {
              const areaCircles = Array.isArray(area.Circle) ? area.Circle : [area.Circle];
              for (const ac of areaCircles) {
                if (ac.Axes?.Axis) {
                  const axArr = Array.isArray(ac.Axes.Axis) ? ac.Axes.Axis : [ac.Axes.Axis];
                  const radiiData: any[] = [];
                  for (const ax of axArr) {
                    const dir = ax.Direction ? (typeof ax.Direction === 'object' ? ax.Direction['#text'] : ax.Direction) : '';
                    const rArr = ax.Radius ? (Array.isArray(ax.Radius) ? ax.Radius : [ax.Radius]) : [];
                    for (const r of rArr) {
                      if (r['@_unit'] === 'km') {
                        radiiData.push({ direction: dir, radiusKm: r['#text'] || 0 });
                      }
                    }
                  }
                  if (radiiData.length > 0) {
                    if (isCurrent) {
                      // 暴風域は種別を名前から判定
                      const areaName = area.Name || '';
                      if (areaName.includes('暴風') && !areaName.includes('警戒')) {
                        stormRadii = radiiData;
                      } else {
                        galeRadii = radiiData;
                      }
                    } else {
                      const areaName = area.Name || '';
                      if (areaName.includes('暴風') && !areaName.includes('警戒')) {
                        fStormRadii = radiiData;
                      } else {
                        fGaleRadii = radiiData;
                      }
                    }
                  }
                }
              }
            }
          }
        }
        
        // 予報情報を保存
        if (forecastType && !isCurrent && (fLat || fLon)) {
          forecasts.push({
            type: forecastType,
            dateTime: dateTimeStr,
            lat: fLat, lon: fLon,
            circleRadiusKm: fCircleRadiusKm,
            pressure: fPressure,
            maxWind: fMaxWind,
            gustWind: fGustWind,
            direction: fDirection,
            speedKmh: fSpeedKmh,
            typhoonClass: fClass,
            intensity: fIntensity,
            location: fLocation,
            stormRadii: fStormRadii,
            galeRadii: fGaleRadii,
          });
        }
      }
    }

    if (tcNumber) {
      if (!name) name = '熱帯低気圧';
      
      for (let i = typhoonsData.length - 1; i >= 0; i--) {
        if (typhoonsData[i].tcNumber === tcNumber) {
          typhoonsData.splice(i, 1);
        }
      }
      
      typhoonsData.push({
        xmlId,
        tcNumber,
        name,
        nameEn,
        headlineText,
        updatedAt: updated,
        current: {
          dateTime: currentDateTimeStr || updated,
          lat: centerLat, lon: centerLon,
          location, direction, speedKmh, pressure,
          maxWind, gustWind,
          typhoonClass, intensityClass, areaClass,
          stormRadii, galeRadii,
          stormCenterLat, stormCenterLon, galeCenterLat, galeCenterLon
        },
        forecasts,
      });
      
      if (typhoonsData.length > 20) {
        typhoonsData.shift();
      }
    }
  },

  async syncMapJsonState(env: Env) {
    try {
      const [mapRes, areaRes] = await Promise.all([
        fetch('https://www.jma.go.jp/bosai/warning/data/warning/map.json'),
        fetch('https://www.jma.go.jp/bosai/common/const/area.json')
      ]);

      if (!mapRes.ok || !areaRes.ok) return;

      const mapData = await mapRes.json() as any;
      const areaData = await areaRes.json() as any;

      const areaCodeToName = (code: string) => {
          if (areaData.class20s && areaData.class20s[code]) return areaData.class20s[code].name;
          if (areaData.class15s && areaData.class15s[code]) return areaData.class15s[code].name;
          if (areaData.class10s && areaData.class10s[code]) return areaData.class10s[code].name;
          if (areaData.offices && areaData.offices[code]) return areaData.offices[code].name;
          if (areaData.centers && areaData.centers[code]) return areaData.centers[code].name;
          return code;
      };
      
      const getPrefecture = (code: string) => {
          if (areaData.class20s && areaData.class20s[code]) return normalizePrefectureName(areaData.class20s[code].parent);
          if (areaData.class15s && areaData.class15s[code]) return normalizePrefectureName(areaData.class15s[code].parent);
          if (areaData.class10s && areaData.class10s[code]) return normalizePrefectureName(areaData.class10s[code].parent);
          return '';
      }

      let warningsData: any[] = [];
      const reportDateTimeFallback = new Date().toISOString(); 

      for (const report of mapData) {
          if (!report.areaTypes) continue;
          const rDate = report.reportDatetime || reportDateTimeFallback;
          for (const areaTypeObj of report.areaTypes) {
              for (const area of areaTypeObj.areas) {
                  const areaCode = area.code;
                  const regionName = areaCodeToName(areaCode);
                  const prefecture = getPrefecture(areaCode) || OFFICE_CODE_TO_PREF[areaCode] || '';
                  
                  for (const w of area.warnings) {
                      if (w.status === '発表' || w.status === '継続') {
                          const warningCode = w.code;
                          const wInfo = WARNING_CODES[warningCode];
                          if (wInfo) {
                              warningsData.push({
                                  xmlId: `mapjson-${areaCode}-${warningCode}`,
                                  reportDateTime: rDate,
                                  region: regionName,
                                  prefecture: prefecture,
                                  areaType: 'class20s',
                                  warningCode: warningCode,
                                  warningName: wInfo.name,
                                  warningLevel: wInfo.level,
                                  infoType: '発表',
                                  status: w.status,
                                  isCancelled: false
                              });
                          }
                      }
                  }
              }
          }
      }

      await env.WEATHER_DATA_STORE.put('warnings', JSON.stringify(warningsData));
    } catch (e) {
      console.error('Failed syncMapJsonState', e);
    }
  },

  async syncInitialJmaData(env: Env) {
    let earthquakesData: any[] = [];
    try {
      const eqRes = await fetch("https://www.jma.go.jp/bosai/quake/data/list.json");
      if (eqRes.ok) {
        const eqList = await eqRes.json() as any[];
        earthquakesData = eqList.slice(0, 200).map((eq: any) => ({
          xmlId: eq.json || `initial-${eq.eid}`,
          originTime: eq.at,
          hypocenterName: eq.anm || '',
          magnitude: eq.mag || '',
          maxIntensity: eq.maxi || '',
          depth: 0
        }));
      }
    } catch (e) {
      console.error("Failed to fetch initial earthquakes", e);
    }
    
    // 警報はmap.jsonから完全構築するため一旦実行する
    await this.syncMapJsonState(env);
    
    await env.WEATHER_DATA_STORE.put('earthquakes', JSON.stringify(earthquakesData));
    await env.WEATHER_DATA_STORE.put('typhoons', JSON.stringify([]));
    await env.WEATHER_DATA_STORE.put('processed_feeds', JSON.stringify([]));
    await env.WEATHER_DATA_STORE.put('sync_state', JSON.stringify({ items: [], total: 0 }));
    await env.WEATHER_DATA_STORE.put('status', JSON.stringify({ lastUpdated: new Date().toISOString() }));

    // XMLフィードから地震と台風の最新状態を構築 (isInitialSync = true)
    await this.updateJmaData(env, true);

  }
};
