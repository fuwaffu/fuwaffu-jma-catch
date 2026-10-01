import { XMLParser } from 'fast-xml-parser';

const OFFICE_CODE_TO_PREF: Record<string, string> = {
  "011000": "蛹玲ｵｷ驕・, "012000": "蛹玲ｵｷ驕・, "013000": "蛹玲ｵｷ驕・, "014030": "蛹玲ｵｷ驕・, "014100": "蛹玲ｵｷ驕・, "015000": "蛹玲ｵｷ驕・, "016000": "蛹玲ｵｷ驕・, "017000": "蛹玲ｵｷ驕・,
  "020000": "髱呈｣ｮ逵・, "030000": "蟯ｩ謇狗恁", "040000": "螳ｮ蝓守恁", "050000": "遘狗伐逵・, "060000": "螻ｱ蠖｢逵・, "070000": "遖丞ｳｶ逵・,
  "080000": "闌ｨ蝓守恁", "090000": "譬・惠逵・, "100000": "鄒､鬥ｬ逵・, "110000": "蝓ｼ邇臥恁", "120000": "蜊・痩逵・, "130000": "譚ｱ莠ｬ驛ｽ", "140000": "逾槫･亥ｷ晉恁",
  "150000": "譁ｰ貎溽恁", "160000": "蟇悟ｱｱ逵・, "170000": "遏ｳ蟾晉恁", "180000": "遖丈ｺ慕恁", "190000": "螻ｱ譴ｨ逵・, "200000": "髟ｷ驥守恁",
  "210000": "蟯宣・逵・, "220000": "髱吝ｲ｡逵・, "230000": "諢帷衍逵・, "240000": "荳蛾㍾逵・,
  "250000": "貊玖ｳ逵・, "260000": "莠ｬ驛ｽ蠎・, "270000": "螟ｧ髦ｪ蠎・, "280000": "蜈ｵ蠎ｫ逵・, "290000": "螂郁憶逵・, "300000": "蜥梧ｭ悟ｱｱ逵・,
  "310000": "魑･蜿也恁", "320000": "蟲ｶ譬ｹ逵・, "330000": "蟯｡螻ｱ逵・, "340000": "蠎・ｳｶ逵・, "350000": "螻ｱ蜿｣逵・,
  "360000": "蠕ｳ蟲ｶ逵・, "370000": "鬥吝ｷ晉恁", "380000": "諢帛ｪ帷恁", "390000": "鬮倡衍逵・,
  "400000": "遖丞ｲ｡逵・, "410000": "菴占ｳ逵・, "420000": "髟ｷ蟠守恁", "430000": "辭頑悽逵・, "440000": "螟ｧ蛻・恁", "450000": "螳ｮ蟠守恁", 
  "460040": "鮖ｿ蜈仙ｳｶ逵・, "460100": "鮖ｿ蜈仙ｳｶ逵・,
  "471000": "豐也ｸ・恁", "472000": "豐也ｸ・恁", "473000": "豐也ｸ・恁", "474000": "豐也ｸ・恁"
};

