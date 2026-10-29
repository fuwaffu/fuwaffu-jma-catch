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

const CACHE_TTL_SECONDS = 60;
const TYPHOON_EXPIRE_DAYS = 3;

const asArray = <T = any>(v: T | T[] | undefined | null): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

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

// ponytail: Unified typhoon coordinate parser (supports both 度分 and 度)
function parseTyphoonCoords(coordsInput: any): { lat: number; lon: number } | null {
  let parsedLat: number | null = null;
  let parsedLon: number | null = null;
  let precision = 0;
  for (const c of asArray(coordsInput)) {
    const ct = typeof c === 'object' ? (c['@_type'] || '') : '';
    const cv = typeof c === 'object' ? (c['#text'] || '') : String(c);
    if (ct.includes('度分') && precision < 2) {
      const m = String(cv).match(/([+-]\d+)(\d{2})([+-]\d+)(\d{2})/);
      if (m) {
        parsedLat = (Math.abs(parseInt(m[1], 10)) + parseInt(m[2], 10) / 60) * (m[1].startsWith('-') ? -1 : 1);
        parsedLon = (Math.abs(parseInt(m[3], 10)) + parseInt(m[4], 10) / 60) * (m[3].startsWith('-') ? -1 : 1);
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
  return parsedLat !== null && parsedLon !== null ? { lat: parsedLat, lon: parsedLon } : null;
}

// ponytail: Unified circle axis radii extractor
function extractCircleRadii(circle: any): { direction: string; radiusKm: number }[] {
  const radiiData: { direction: string; radiusKm: number }[] = [];
  for (const ax of asArray(circle?.Axes?.Axis)) {
    const dir = ax?.Direction ? (typeof ax.Direction === 'object' ? ax.Direction['#text'] : ax.Direction) : '';
    for (const r of asArray(ax?.Radius)) {
      if (r?.['@_unit'] === 'km') {
        radiiData.push({ direction: dir, radiusKm: parseFloat(r['#text']) || 0 });
      }
    }
  }
  return radiiData;
}

function classifyTelegramCode(link: string): string {
  if (link.match(/_(VPWW(5[3-9]|6[0-1])|VXWW[4-5][0-9]|VXXX50)_/)) return 'VPWW';
  if (link.includes('_VXSE51_') || link.includes('_VXSE52_') || link.includes('_VXSE53_')) return 'VXSE';
  if (link.includes('_VPTW6') || link.includes('_VPTI5')) return 'VPTW';
  return '';
}

async function cachedKvQuery(
  cacheKey: string,
  env: Env,
  corsHeaders: Record<string, string>,
  transform?: (data: any) => any
): Promise<Response> {
  const cache = caches.default;
  const cacheRequest = new Request(`https://cache-internal/${cacheKey}`);

  const cached = await cache.match(cacheRequest);
  if (cached) {
    const newHeaders = new Headers(cached.headers);
    for (const [k, v] of Object.entries(corsHeaders)) newHeaders.set(k, v);
    return new Response(cached.body, { status: cached.status, headers: newHeaders });
  }

  let data = await env.WEATHER_DATA_STORE.get(cacheKey, { type: 'json' });
  if (data === null) data = cacheKey === 'status' ? { lastUpdated: null } : [];
  if (transform) data = transform(data);

  const response = new Response(JSON.stringify(data), {
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
  await Promise.all(
    ['warnings', 'earthquakes', 'typhoons', 'status'].map(key =>
      cache.delete(new Request(`https://cache-internal/${key}`))
    )
  );
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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

        let targetJsonFilename = id.endsWith('.json')
          ? (id.split('/').pop()?.replace(/[^a-zA-Z0-9_.]/g, '') || '')
          : '';

        if (!targetJsonFilename) {
          try {
            const listRes = await fetch('https://www.jma.go.jp/bosai/quake/data/list.json', {
              headers: { 'User-Agent': 'Jma-Dashboard/1.0' }
            });
            if (listRes.ok) {
              const list = await listRes.json() as any[];
              const matchingEntries = list.filter((e: any) => {
                if (eid && (e.eid === eid || e.json?.includes(eid))) return true;
                if (time && e.at && Math.abs(new Date(e.at).getTime() - new Date(time).getTime()) < 120000) {
                  return anm && e.anm ? (e.anm.includes(anm) || anm.includes(e.anm)) : true;
                }
                const m = id.match(/(\d{14})/);
                return !!(m && e.json?.includes(m[1]));
              });

              const intensityReport =
                matchingEntries.find((e: any) => e.ttl?.includes('震源・震度') || e.json?.includes('VXSE5k') || e.json?.includes('VXSE53')) ||
                matchingEntries.find((e: any) => e.ttl?.includes('震度') || e.json?.includes('VXSE51')) ||
                matchingEntries[0];

              if (intensityReport?.json) targetJsonFilename = intensityReport.json;
            }
          } catch (e) {
            console.error('Error querying JMA list.json:', e);
          }
        }

        if (targetJsonFilename) {
          const jmaRes = await fetch(`https://www.jma.go.jp/bosai/quake/data/${targetJsonFilename}`, {
            headers: { 'User-Agent': 'Jma-Dashboard/1.0' }
          });
          if (jmaRes.ok) {
            return new Response(await jmaRes.text(), {
              headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" }
            });
          }
        }

        if (id.startsWith('http')) {
          const xmlRes = await fetch(id, { headers: { 'User-Agent': 'Jma-Dashboard/1.0' } });
          if (xmlRes.ok) {
            return new Response(await xmlRes.text(), {
              headers: { ...corsHeaders, "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" }
            });
          }
        }

        return new Response(JSON.stringify({ error: "Earthquake detail not found" }), { status: 404, headers: corsHeaders });
      }
      if (url.pathname === "/api/typhoons") return await cachedKvQuery('typhoons', env, corsHeaders, (d) => pruneExpiredTyphoons(d));
      if (url.pathname === "/api/status") {
        let status: any = { lastUpdated: null, isSyncing: false, progress: 100 };
        try {
          const raw = await env.WEATHER_DATA_STORE.get('status');
          if (raw) status = { ...status, ...JSON.parse(raw), isSyncing: false, progress: 100 };
        } catch (e) {
          console.error('Status error:', e);
        }
        return new Response(JSON.stringify(status), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/trigger-update") {
        await this.updateJmaData(env);
        await invalidateApiCaches();
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ponytail: Legacy sync-step endpoint kept as a 1-line no-op for backward compatibility
      if (url.pathname === "/api/sync-step") {
        return new Response(JSON.stringify({ ok: true, isSyncing: false, progress: 100 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/sync-initial") {
        await this.syncInitialJmaData(env);
        await invalidateApiCaches();
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/clear-cache") {
        await Promise.all([
          'processed_feeds', 'typhoons', 'warnings', 'earthquakes', 'sync_target', 'sync_current', 'sync_queue'
        ].map(k => env.WEATHER_DATA_STORE.delete(k)));
        await invalidateApiCaches();
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },

  // ponytail: Unified parallel XML processor used by both updateJmaData and queue
  async processXmlBatch(messages: { id: string; link: string; updated: string; telegramCode: string }[], env: Env) {
    if (messages.length === 0) return;

    const [rawWarnings, rawEarthquakes, rawTyphoons] = await Promise.all([
      env.WEATHER_DATA_STORE.get('warnings', { type: 'json' }),
      env.WEATHER_DATA_STORE.get('earthquakes', { type: 'json' }),
      env.WEATHER_DATA_STORE.get('typhoons', { type: 'json' }),
    ]);
    const warningsData: any[] = (rawWarnings as any[]) || [];
    const earthquakesData: any[] = (rawEarthquakes as any[]) || [];
    let typhoonsData: any[] = (rawTyphoons as any[]) || [];

    let warningsUpdated = false;
    let earthquakesUpdated = false;
    let typhoonsUpdated = false;

    const CONCURRENCY = 30;
    const fetchedItems: ({ id: string; updated: string; telegramCode: string; xmlData: any } | null)[] = [];
    for (let i = 0; i < messages.length; i += CONCURRENCY) {
      const chunkResults = await Promise.all(
        messages.slice(i, i + CONCURRENCY).map(async (msg) => {
          try {
            const xmlRes = await fetch(msg.link, { headers: { 'User-Agent': 'Jma-Dashboard/1.0' } });
            if (!xmlRes.ok) return null;
            return { id: msg.id, updated: msg.updated, telegramCode: msg.telegramCode, xmlData: parser.parse(await xmlRes.text()) };
          } catch (e) {
            console.error(`Failed to fetch XML ${msg.link}`, e);
            return null;
          }
        })
      );
      fetchedItems.push(...chunkResults);
    }

    for (const item of fetchedItems) {
      if (!item) continue;
      const report = item.xmlData?.Report;
      if (!report || report.Control?.Status !== '通常') continue;

      const infoType = report.Head?.InfoType;
      const reportDateTime = report.Head?.ReportDateTime;

      if (item.telegramCode === 'VPWW') {
        this.processWarningToMemory(report, item.id, reportDateTime, infoType, '通常', warningsData);
        warningsUpdated = true;
      } else if (item.telegramCode === 'VXSE') {
        this.processEarthquakeToMemory(report, item.id, infoType, earthquakesData);
        earthquakesUpdated = true;
      } else if (item.telegramCode === 'VPTW') {
        this.processTyphoonToMemory(report, item.id, item.updated, typhoonsData);
        typhoonsUpdated = true;
      }
    }

    const kvWrites: Promise<any>[] = [];
    if (warningsUpdated) kvWrites.push(env.WEATHER_DATA_STORE.put('warnings', JSON.stringify(warningsData)));
    if (earthquakesUpdated) kvWrites.push(env.WEATHER_DATA_STORE.put('earthquakes', JSON.stringify(earthquakesData)));
    if (typhoonsUpdated) {
      typhoonsData = pruneExpiredTyphoons(typhoonsData);
      await this.backfillTyphoonTracks(typhoonsData);
      kvWrites.push(env.WEATHER_DATA_STORE.put('typhoons', JSON.stringify(typhoonsData)));
    }

    if (warningsUpdated || earthquakesUpdated || typhoonsUpdated) {
      kvWrites.push(env.WEATHER_DATA_STORE.put('status', JSON.stringify({ lastUpdated: new Date().toISOString() })));
      await Promise.all(kvWrites);
      await invalidateApiCaches();
    }
  },

  async queue(batch: any, env: Env, _ctx: ExecutionContext) {
    await this.processXmlBatch(batch.messages.map((m: any) => m.body), env);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(this.updateJmaData(env));
  },

  async updateJmaData(env: Env, isInitialSync = false) {
    const feedUrls = [
      'https://www.data.jma.go.jp/developer/xml/feed/regular.xml',
      'https://www.data.jma.go.jp/developer/xml/feed/extra.xml',
      'https://www.data.jma.go.jp/developer/xml/feed/extra_l.xml',
      'https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml'
    ];

    const processedFeeds: string[] = isInitialSync
      ? []
      : ((await env.WEATHER_DATA_STORE.get('processed_feeds', { type: 'json' })) || []);
    const processedFeedsSet = new Set(processedFeeds);
    const initialProcessedCount = processedFeedsSet.size;

    const feedTexts = await Promise.all(
      feedUrls.map(async (feedUrl) => {
        try {
          const res = await fetch(feedUrl, { headers: { "User-Agent": "Jma-Dashboard/1.0" } });
          return res.ok ? await res.text() : '';
        } catch {
          return '';
        }
      })
    );

    const candidateMap = new Map<string, { id: string; updated: string; link: string; telegramCode: string }>();
    for (const text of feedTexts) {
      if (!text) continue;
      for (const block of text.split('<entry>').slice(1)) {
        const id = block.match(/<id>(.*?)<\/id>/)?.[1];
        const updated = block.match(/<updated>(.*?)<\/updated>/)?.[1];
        const link = block.match(/<link[^>]*?href="(.*?)"/)?.[1];
        if (!id || !updated || !link || processedFeedsSet.has(id) || candidateMap.has(id)) continue;

        const telegramCode = classifyTelegramCode(link);
        if (telegramCode) candidateMap.set(id, { id, updated, link, telegramCode });
      }
    }

    let candidateEntries = Array.from(candidateMap.values()).sort(
      (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
    );

    if (isInitialSync) {
      candidateEntries = [
        ...candidateEntries.filter(e => e.telegramCode === 'VPTW').slice(0, 10),
        ...candidateEntries.filter(e => e.telegramCode === 'VXSE').slice(0, 30),
        ...candidateEntries.filter(e => e.telegramCode === 'VPWW').slice(0, 100),
      ];
    }

    // 古い順（時系列順）に処理することで、最新の電文が確実に過去の電文を上書きする
    const messagesToProcess = candidateEntries.sort(
      (a, b) => new Date(a.updated).getTime() - new Date(b.updated).getTime()
    );

    for (const msg of messagesToProcess) processedFeedsSet.add(msg.id);

    await this.processXmlBatch(messagesToProcess, env);

    if (processedFeedsSet.size > initialProcessedCount || isInitialSync) {
      await env.WEATHER_DATA_STORE.put('processed_feeds', JSON.stringify(Array.from(processedFeedsSet).slice(-1000)));
    }
  },

  processWarningToMemory(report: any, xmlId: string, reportDateTime: string, infoType: string, status: string, warningsData: any[]) {
    if (infoType === '取消') return;

    const warnings = asArray(report.Body?.Warning);
    if (warnings.length === 0) return;

    const idMatch = xmlId.match(/_(?:VPWW|VXWW|VXXX)[0-9]{2}_(\d{6})\.xml/);
    let prefecture = idMatch ? (OFFICE_CODE_TO_PREF[idMatch[1]] || '') : '';

    if (!prefecture || prefecture === '北海道') {
      const titleWithoutParen = (report.Head?.Title || '').replace(/（[^）]+）/, '');
      const prefMatch = titleWithoutParen.match(/^(.+地方|.+県|.+府|北海道|東京都)/);
      if (prefMatch) prefecture = prefMatch[1];

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
      const areaType = wType.includes('府県予報区') ? 'prefecture'
        : wType.includes('細分区域') ? 'region'
        : wType.includes('まとめた地域') ? 'subregion'
        : wType.includes('市町村等') ? 'municipality' : 'unknown';

      for (const item of asArray(warning.Item)) {
        if (!item) continue;
        const areas = asArray(item.Area ?? item.Areas?.Area);
        for (const area of areas) {
          if (!area) continue;
          const region = area.Name;

          for (let i = warningsData.length - 1; i >= 0; i--) {
            if (warningsData[i].region === region && warningsData[i].areaType === areaType) {
              warningsData.splice(i, 1);
            }
          }

          for (const kind of asArray(item.Kind)) {
            const kindName = kind?.Name;
            if (!kindName || kindName.includes('解除') || kindName === 'なし' || kind.Status === '解除') continue;

            let wName = kindName.replace(/^レベル[１-５1-5]\s*/, '');
            let level = wName.includes('特別警報') || wName.includes('氾濫発生') ? 'special'
              : wName.includes('土砂災害警戒情報') || (wName.includes('高潮') && wName.includes('警報')) || wName.includes('氾濫危険') ? 'warning_l4'
              : wName.includes('警報') || wName.includes('氾濫警戒') ? 'warning' : 'advisory';

            if (wName.includes('大雨') || wName.includes('洪水') || wName.includes('氾濫') || wName.includes('高潮') || wName.includes('土砂災害')) {
              const lvNum = level === 'special' ? 5 : level === 'warning_l4' ? 4 : level === 'warning' ? 3 : 2;
              wName = `レベル${lvNum} ${wName}`;
              level = `level_${lvNum}`;
            } else if (level === 'warning_l4') {
              level = 'warning';
            }

            warningsData.push({
              xmlId, reportDateTime, region, prefecture, areaType,
              warningCode: kind.Code || '', warningName: wName, warningLevel: level, infoType, status
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

    const earthquakes = asArray(report.Body?.Earthquake);
    const maxInt = report.Body?.Intensity?.Observation?.MaxInt;

    if (earthquakes.length > 0) {
      for (const earthquake of earthquakes) {
        if (!earthquake) continue;
        const originTime = earthquake.OriginTime || report.Head?.TargetDateTime || report.Head?.ReportDateTime || '';
        const hypocenter = earthquake.Hypocenter?.Area?.Name || '';
        let magnitude = earthquake.Magnitude?.['#text'] || earthquake.Magnitude;
        if (typeof magnitude !== 'string' && typeof magnitude !== 'number') magnitude = '';

        const coord = parseQuakeCoordinate(earthquake.Hypocenter?.Area?.Coordinate);
        if (!originTime && !hypocenter && !eventId) continue;

        let existingIdx = eventId ? earthquakesData.findIndex(eq => eq.eventId === eventId) : -1;
        if (existingIdx === -1 && originTime) {
          existingIdx = earthquakesData.findIndex(eq => eq.originTime === originTime && (hypocenter ? eq.hypocenterName === hypocenter : true));
        }

        if (existingIdx !== -1) {
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
          if (earthquakesData.length > 200) earthquakesData.shift();
        }
      }
    } else if (maxInt) {
      const originTime = report.Head?.TargetDateTime || report.Head?.ReportDateTime || '';
      const existingIdx = eventId ? earthquakesData.findIndex(eq => eq.eventId === eventId) : -1;
      if (existingIdx !== -1) {
        earthquakesData[existingIdx].maxIntensity = maxInt;
        earthquakesData[existingIdx].xmlId = xmlId;
        earthquakesData[existingIdx].updatedAt = new Date().toISOString();
      } else {
        earthquakesData.push({
          xmlId, eventId, originTime,
          hypocenterName: '震源調査中', magnitude: '', maxIntensity: maxInt,
          depth: 0, lat: null, lon: null, updatedAt: new Date().toISOString()
        });
        if (earthquakesData.length > 200) earthquakesData.shift();
      }
    }
  },

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
    const metInfos = asArray(report.Body?.MeteorologicalInfos?.MeteorologicalInfo);
    if (metInfos.length === 0) return;

    let tcNumber = '', name = '', nameEn = '', typhoonClass = '', intensityClass = '', areaClass = '';
    let centerLat = 0, centerLon = 0, location = '', direction = '', speedKmh = 0, pressure = 0, maxWind = 0, gustWind = 0;
    let stormRadii: any[] = [], galeRadii: any[] = [];
    let stormCenterLat: number | null = null, stormCenterLon: number | null = null;
    let galeCenterLat: number | null = null, galeCenterLon: number | null = null;
    let currentDateTimeStr = '';
    const forecasts: any[] = [];
    const headlineText = report.Head?.Headline?.Text || '';

    for (const info of metInfos) {
      const dateTimeObj = info.DateTime || info['@_dateTime'];
      const dateTimeStr = typeof dateTimeObj === 'object' ? (dateTimeObj['#text'] || '') : (dateTimeObj || '');
      const forecastType = typeof dateTimeObj === 'object' ? (dateTimeObj['@_type'] || '') : '';
      const isCurrent = forecastType === '実況' || forecastType.includes('推定');

      for (const item of asArray(info.Item)) {
        let fLat = 0, fLon = 0, fPressure = 0, fMaxWind = 0, fGustWind = 0;
        let fDirection = '', fSpeedKmh = 0, fClass = '', fIntensity = '', fLocation = '', fCircleRadiusKm = 0;
        let fStormRadii: any[] = [], fGaleRadii: any[] = [];

        for (const kind of asArray(item.Kind)) {
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
            const parsed = parseTyphoonCoords(cp.Coordinate);
            if (parsed) {
              if (isCurrent) {
                centerLat = parsed.lat;
                centerLon = parsed.lon;
                currentDateTimeStr = dateTimeStr;
              }
              fLat = parsed.lat;
              fLon = parsed.lon;
            }

            if (cp.Location) { if (isCurrent) location = cp.Location; fLocation = cp.Location; }
            if (cp.Direction) {
              const dText = typeof cp.Direction === 'object' ? cp.Direction['#text'] : cp.Direction;
              if (isCurrent) direction = dText || '';
              fDirection = dText || '';
            }
            for (const s of asArray(cp.Speed)) {
              if (s?.['@_unit'] === 'km/h') {
                if (isCurrent) speedKmh = s['#text'] || 0;
                fSpeedKmh = s['#text'] || 0;
              }
            }
            if (cp.Pressure) {
              if (isCurrent) pressure = cp.Pressure['#text'] || 0;
              fPressure = cp.Pressure['#text'] || 0;
            }
            if (cp.ProbabilityCircle) {
              const pc = cp.ProbabilityCircle;
              const bp = parseTyphoonCoords(pc.BasePoint);
              if (bp) { fLat = bp.lat; fLon = bp.lon; }
              for (const ax of asArray(pc.Axes?.Axis)) {
                for (const r of asArray(ax?.Radius)) {
                  if (r?.['@_unit'] === 'km' && String(r['@_type']).includes('確率半径')) {
                    fCircleRadiusKm = r['#text'] || 0;
                  }
                }
              }
            }
          }

          if (prop.WindPart) {
            for (const w of asArray(prop.WindPart.WindSpeed)) {
              if (w?.['@_unit'] === 'm/s') {
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
            for (const wap of asArray(prop.WarningAreaPart)) {
              const wapType = wap?.['@_type'] || '';
              for (const c of asArray(wap?.Circle)) {
                const radiiData = extractCircleRadii(c);
                const bp = parseTyphoonCoords(c?.BasePoint);
                if (radiiData.length > 0) {
                  if (wapType.includes('暴風')) {
                    if (isCurrent) { stormRadii = radiiData; stormCenterLat = bp?.lat ?? null; stormCenterLon = bp?.lon ?? null; }
                    else { fStormRadii = radiiData; }
                  } else if (wapType.includes('強風')) {
                    if (isCurrent) { galeRadii = radiiData; galeCenterLat = bp?.lat ?? null; galeCenterLon = bp?.lon ?? null; }
                    else { fGaleRadii = radiiData; }
                  }
                }
              }
            }
          }
        }

        for (const area of asArray(item.Area)) {
          const isStorm = (area?.Name || '').includes('暴風') && !(area?.Name || '').includes('警戒');
          for (const ac of asArray(area?.Circle)) {
            const radiiData = extractCircleRadii(ac);
            if (radiiData.length > 0) {
              if (isCurrent) {
                if (isStorm) stormRadii = radiiData; else galeRadii = radiiData;
              } else {
                if (isStorm) fStormRadii = radiiData; else fGaleRadii = radiiData;
              }
            }
          }
        }

        if (forecastType && !isCurrent && (fLat || fLon)) {
          forecasts.push({
            type: forecastType, dateTime: dateTimeStr, lat: fLat, lon: fLon,
            circleRadiusKm: fCircleRadiusKm, pressure: fPressure, maxWind: fMaxWind, gustWind: fGustWind,
            direction: fDirection, speedKmh: fSpeedKmh, typhoonClass: fClass, intensity: fIntensity,
            location: fLocation, stormRadii: fStormRadii, galeRadii: fGaleRadii,
          });
        }
      }
    }

    if (tcNumber) {
      if (!name) name = '熱帯低気圧';
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
        track, preTrack, xmlId, tcNumber, name, nameEn, headlineText, updatedAt: updated,
        current: {
          dateTime: currentDateTimeStr || updated, lat: centerLat, lon: centerLon,
          location, direction, speedKmh, pressure, maxWind, gustWind,
          typhoonClass, intensityClass, areaClass, stormRadii, galeRadii,
          stormCenterLat, stormCenterLon, galeCenterLat, galeCenterLon
        },
        forecasts,
      });

      if (typhoonsData.length > 20) typhoonsData.shift();
    }
  },

  async syncInitialJmaData(env: Env) {
    let earthquakesData: any[] = [];
    try {
      const eqRes = await fetch("https://www.jma.go.jp/bosai/quake/data/list.json");
      if (eqRes.ok) {
        const eqList = await eqRes.json() as any[];
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
        }).reverse();
      }
    } catch (e) {
      console.error("Failed to fetch initial earthquakes", e);
    }

    await Promise.all([
      env.WEATHER_DATA_STORE.put('warnings', JSON.stringify([])),
      env.WEATHER_DATA_STORE.put('earthquakes', JSON.stringify(earthquakesData)),
      env.WEATHER_DATA_STORE.put('typhoons', JSON.stringify([])),
      env.WEATHER_DATA_STORE.put('processed_feeds', JSON.stringify([])),
      env.WEATHER_DATA_STORE.delete('sync_target'),
      env.WEATHER_DATA_STORE.delete('sync_current'),
      env.WEATHER_DATA_STORE.delete('sync_queue'),
      env.WEATHER_DATA_STORE.put('status', JSON.stringify({ lastUpdated: new Date().toISOString() })),
    ]);

    await this.updateJmaData(env, true);
  }
};
