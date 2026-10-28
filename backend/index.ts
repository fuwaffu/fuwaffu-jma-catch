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

// 温帯低気圧化・熱帯低気圧化（台風としての情報終了）後は電文が止まるため、
// 最終更新からこの日数が経過した台風は一覧から削除する（発表中の台風は3〜6時間毎に更新される）
const TYPHOON_EXPIRE_DAYS = 3;

export function pruneExpiredTyphoons(typhoons: any[], now = Date.now()): any[] {
  const limit = TYPHOON_EXPIRE_DAYS * 24 * 60 * 60 * 1000;
  return typhoons.filter((t: any) => {
    const ts = new Date(t.updatedAt || t.current?.dateTime).getTime();
    return isNaN(ts) || now - ts < limit;
  });
}

// "+32.3+130.5-10000/" → { lat, lon, depthKm }
export function parseQuakeCoordinate(coord: any): { lat: number; lon: number; depthKm: number | null } | null {
  const text = typeof coord === 'object' && coord !== null ? coord['#text'] : coord;
  const m = String(text || '').match(/([+-]\d+\.?\d*)([+-]\d+\.?\d*)([+-]\d+\.?\d*)?\//);
  if (!m) return null;
  return { lat: parseFloat(m[1]), lon: parseFloat(m[2]), depthKm: m[3] ? Math.abs(parseFloat(m[3])) / 1000 : null };
}

async function cachedKvQuery(
  cacheKey: string,
  env: Env,
  corsHeaders: Record<string, string>,
  transform?: (data: any) => any
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
  let data = await env.WEATHER_DATA_STORE.get(cacheKey, { type: 'json' });
  if (data === null) {
    if (cacheKey === 'status') data = { lastUpdated: null };
    else data = [];
  }
  if (transform) data = transform(data);

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
      if (url.pathname === "/api/earthquake-detail") {
        const id = url.searchParams.get('id') || '';
        const eid = url.searchParams.get('eid') || '';
        const time = url.searchParams.get('time') || '';
        const anm = url.searchParams.get('anm') || '';

        let targetJsonFilename = '';
        if (id.endsWith('.json')) {
          targetJsonFilename = id.split('/').pop()?.replace(/[^a-zA-Z0-9_.]/g, '') || '';
        }

        // list.jsonから該当する地震のJSONファイル名を特定（震源・震度情報 VXSE5k/VXSE53 を最優先）
        if (!targetJsonFilename) {
          try {
            const listRes = await fetch('https://www.jma.go.jp/bosai/quake/data/list.json', {
              headers: { 'User-Agent': 'Jma-Dashboard/1.0' }
            });
            if (listRes.ok) {
              const list = await listRes.json() as any[];
              
              // 同一地震のエントリを絞り込み
              const matchingEntries = list.filter((e: any) => {
                if (eid && (e.eid === eid || e.json?.includes(eid))) return true;
                if (time && e.at && Math.abs(new Date(e.at).getTime() - new Date(time).getTime()) < 120000) {
                  if (anm && e.anm) return e.anm.includes(anm) || anm.includes(e.anm);
                  return true;
                }
                if (id) {
                  const m = id.match(/(\d{14})/);
                  if (m && e.json?.includes(m[1])) return true;
                }
                return false;
              });

              if (matchingEntries.length > 0) {
                // 震源・震度情報 (VXSE5k, VXSE53) を最優先、なければ震度速報 (VXSE51) を優先
                const intensityReport = matchingEntries.find((e: any) => 
                  e.ttl?.includes('震源・震度') || e.json?.includes('VXSE5k') || e.json?.includes('VXSE53')
                ) || matchingEntries.find((e: any) => 
                  e.ttl?.includes('震度') || e.json?.includes('VXSE51')
                ) || matchingEntries[0];

                if (intensityReport?.json) {
                  targetJsonFilename = intensityReport.json;
                }
              }
            }
          } catch(e) {
            console.error('Error querying JMA list.json:', e);
          }
        }

        if (targetJsonFilename) {
          const jmaUrl = `https://www.jma.go.jp/bosai/quake/data/${targetJsonFilename}`;
          const jmaRes = await fetch(jmaUrl, { headers: { 'User-Agent': 'Jma-Dashboard/1.0' } });
          if (jmaRes.ok) {
            const jsonText = await jmaRes.text();
            return new Response(jsonText, {
              headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" }
            });
          }
        }

        // 直接XMLのURLが指定されていてJSONが見つからなかった場合、XMLを取得して返すフォールバック
        if (id.startsWith('http')) {
          const xmlRes = await fetch(id, { headers: { 'User-Agent': 'Jma-Dashboard/1.0' } });
          if (xmlRes.ok) {
            const xmlText = await xmlRes.text();
            return new Response(xmlText, {
              headers: { ...corsHeaders, "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" }
            });
          }
        }

        return new Response(JSON.stringify({ error: "Earthquake detail not found" }), { status: 404, headers: corsHeaders });
      }
      if (url.pathname === "/api/typhoons") return await cachedKvQuery('typhoons', env, corsHeaders, (d) => pruneExpiredTyphoons(d));
      if (url.pathname === "/api/status") {
        let status: any = { lastUpdated: null, isSyncing: false, progress: 0 };
        try {
          const raw = await env.WEATHER_DATA_STORE.get('status');
          if (raw) status = { ...status, ...JSON.parse(raw) };
          const current = parseInt(await env.WEATHER_DATA_STORE.get('sync_current') || '0');
          const target = parseInt(await env.WEATHER_DATA_STORE.get('sync_target') || '0');
          status.current = current;
          status.target = target;
          if (target > 0) {
            status.isSyncing = current < target;
            status.progress = Math.min(100, Math.round((current / target) * 100));
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
        await this.updateJmaData(env);
        await invalidateApiCaches();
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/sync-step") {
        let syncQueue: any[] = await env.WEATHER_DATA_STORE.get('sync_queue', { type: 'json' }) || [];
        const currentTarget = parseInt(await env.WEATHER_DATA_STORE.get('sync_target') || '0');
        const currentProgress = parseInt(await env.WEATHER_DATA_STORE.get('sync_current') || '0');
        
        if (syncQueue.length === 0) {
            return new Response(JSON.stringify({ ok: true, isSyncing: false, progress: 100 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        const msg = syncQueue.shift();
        const batch = { messages: [{ body: msg }] };
        await this.queue(batch, env, ctx); // Reuse the queue logic!
        
        await env.WEATHER_DATA_STORE.put('sync_queue', JSON.stringify(syncQueue));
        
        const progress = currentTarget > 0 ? Math.min(100, Math.round(((currentProgress + 1) / currentTarget) * 100)) : 0;
        return new Response(JSON.stringify({ ok: true, isSyncing: syncQueue.length > 0, progress, current: currentProgress + 1, target: currentTarget }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/sync-initial") {
        await this.syncInitialJmaData(env);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/debug-kv") {
        const target = await env.WEATHER_DATA_STORE.get('sync_target');
        const current = await env.WEATHER_DATA_STORE.get('sync_current');
        const queueLastRun = await env.WEATHER_DATA_STORE.get('debug_queue_last_run');
        const queueError = await env.WEATHER_DATA_STORE.get('debug_queue_error');
        return new Response(JSON.stringify({ target, current, queueLastRun, queueError }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/clear-cache") {
        await env.WEATHER_DATA_STORE.delete('processed_feeds');
        await env.WEATHER_DATA_STORE.delete('typhoons');
        await env.WEATHER_DATA_STORE.delete('warnings');
        await env.WEATHER_DATA_STORE.delete('earthquakes');
        await env.WEATHER_DATA_STORE.delete('sync_target');
        await env.WEATHER_DATA_STORE.delete('sync_current');
        await invalidateApiCaches();
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },


  async queue(batch: any, env: Env, ctx: ExecutionContext) {
    try {
      await env.WEATHER_DATA_STORE.put('debug_queue_last_run', new Date().toISOString() + ' size: ' + batch.messages.length);
      
      console.log('QUEUE STARTED, batch size:', batch.messages.length);
      let warningsData: any[] = await env.WEATHER_DATA_STORE.get('warnings', { type: 'json' }) || [];
    let earthquakesData: any[] = await env.WEATHER_DATA_STORE.get('earthquakes', { type: 'json' }) || [];
    let typhoonsData: any[] = await env.WEATHER_DATA_STORE.get('typhoons', { type: 'json' }) || [];

    let warningsUpdated = false;
    let earthquakesUpdated = false;
    let typhoonsUpdated = false;

    for (const msg of batch.messages) {
       const { id, link, updated, telegramCode } = msg.body;
       try {
           const xmlRes = await fetch(link, { headers: { 'User-Agent': 'Jma-Dashboard/1.0' } });
           if (!xmlRes.ok) continue;
           const xmlText = await xmlRes.text();
           const xmlData = parser.parse(xmlText);

           const report = xmlData.Report;
           if (!report) continue;

           const status = report.Control?.Status;
           if (status !== '通常') continue;

           const infoType = report.Head?.InfoType;
           const reportDateTime = report.Head?.ReportDateTime;

           if (telegramCode === 'VPWW') {
             this.processWarningToMemory(report, id, reportDateTime, infoType, status, warningsData);
             warningsUpdated = true;
           } else if (telegramCode === 'VXSE') {
             this.processEarthquakeToMemory(report, id, infoType, earthquakesData);
             earthquakesUpdated = true;
           } else if (telegramCode === 'VPTW') {
             this.processTyphoonToMemory(report, id, updated, typhoonsData);
             typhoonsUpdated = true;
           }
       } catch (e) {
           console.error('Failed to process message for id: ' + id, e);
       }
    }

    if (warningsUpdated) {
        await env.WEATHER_DATA_STORE.put('warnings', JSON.stringify(warningsData));
    }
    if (earthquakesUpdated) {
        await env.WEATHER_DATA_STORE.put('earthquakes', JSON.stringify(earthquakesData));
    }
    if (typhoonsUpdated) {
        typhoonsData = pruneExpiredTyphoons(typhoonsData);
        await this.backfillTyphoonTracks(typhoonsData);
        await env.WEATHER_DATA_STORE.put('typhoons', JSON.stringify(typhoonsData));
    }
    
    try {
        const currentProgress = parseInt(await env.WEATHER_DATA_STORE.get('sync_current') || '0');
        await env.WEATHER_DATA_STORE.put('sync_current', (currentProgress + batch.messages.length).toString());
    } catch(e) {}

    if (warningsUpdated || earthquakesUpdated || typhoonsUpdated) {
        await env.WEATHER_DATA_STORE.put('status', JSON.stringify({ lastUpdated: new Date().toISOString() }));
        await invalidateApiCaches();
    }
    } catch (queueErr) {
       await env.WEATHER_DATA_STORE.put('debug_queue_error', String(queueErr));
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(this.updateJmaData(env));
  },

  async updateJmaData(env: Env, isInitialSync = false) {
    const feedUrls = [
      'https://www.data.jma.go.jp/developer/xml/feed/extra.xml',
      'https://www.data.jma.go.jp/developer/xml/feed/extra_l.xml',
      'https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml'
    ];

    let processedFeeds: string[] = await env.WEATHER_DATA_STORE.get('processed_feeds', { type: 'json' }) || [];
    if (isInitialSync) {
      processedFeeds = []; // Force clear cache for initial sync so it reparses
    }
    const processedFeedsSet = new Set(processedFeeds);
    
    let fetchCount = 0;
    const MAX_SUBREQUESTS = 45; // Cloudflare limits to 50
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

        if (isInitialSync) {
            const typhoons = candidateEntries.filter((e: any) => e.link?.['@_href'].includes('_VPTW'));
            const earthquakes = candidateEntries.filter((e: any) => e.link?.['@_href'].includes('_VXSE'));
            const warnings = candidateEntries.filter((e: any) => e.link?.['@_href'].match(/_(VPWW|VXWW|VXXX)/));
            
            candidateEntries = [
                ...typhoons.slice(0, 2),
                ...earthquakes.slice(0, 10),
                ...warnings.slice(0, MAX_SUBREQUESTS - 12)
            ].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
        } else {
            candidateEntries = candidateEntries.slice(0, 150);
        }

        const newEntries = [];
        for (const entry of candidateEntries) {
          if (processedFeedsSet.has(entry.id)) continue;
          newEntries.push(entry);
        }

        
        const messagesToSend = [];
        for (const entry of newEntries.reverse()) {
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
            const currentTarget = parseInt(await env.WEATHER_DATA_STORE.get('sync_target') || '0');
            const currentProgress = parseInt(await env.WEATHER_DATA_STORE.get('sync_current') || '0');
            let syncQueue: any[] = await env.WEATHER_DATA_STORE.get('sync_queue', { type: 'json' }) || [];
            
            if (currentTarget > 0 && currentProgress >= currentTarget) {
              await env.WEATHER_DATA_STORE.put('sync_target', messagesToSend.length.toString());
              await env.WEATHER_DATA_STORE.put('sync_current', '0');
              syncQueue = messagesToSend;
            } else {
              await env.WEATHER_DATA_STORE.put('sync_target', (currentTarget + messagesToSend.length).toString());
              syncQueue.push(...messagesToSend);
            }
            await env.WEATHER_DATA_STORE.put('sync_queue', JSON.stringify(syncQueue));
          } catch(e) {
            console.error('Failed to update sync_queue in KV', e);
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
        
          // 既存の同一region+areaTypeのデータを削除
          for (let i = warningsData.length - 1; i >= 0; i--) {
            if (warningsData[i].region === region && warningsData[i].areaType === areaType) {
              warningsData.splice(i, 1);
            }
          }

          const kinds = Array.isArray(item.Kind) ? item.Kind : (item.Kind ? [item.Kind] : []);
          
          for (const kind of kinds) {
            if (!kind) continue;
            const kindName = kind.Name;
            const kindCode = kind.Code;
            if (!kindName) continue;
            if (kindName.includes('解除') || kindName === 'なし') continue;
            if (kind.Status === '解除') continue;

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

            warningsData.push({
              xmlId, reportDateTime, region, prefecture, areaType, 
              warningCode: kindCode || '', warningName: wName, warningLevel: level, infoType, status
            });
          }
        }
      }
    }
  },

  processEarthquakeToMemory(report: any, xmlId: string, infoType: string, earthquakesData: any[]) {
    const eventId = String(report.Head?.EventID || '');
    if (infoType === '取消') {
      if (eventId) {
        for (let i = earthquakesData.length - 1; i >= 0; i--) {
          if (earthquakesData[i].eventId === eventId) earthquakesData.splice(i, 1);
        }
      }
      return;
    }

    const earthquakes = Array.isArray(report.Body?.Earthquake) ? report.Body.Earthquake : (report.Body?.Earthquake ? [report.Body.Earthquake] : []);
    const maxInt = report.Body?.Intensity?.Observation?.MaxInt;

    // 地震情報電文（震源情報、震度情報、または震度速報）の処理
    if (earthquakes.length > 0) {
      for (const earthquake of earthquakes) {
        if (!earthquake) continue;
        
        const originTime = earthquake.OriginTime || report.Head?.TargetDateTime || report.Head?.ReportDateTime || '';
        const hypocenter = earthquake.Hypocenter?.Area?.Name || '';
        let magnitude = earthquake.Magnitude?.['#text'] || earthquake.Magnitude;
        if (typeof magnitude !== 'string' && typeof magnitude !== 'number') magnitude = '';

        const coord = parseQuakeCoordinate(earthquake.Hypocenter?.Area?.Coordinate);

        if (originTime || hypocenter || eventId) {
          // 同一地震の既存データを検索（EventID一致、または同一発生時刻）
          let existingIdx = -1;
          if (eventId) {
            existingIdx = earthquakesData.findIndex(eq => eq.eventId === eventId);
          }
          if (existingIdx === -1 && originTime) {
            existingIdx = earthquakesData.findIndex(eq => eq.originTime === originTime && (hypocenter ? eq.hypocenterName === hypocenter : true));
          }

          if (existingIdx !== -1) {
            // 続報による上書き・更新（新情報で上書きし、未記載項目は既存値を維持）
            const prev = earthquakesData[existingIdx];
            earthquakesData[existingIdx] = {
              xmlId,
              eventId: eventId || prev.eventId,
              originTime: originTime || prev.originTime,
              hypocenterName: hypocenter || prev.hypocenterName,
              magnitude: (magnitude !== undefined && magnitude !== '') ? String(magnitude) : prev.magnitude,
              maxIntensity: maxInt || prev.maxIntensity || '',
              depth: (coord?.depthKm !== undefined && coord.depthKm !== null) ? coord.depthKm : prev.depth,
              lat: coord?.lat ?? prev.lat ?? null,
              lon: coord?.lon ?? prev.lon ?? null,
              updatedAt: new Date().toISOString()
            };
          } else {
            // 新規登録
            earthquakesData.push({
              xmlId,
              eventId,
              originTime,
              hypocenterName: hypocenter || '震源調査中',
              magnitude: magnitude ? String(magnitude) : '',
              maxIntensity: maxInt || '',
              depth: coord?.depthKm ?? 0,
              lat: coord?.lat ?? null,
              lon: coord?.lon ?? null,
              updatedAt: new Date().toISOString()
            });
          }
          
          // 直近200件に制限
          if (earthquakesData.length > 200) {
            earthquakesData.shift();
          }
        }
      }
    } else if (maxInt) {
      // 震度速報（VXSE51）などEarthquakeタグがなくIntensityのみの場合
      const originTime = report.Head?.TargetDateTime || report.Head?.ReportDateTime || '';
      let existingIdx = -1;
      if (eventId) {
        existingIdx = earthquakesData.findIndex(eq => eq.eventId === eventId);
      }
      if (existingIdx !== -1) {
        earthquakesData[existingIdx].maxIntensity = maxInt;
        earthquakesData[existingIdx].xmlId = xmlId;
        earthquakesData[existingIdx].updatedAt = new Date().toISOString();
      } else {
        earthquakesData.push({
          xmlId,
          eventId,
          originTime,
          hypocenterName: '震源調査中',
          magnitude: '',
          maxIntensity: maxInt,
          depth: 0,
          lat: null,
          lon: null,
          updatedAt: new Date().toISOString()
        });
        if (earthquakesData.length > 200) earthquakesData.shift();
      }
    }
  },

  // 気象庁防災情報JSON（bosai）から発表中の台風の経路（過去の位置）を取得して補完する
  async backfillTyphoonTracks(typhoonsData: any[]) {
    try {
      const res = await fetch('https://www.jma.go.jp/bosai/typhoon/data/targetTc.json', { headers: { 'User-Agent': 'Jma-Dashboard/1.0' } });
      if (!res.ok) return;
      const targets = await res.json() as any[];
      for (const t of targets) {
        const ty = typhoonsData.find((x: any) => String(x.tcNumber) === String(t.typhoonNumber));
        if (!ty || !t.tropicalCyclone) continue;
        const fRes = await fetch(`https://www.jma.go.jp/bosai/typhoon/data/${t.tropicalCyclone}/forecast.json`, { headers: { 'User-Agent': 'Jma-Dashboard/1.0' } });
        if (!fRes.ok) continue;
        const parts = await fRes.json() as any[];
        const track = parts.find((p: any) => p.track)?.track;
        if (track?.typhoon?.length) ty.track = track.typhoon;
        if (track?.preTyphoon?.length) ty.preTrack = track.preTyphoon;
      }
    } catch (e) {
      console.error('Failed to backfill typhoon tracks', e);
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
      
      // これまでの経路を引き継ぎ、前回の中心位置を追加する
      let track: [number, number][] = [];
      let preTrack: [number, number][] = [];
      for (let i = typhoonsData.length - 1; i >= 0; i--) {
        if (typhoonsData[i].tcNumber === tcNumber) {
          const prev = typhoonsData[i];
          track = Array.isArray(prev.track) ? prev.track : [];
          preTrack = Array.isArray(prev.preTrack) ? prev.preTrack : [];
          const pc = prev.current;
          const last = track[track.length - 1];
          if (pc?.lat && pc?.lon && pc.dateTime !== currentDateTimeStr && (!last || last[0] !== pc.lat || last[1] !== pc.lon)) {
            track = [...track, [pc.lat, pc.lon]];
          }
          typhoonsData.splice(i, 1);
        }
      }
      
      typhoonsData.push({
        track,
        preTrack,
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

  async syncInitialJmaData(env: Env) {
    let earthquakesData: any[] = [];
    try {
      const eqRes = await fetch("https://www.jma.go.jp/bosai/quake/data/list.json");
      if (eqRes.ok) {
        const eqList = await eqRes.json() as any[];
        // 同一地震の続報は最新のもの（list.jsonは新しい順）だけを残す
        const seen = new Set<string>();
        earthquakesData = eqList.filter((eq: any) => eq.anm && !seen.has(eq.eid) && seen.add(eq.eid)).slice(0, 200).map((eq: any) => {
          const coord = parseQuakeCoordinate(eq.cod);
          return {
            xmlId: eq.json || `initial-${eq.eid}`,
            eventId: eq.eid,
            originTime: eq.at,
            hypocenterName: eq.anm || '',
            magnitude: eq.mag || '',
            maxIntensity: eq.maxi || '',
            depth: coord?.depthKm ?? 0, lat: coord?.lat ?? null, lon: coord?.lon ?? null
          };
        }).reverse(); // 他の処理と同じく古い順で保持

      }
    } catch (e) {
      console.error("Failed to fetch initial earthquakes", e);
    }
    
    // 警報はXMLをベースに再構築するため、一旦空にしてprocessed_feedsもリセット
    await env.WEATHER_DATA_STORE.put('warnings', JSON.stringify([]));
    await env.WEATHER_DATA_STORE.put('earthquakes', JSON.stringify(earthquakesData));
    await env.WEATHER_DATA_STORE.put('typhoons', JSON.stringify([]));
    await env.WEATHER_DATA_STORE.put('processed_feeds', JSON.stringify([]));
    await env.WEATHER_DATA_STORE.put('status', JSON.stringify({ lastUpdated: new Date().toISOString() }));

    // XMLフィードから最新状態を構築 (isInitialSync = true)
    await this.updateJmaData(env, true);
  }
};