const WARNING_CODES: Record<string, { name: string; level: string; color: string }> = {
  '33': { name: '螟ｧ髮ｨ迚ｹ蛻･隴ｦ蝣ｱ', level: 'special', color: '#8B008B' },
  '35': { name: '證ｴ鬚ｨ迚ｹ蛻･隴ｦ蝣ｱ', level: 'special', color: '#8B008B' },
  '32': { name: '證ｴ鬚ｨ髮ｪ迚ｹ蛻･隴ｦ蝣ｱ', level: 'special', color: '#8B008B' },
  '36': { name: '螟ｧ髮ｪ迚ｹ蛻･隴ｦ蝣ｱ', level: 'special', color: '#8B008B' },
  '37': { name: '豕｢豬ｪ迚ｹ蛻･隴ｦ蝣ｱ', level: 'special', color: '#8B008B' },
  '38': { name: '鬮俶ｽｮ迚ｹ蛻･隴ｦ蝣ｱ', level: 'special', color: '#8B008B' },
  '03': { name: '螟ｧ髮ｨ隴ｦ蝣ｱ', level: 'warning', color: '#FF2800' },
  '04': { name: '豢ｪ豌ｴ隴ｦ蝣ｱ', level: 'warning', color: '#FF2800' },
  '05': { name: '證ｴ鬚ｨ隴ｦ蝣ｱ', level: 'warning', color: '#FF2800' },
  '06': { name: '證ｴ鬚ｨ髮ｪ隴ｦ蝣ｱ', level: 'warning', color: '#FF2800' },
  '07': { name: '螟ｧ髮ｪ隴ｦ蝣ｱ', level: 'warning', color: '#FF2800' },
  '08': { name: '豕｢豬ｪ隴ｦ蝣ｱ', level: 'warning', color: '#FF2800' },
  '09': { name: '鬮俶ｽｮ隴ｦ蝣ｱ', level: 'warning', color: '#FF2800' },
  '10': { name: '螟ｧ髮ｨ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '13': { name: '豢ｪ豌ｴ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '14': { name: '髮ｷ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '15': { name: '蠑ｷ鬚ｨ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '16': { name: '鬚ｨ髮ｪ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '17': { name: '螟ｧ髮ｪ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '18': { name: '豼・悸豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '19': { name: '豕｢豬ｪ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '20': { name: '鬮俶ｽｮ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '21': { name: '縺ｪ縺繧梧ｳｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '22': { name: '逹豌ｷ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '23': { name: '逹髮ｪ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '24': { name: '陞埼妛豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '25': { name: '髴懈ｳｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '26': { name: '菴取ｸｩ豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
  '27': { name: '荵ｾ辯･豕ｨ諢丞ｱ', level: 'advisory', color: '#FFD700' },
};

export function normalizePrefectureName(prefecture: string): string {
  if (prefecture.includes('蝨ｰ譁ｹ') && (prefecture.includes('螳苓ｰｷ') || prefecture.includes('荳雁ｷ・) || prefecture.includes('逡呵酔') || prefecture.includes('邯ｲ襍ｰ') || prefecture.includes('蛹苓ｦ・) || prefecture.includes('邏句挨') || prefecture.includes('蜊∝享') || prefecture.includes('驥ｧ霍ｯ') || prefecture.includes('譬ｹ螳､') || prefecture.includes('閭・険') || prefecture.includes('譌･鬮・) || prefecture.includes('遏ｳ迢ｩ') || prefecture.includes('遨ｺ遏･') || prefecture.includes('蠕悟ｿ・) || prefecture.includes('貂｡蟲ｶ') || prefecture.includes('讙懷ｱｱ'))) {
    return '蛹玲ｵｷ驕・;
  } else if (prefecture.includes('豐也ｸ・) || prefecture.includes('螟ｧ譚ｱ蟲ｶ') || prefecture.includes('螳ｮ蜿､蟲ｶ') || prefecture.includes('蜈ｫ驥榊ｱｱ')) {
    return '豐也ｸ・恁';
  } else if (prefecture.includes('螂・ｾ・) || prefecture.includes('鮖ｿ蜈仙ｳｶ')) {
    return '鮖ｿ蜈仙ｳｶ逵・;
  } else if (prefecture === '譚ｱ莠ｬ蝨ｰ譁ｹ') {
    return '譚ｱ莠ｬ驛ｽ';
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

// Cache TTL: 10蛻・const CACHE_TTL_SECONDS = 60;

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

  // KV縺九ｉ繝・・繧ｿ繧貞叙蠕・  let data: any = await env.WEATHER_DATA_STORE.get(cacheKey, { type: 'json' });
  if (data === null) {
    if (cacheKey === 'status') data = { lastUpdated: null };
    else data = [];
  } else if (Array.isArray(data)) {
    // 繧ｯ繝ｩ繧､繧｢繝ｳ繝医↓霑斐☆蜑阪↓隲也炊蜑企勁(isCancelled)縺輔ｌ縺溘ョ繝ｼ繧ｿ繧帝勁螟・    data = data.filter((d: any) => !d.isCancelled);
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
          
          // 蛻ｶ髯舌ぐ繝ｪ繧ｮ繝ｪ縺ｾ縺ｧ蜃ｦ逅・ 騾先ｬ｡蜃ｦ逅・＠縺ｪ縺後ｉ譎る俣繧定ｨ域ｸｬ
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

  // 蛻ｶ髯舌ぐ繝ｪ繧ｮ繝ｪ縺ｾ縺ｧ驕ｩ蠢懃噪縺ｫ繧ｭ繝･繝ｼ繧貞・逅・☆繧・  // syncQueue 縺ｯ in-place 縺ｧ splice 縺輔ｌ繧九・縺ｧ蜻ｼ縺ｳ蜃ｺ縺怜・縺ｧ縺昴・縺ｾ縺ｾ菫晏ｭ伜庄閭ｽ
  async processQueueAdaptive(syncQueue: any[], env: Env, ctx: ExecutionContext, maxXmlLengthOpt?: number): Promise<number> {
    const MAX_SUBREQUESTS = 99999; // Render.com 辟｡蛻ｶ髯・    // 繧ｯ繝ｩ繧､繧｢繝ｳ繝医°繧峨・謖・ｮ壹′縺ゅｌ縺ｰ縺昴ｌ繧剃ｽｿ逕ｨ縲√↑縺代ｌ縺ｰ500KB
    const MAX_XML_LENGTH_PER_BATCH = maxXmlLengthOpt || 500000; 
    let processed = 0;
    let totalXmlLength = 0;
    
    // 蠢・ｦ√↑繝・・繧ｿ繧ｹ繝医い繧貞・縺ｫ繝ｭ繝ｼ繝会ｼ医せ繝槭・繝・ET・・    let warningsData: any[] | null = null;
    let earthquakesData: any[] | null = null;
    let typhoonsData: any[] | null = null;
    let warningsUpdated = false;
    let earthquakesUpdated = false;
    let typhoonsUpdated = false;
    
    try {
      while (syncQueue.length > 0 && processed < MAX_SUBREQUESTS) {
        // CPU莠育ｮ励メ繧ｧ繝・け (XML譁・ｭ怜・髟ｷ縺ｮ蜷郁ｨ医〒蛻､螳・
        // 縺吶〒縺ｫ荳企剞繧定ｶ・∴縺ｦ縺・◆繧画ｬ｡縺ｮ繝ｪ繧ｯ繧ｨ繧ｹ繝医↓蝗槭☆
        if (totalXmlLength > MAX_XML_LENGTH_PER_BATCH && processed > 0) {
          console.log(`[Adaptive] XML length budget reached: ${totalXmlLength} bytes used, stopping after ${processed} items`);
          break;
        }
        
        const item = syncQueue[0]; // peek (縺ｾ縺豸医＆縺ｪ縺・
        const { id, link, updated, telegramCode } = item;
        
        try {
          // XML蜿門ｾ・(I/O: CPU譎る俣縺ｫ蜷ｫ縺ｾ繧後↑縺・
          const xmlRes = await fetch(link, { headers: { 'User-Agent': 'Jma-Dashboard/1.0' } });
          if (!xmlRes.ok) {
            syncQueue.shift(); processed++;
            continue;
          }
          const xmlText = await xmlRes.text();
          
          // 繧ｵ繧､繧ｺ縺悟､ｧ縺阪☆縺弱ｋ繝輔ぃ繧､繝ｫ(Poison Pill)縺ｯ繝代・繧ｹ縺吶ｋ縺ｨ蜊ｳ蠎ｧ縺ｫ10ms蛻ｶ髯舌ｒ雜・∴縺ｦ繧ｯ繝ｩ繝・す繝･縺吶ｋ縺溘ａ繧ｹ繧ｭ繝・・縲・          // 500KB莉･荳翫・蜊倅ｸ繝輔ぃ繧､繝ｫ縺ｯ辟｡譁呎棧縺ｧ縺ｯ螳牙・縺ｫ繝代・繧ｹ縺ｧ縺阪↑縺・庄閭ｽ諤ｧ縺碁ｫ倥＞
          if (xmlText.length > 600000) {
            console.warn(`[Adaptive] Skipping extremely large file (size: ${xmlText.length} bytes): ${link}`);
            syncQueue.shift(); processed++; continue;
          }
          
          // XML髟ｷ繧貞刈邂・          totalXmlLength += xmlText.length;
          
          // XML繝代・繧ｹ (CPU髮・ｴ・
          const xmlData = parser.parse(xmlText);
          
          const report = xmlData.Report;
          if (!report) { syncQueue.shift(); processed++; continue; }
          
          const status = report.Control?.Status;
          if (status !== '騾壼ｸｸ') { syncQueue.shift(); processed++; continue; }
          
          const infoType = report.Head?.InfoType;
          const reportDateTime = report.Head?.ReportDateTime;
          
          // 繝・・繧ｿ繧ｹ繝医い縺ｮ驕・ｻｶ繝ｭ繝ｼ繝会ｼ亥・蝗槭・縺ｿKV縺九ｉGET・・          if (telegramCode === 'VPWW') {
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
        
        syncQueue.shift(); // 豁｣蟶ｸ螳御ｺ・竊・繧ｭ繝･繝ｼ縺九ｉ髯､蜴ｻ
        processed++;
      }
      
      // 螟画峩縺後≠縺｣縺溘ョ繝ｼ繧ｿ繧ｹ繝医い縺縺善UT
      if (warningsUpdated && warningsData) {
        // KV縺ｮ閧･螟ｧ蛹悶ｒ髦ｲ縺舌◆繧√∬ｫ也炊蜑企勁(isCancelled)縺輔ｌ縺ｦ縺九ｉ48譎る俣邨碁℃縺励◆蜿､縺・ョ繝ｼ繧ｿ縺ｯ迚ｩ逅・炎髯､縺吶ｋ
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
    // 1. 繝輔ぅ繝ｼ繝峨ｒ繝√ぉ繝・け縺励※譁ｰ逹縺後≠繧後・繧ｭ繝･繝ｼ縺ｫ霑ｽ蜉
    await this.updateJmaData(env);
    
    // 2. 繧ｭ繝･繝ｼ縺ｫ谿九ｊ縺後≠繧後・驕ｩ蠢懃噪縺ｫ繝舌ャ繝∝・逅・ｼ医Θ繝ｼ繧ｶ繝ｼ繧｢繧ｯ繧ｻ繧ｹ荳崎ｦ・ｼ・    const state: any = await env.WEATHER_DATA_STORE.get('sync_state', { type: 'json' }) || { items: [], total: 0 };
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
    const MAX_SUBREQUESTS = 99999; // Render.com 辟｡蛻ｶ髯・    let globalMaxEntryTime = 0;
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
            
            // 繝ｦ繝ｼ繧ｶ繝ｼ謖・ｮ夐壹ｊ縲∬ｭｦ蝣ｱ繝ｻ蝨ｰ髴・・蜿ｰ鬚ｨ繧貞・縺ｦ蜿門ｾ励☆繧・            // 蛻晄悄蜷梧悄縺ｧ縺ｮAPI繧ｳ繝ｼ繝ｫ荳企剞雜・℃繧帝亟縺舌◆繧√∬ｭｦ蝣ｱ縺ｯ逶ｴ霑・0莉ｶ縺ｫ蛻ｶ髯・            candidateEntries = [
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
          
          // <updated>繧ｿ繧､繝繧ｹ繧ｿ繝ｳ繝励↓繧医ｋ蟾ｮ蛻・愛螳・(l-telop繧ｹ繧ｭ繝ｫ貅匁侠)
          const entryTime = new Date(entry.updated).getTime();
          if (entryTime > globalMaxEntryTime) globalMaxEntryTime = entryTime;
          if (!isInitialSync && entryTime <= lastUpdated) continue;

          newEntries.push(entry);
        }

        
        const messagesToSend = [];
        // 繝ｪ繧｢繝ｫ繧ｿ繧､繝諤ｧ驥崎ｦ悶・縺溘ａ縲、TOM繝輔ぅ繝ｼ繝峨・荳ｦ縺ｳ鬆・ｼ域眠縺励＞鬆・ｼ峨・縺ｾ縺ｾ蜃ｦ逅・☆繧・        for (const entry of newEntries) {
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
              // 譁ｰ縺励＞繝・・繧ｿ繧貞━蜈医＠縺ｦ蜃ｦ逅・☆繧九◆繧√√く繝･繝ｼ縺ｮ蜈磯ｭ縺ｫ霑ｽ蜉(LIFO)
              // 驥崎､・ｒ謗帝勁縺励※縺九ｉ霑ｽ蜉縺吶ｋ
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
      // 螻･豁ｴ縺ｯ譛譁ｰ縺ｮ1000莉ｶ縺ｮ縺ｿ菫晄戟縺吶ｋ
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
    if (infoType === '蜿匁ｶ・) return;

    const warnings = Array.isArray(report.Body?.Warning) ? report.Body.Warning : (report.Body?.Warning ? [report.Body.Warning] : []);
    if (warnings.length === 0) return;

    let prefecture = '';
    const idMatch = xmlId.match(/_(?:VPWW|VXWW|VXXX)[0-9]{2}_(\d{6})\.xml/);
    if (idMatch) {
      prefecture = OFFICE_CODE_TO_PREF[idMatch[1]] || '';
    }
    
    // 蜿門ｾ励〒縺阪↑縺九▲縺溷ｴ蜷医√∪縺溘・縲悟圏豬ｷ驕薙阪→螟ｧ縺ｾ縺九↓蛻､螳壹＆繧後◆蝣ｴ蜷医・Title縺九ｉ隧ｳ邏ｰ縺ｪ蝨ｰ蝓溷錐繧貞叙蠕・    if (!prefecture || prefecture === '蛹玲ｵｷ驕・) {
      const title = report.Head?.Title || '';
      const titleWithoutParen = title.replace(/・・^・云+・・, '');
      const prefMatch = titleWithoutParen.match(/^(.+蝨ｰ譁ｹ|.+逵芸.+蠎忿蛹玲ｵｷ驕倒譚ｱ莠ｬ驛ｽ)/);
      if (prefMatch) {
        prefecture = prefMatch[1];
      }

      if (prefecture.includes('豐也ｸ・) || prefecture.includes('螟ｧ譚ｱ蟲ｶ') || prefecture.includes('螳ｮ蜿､蟲ｶ') || prefecture.includes('蜈ｫ驥榊ｱｱ')) {
        prefecture = '豐也ｸ・恁';
      } else if (prefecture.includes('螂・ｾ・) || prefecture.includes('鮖ｿ蜈仙ｳｶ')) {
        prefecture = '鮖ｿ蜈仙ｳｶ逵・;
      } else if (prefecture === '譚ｱ莠ｬ蝨ｰ譁ｹ') {
        prefecture = '譚ｱ莠ｬ驛ｽ';
      }
    }

    for (const warning of warnings) {
      if (!warning) continue;
      
      const wType = warning['@_type'] || '';
      let areaType = 'unknown';
      if (wType.includes('蠎懃恁莠亥ｱ蛹ｺ')) areaType = 'prefecture';
      else if (wType.includes('邏ｰ蛻・玄蝓・)) areaType = 'region';
      else if (wType.includes('縺ｾ縺ｨ繧√◆蝨ｰ蝓・)) areaType = 'subregion';
      else if (wType.includes('蟶ら伴譚醍ｭ・)) areaType = 'municipality';

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
            
            // 譌｢蟄倥・繝ｬ繝吶Ν陦ｨ險倥ｒ荳譌ｦ蜑企勁縺励※豁｣隕丞喧
            wName = wName.replace(/^繝ｬ繝吶Ν[・・・・-5]\s*/, '');
            
            // 繝ｬ繝吶Ν5
            if (wName.includes('迚ｹ蛻･隴ｦ蝣ｱ') || wName.includes('豌ｾ豼ｫ逋ｺ逕・)) {
              level = 'special';
            } 
            // 繝ｬ繝吶Ν4
            else if (wName.includes('蝨溽ら⊃螳ｳ隴ｦ謌呈ュ蝣ｱ') || (wName.includes('鬮俶ｽｮ') && wName.includes('隴ｦ蝣ｱ')) || wName.includes('豌ｾ豼ｫ蜊ｱ髯ｺ')) {
              level = 'warning_l4';
            }
            // 繝ｬ繝吶Ν3
            else if (wName.includes('隴ｦ蝣ｱ') || wName.includes('豌ｾ豼ｫ隴ｦ謌・)) {
              level = 'warning';
            }
            // 繝ｬ繝吶Ν2
            else {
              level = 'advisory';
            }

            // 螟ｧ髮ｨ縲∵ｴｪ豌ｴ・域ｰｾ豼ｫ・峨・ｫ俶ｽｮ縲∝悄遐ら⊃螳ｳ縺ｮ縺ｿ繝ｬ繝吶Ν繧剃ｻ倅ｸ弱☆繧・            if (wName.includes('螟ｧ髮ｨ') || wName.includes('豢ｪ豌ｴ') || wName.includes('豌ｾ豼ｫ') || wName.includes('鬮俶ｽｮ') || wName.includes('蝨溽ら⊃螳ｳ')) {
              if (level === 'special') {
                wName = `繝ｬ繝吶Ν5 ${wName}`;
                level = 'level_5';
              } else if (level === 'warning_l4') {
                wName = `繝ｬ繝吶Ν4 ${wName}`;
                level = 'level_4';
              } else if (level === 'warning') {
                wName = `繝ｬ繝吶Ν3 ${wName}`;
                level = 'level_3';
              } else {
                wName = `繝ｬ繝吶Ν2 ${wName}`;
                level = 'level_2';
              }
            } else {
              // 縺昴ｌ莉･螟厄ｼ亥ｼｷ鬚ｨ縲∵ｳ｢豬ｪ縺ｪ縺ｩ・峨・繝ｬ繝吶Ν譁・ｭ怜・繧剃ｻ倥￠縺壹∝・縺ｮlevel縺ｮ縺ｾ縺ｾ
              if (level === 'special') level = 'special';
              else if (level === 'warning_l4' || level === 'warning') level = 'warning';
              else level = 'advisory';
            }

            // 1. 縲瑚ｧ｣髯､縲阪・蝣ｴ蜷茨ｼ夐・蛻励°繧臥峩謗･蜑企勁縺帙★縲（sCancelled繝輔Λ繧ｰ繧堤ｫ九※縺ｦ隲也炊蜑企勁縺ｨ縺吶ｋ
            // 縺薙ｌ縺ｫ繧医ｊ縲梧眠縺励＞隗｣髯､縲阪′蜈医↓蜃ｦ逅・＆繧後∝ｾ後°繧峨悟商縺・匱陦ｨ縲阪′譚･縺ｦ繧よ凾邉ｻ蛻玲ｯ碑ｼ・〒蠑ｾ縺代ｋ
            if (kindName.includes('隗｣髯､') || kindName === '縺ｪ縺・ || kind.Status === '隗｣髯､') {
              let found = false;
              for (let i = warningsData.length - 1; i >= 0; i--) {
                if (warningsData[i].region === region && warningsData[i].areaType === areaType && warningsData[i].warningName === wName) {
                  found = true;
                  const existingDate = new Date(warningsData[i].reportDateTime).getTime();
                  const newDate = new Date(reportDateTime).getTime();
                  // 譌｢蟄倥・繝・・繧ｿ繧医ｊ譁ｰ縺励＞隗｣髯､諠・ｱ縺ｮ蝣ｴ蜷医・縺ｿ譖ｴ譁ｰ
                  if (newDate >= existingDate) {
                    warningsData[i].isCancelled = true;
                    warningsData[i].reportDateTime = reportDateTime;
                  }
                }
              }
              // 縺ｾ縺DB縺ｫ縺ｪ縺・′縲∵悴譚･縺ｮ隗｣髯､諠・ｱ縺悟・縺ｫ譚･縺溷ｴ蜷医・繝繝溘・縺ｨ縺励※逋ｻ骭ｲ縺励※縺翫￥
              if (!found) {
                warningsData.push({
                  xmlId, region, reportDateTime, infoType, warningName: wName, level, areaType, prefecture, status, isCancelled: true
                });
              }
              continue;
            }

          // 2. 縲檎匱陦ｨ縲阪∪縺溘・縺昴ｌ莉･螟悶・蝣ｴ蜷茨ｼ咼B(驟榊・)縺ｫ霑ｽ蜉
          // 蜷後§隴ｦ蝣ｱ縺梧里縺ｫ縺ゅｋ蝣ｴ蜷医・驥崎､・ｒ髦ｲ縺舌◆繧∝炎髯､縺励※縺九ｉ霑ｽ蜉縺吶ｋ
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
               continue; // 譁ｰ縺励＞繝・・繧ｿ・医∪縺溘・隗｣髯､・峨′縺吶〒縺ｫ縺ゅｋ縺ｪ繧峨∝商縺・ョ繝ｼ繧ｿ縺ｧ縺ｮ荳頑嶌縺阪ｒ髦ｲ縺・            }
            
            // 譌｢蟄倥ョ繝ｼ繧ｿ繧呈峩譁ｰ (隗｣髯､繝輔Λ繧ｰ繧定誠縺ｨ縺・
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
        
        // 逶ｴ霑・00莉ｶ縺ｫ蛻ｶ髯・        if (earthquakesData.length > 200) {
          earthquakesData.shift(); // 蜿､縺・ｂ縺ｮ繧貞炎髯､
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
      
      const isCurrent = forecastType === '螳滓ｳ・ || forecastType.includes('謗ｨ螳・);

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
            if (forecastType === '螳滓ｳ・) {
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
            let precision = 0; // 0: none, 1: 蠎ｦ, 2: 蠎ｦ蛻・
            for (const c of coords) {
              const ct = typeof c === 'object' ? (c['@_type'] || '') : '';
              const cv = typeof c === 'object' ? (c['#text'] || '') : String(c);
              
              if (ct.includes('蠎ｦ蛻・) && precision < 2) {
                const m = String(cv).match(/([+-]\d+)(\d{2})([+-]\d+)(\d{2})/);
                if (m) {
                  const isLatNeg = m[1].startsWith('-');
                  const isLonNeg = m[3].startsWith('-');
                  parsedLat = (Math.abs(parseInt(m[1], 10)) + parseInt(m[2], 10) / 60) * (isLatNeg ? -1 : 1);
                  parsedLon = (Math.abs(parseInt(m[3], 10)) + parseInt(m[4], 10) / 60) * (isLonNeg ? -1 : 1);
                  precision = 2;
                }
              } else if (ct.includes('蠎ｦ・・) && precision < 1) {
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
            // 莠亥ｱ蜀・            if (cp.ProbabilityCircle) {
              const pc = cp.ProbabilityCircle;
              const bps = pc.BasePoint ? (Array.isArray(pc.BasePoint) ? pc.BasePoint : [pc.BasePoint]) : [];
              for (const bp of bps) {
                const bpType = bp['@_type'] || '';
                if (bpType.includes('蠎ｦ・・) && !bpType.includes('蠎ｦ蛻・)) {
                  const m = String(bp['#text'] || '').match(/([+-]\d+\.?\d*)([+-]\d+\.?\d*)/);
                  if (m) { fLat = parseFloat(m[1]); fLon = parseFloat(m[2]); }
                }
              }
              if (pc.Axes?.Axis) {
                const axes = Array.isArray(pc.Axes.Axis) ? pc.Axes.Axis : [pc.Axes.Axis];
                for (const ax of axes) {
                  const radii = ax.Radius ? (Array.isArray(ax.Radius) ? ax.Radius : [ax.Radius]) : [];
                  for (const r of radii) {
                    if (r['@_unit'] === 'km' && String(r['@_type']).includes('遒ｺ邇・濠蠕・)) {
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
                  if (wType.includes('譛螟ｧ鬚ｨ騾・)) {
                    if (isCurrent) maxWind = w['#text'] || 0;
                    fMaxWind = w['#text'] || 0;
                  }
                  if (wType.includes('譛螟ｧ迸ｬ髢馴｢ｨ騾・)) {
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
                          if (ct.includes('蠎ｦ蛻・) && precision < 2) {
                            const m = String(cv).match(/([+-]\d+)(\d{2})([+-]\d+)(\d{2})/);
                            if (m) {
                              const isLatNeg = m[1].startsWith('-');
                              const isLonNeg = m[3].startsWith('-');
                              bpLat = (Math.abs(parseInt(m[1], 10)) + parseInt(m[2], 10) / 60) * (isLatNeg ? -1 : 1);
                              bpLon = (Math.abs(parseInt(m[3], 10)) + parseInt(m[4], 10) / 60) * (isLonNeg ? -1 : 1);
                              precision = 2;
                            }
                          } else if (ct.includes('蠎ｦ・・) && precision < 1) {
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
                        if (wapType.includes('證ｴ鬚ｨ')) {
                          if (isCurrent) { stormRadii = radiiData; stormCenterLat = bpLat; stormCenterLon = bpLon; }
                          else { fStormRadii = radiiData; fStormCenterLat = bpLat; fStormCenterLon = bpLon; }
                        } else if (wapType.includes('蠑ｷ鬚ｨ')) {
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
        
        // 證ｴ鬚ｨ蝓溘・蠑ｷ鬚ｨ蝓溘・謚ｽ蜃ｺ・・rea縺九ｉ・・        if (item.Area) {
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
                      // 證ｴ鬚ｨ蝓溘・遞ｮ蛻･繧貞錐蜑阪°繧牙愛螳・                      const areaName = area.Name || '';
                      if (areaName.includes('證ｴ鬚ｨ') && !areaName.includes('隴ｦ謌・)) {
                        stormRadii = radiiData;
                      } else {
                        galeRadii = radiiData;
                      }
                    } else {
                      const areaName = area.Name || '';
                      if (areaName.includes('證ｴ鬚ｨ') && !areaName.includes('隴ｦ謌・)) {
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
        
        // 莠亥ｱ諠・ｱ繧剃ｿ晏ｭ・        if (forecastType && !isCurrent && (fLat || fLon)) {
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
      if (!name) name = '辭ｱ蟶ｯ菴取ｰ怜悸';
      
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
                      if (w.status === '逋ｺ陦ｨ' || w.status === '邯咏ｶ・) {
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
                                  infoType: '逋ｺ陦ｨ',
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
    
    // 隴ｦ蝣ｱ縺ｯmap.json縺九ｉ螳悟・讒狗ｯ峨☆繧九◆繧∽ｸ譌ｦ螳溯｡後☆繧・    await this.syncMapJsonState(env);
    
    await env.WEATHER_DATA_STORE.put('earthquakes', JSON.stringify(earthquakesData));
    await env.WEATHER_DATA_STORE.put('typhoons', JSON.stringify([]));
    await env.WEATHER_DATA_STORE.put('processed_feeds', JSON.stringify([]));
    await env.WEATHER_DATA_STORE.put('sync_state', JSON.stringify({ items: [], total: 0 }));
    await env.WEATHER_DATA_STORE.put('status', JSON.stringify({ lastUpdated: new Date().toISOString() }));

    // XML繝輔ぅ繝ｼ繝峨°繧牙慍髴・→蜿ｰ鬚ｨ縺ｮ譛譁ｰ迥ｶ諷九ｒ讒狗ｯ・(isInitialSync = true)
    await this.updateJmaData(env, true);

  }
};
