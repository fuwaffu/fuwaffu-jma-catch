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
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});

// Cache TTL: 10分
const CACHE_TTL_SECONDS = 600;

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
  let data = await env.WEATHER_DATA_STORE.get(cacheKey, { type: 'json' });
  if (data === null) {
    if (cacheKey === 'status') data = { lastUpdated: null };
    else data = [];
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
      if (url.pathname === "/api/status") return await cachedKvQuery('status', env, corsHeaders);
      
      if (url.pathname === "/api/trigger-update") {
        await this.updateJmaData(env);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/sync-initial") {
        await this.syncInitialJmaData(env);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (url.pathname === "/api/clear-cache") {
        await invalidateApiCaches();
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
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
    const processedFeedsSet = new Set(processedFeeds);

    let warningsData: any[] = await env.WEATHER_DATA_STORE.get('warnings', { type: 'json' }) || [];
    let earthquakesData: any[] = await env.WEATHER_DATA_STORE.get('earthquakes', { type: 'json' }) || [];
    let typhoonsData: any[] = await env.WEATHER_DATA_STORE.get('typhoons', { type: 'json' }) || [];
    
    let fetchCount = 0;
    const MAX_SUBREQUESTS = 45; // Cloudflare limits to 50
    let dataUpdated = false;

    for (const feedUrl of feedUrls) {
      if (fetchCount >= MAX_SUBREQUESTS) break;
      try {
        const res = await fetch(feedUrl, { headers: { "User-Agent": "Jma-Dashboard/1.0" } });
        fetchCount++;
        if (!res.ok) continue;
        const text = await res.text();
        const feed = parser.parse(text);

        if (!feed.feed || !feed.feed.entry) continue;

        const entries = Array.isArray(feed.feed.entry) ? feed.feed.entry : [feed.feed.entry];
        let candidateEntries = entries.filter((e: any) => {
          if (!e.id) return false;
          const link = e.link?.['@_href'] || '';
          return link.match(/_VPWW(5[3-9]|6[0-1])_/) || 
                 link.includes('_VXSE51_') || link.includes('_VXSE52_') || link.includes('_VXSE53_') || 
                 link.includes('_VPTW6') || link.includes('_VPTI5');
        });

        if (isInitialSync) {
            const typhoons = candidateEntries.filter((e: any) => e.link?.['@_href'].includes('_VPTW'));
            const earthquakes = candidateEntries.filter((e: any) => e.link?.['@_href'].includes('_VXSE'));
            const warnings = candidateEntries.filter((e: any) => e.link?.['@_href'].includes('_VPWW'));
            
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

        for (const entry of newEntries.reverse()) {
          if (fetchCount >= MAX_SUBREQUESTS) break;
          
          const id = entry.id;
          const title = entry.title;
          const updated = entry.updated;
          const link = entry.link?.['@_href'];

          if (!id || !link) continue;

          let telegramCode = '';
          if (link.match(/_VPWW(5[3-9]|6[0-1])_/)) telegramCode = 'VPWW';
          else if (link.includes('_VXSE51_') || link.includes('_VXSE52_') || link.includes('_VXSE53_')) telegramCode = 'VXSE';
          else if (link.includes('_VPTW6') || link.includes('_VPTI5')) telegramCode = 'VPTW';
          
          if (!telegramCode) {
            processedFeedsSet.add(id);
            continue;
          }

          const xmlRes = await fetch(link, { headers: { "User-Agent": "Jma-Dashboard/1.0" } });
          fetchCount++;
          if (!xmlRes.ok) continue;
          const xmlText = await xmlRes.text();
          const xmlData = parser.parse(xmlText);

          const report = xmlData.Report;
          if (!report) continue;

          const status = report.Control?.Status;
          if (status !== '通常') {
            processedFeedsSet.add(id);
            continue;
          }

          const infoType = report.Head?.InfoType;
          const reportDateTime = report.Head?.ReportDateTime;

          processedFeedsSet.add(id);

          if (telegramCode === 'VPWW') {
            this.processWarningToMemory(report, id, reportDateTime, infoType, status, warningsData);
            dataUpdated = true;
          } else if (telegramCode === 'VXSE') {
            this.processEarthquakeToMemory(report, id, infoType, earthquakesData);
            dataUpdated = true;
          } else if (telegramCode === 'VPTW') {
            this.processTyphoonToMemory(report, id, updated, typhoonsData);
            dataUpdated = true;
          }
        }
      } catch (e) {
        console.error(`Failed to process feed ${feedUrl}`, e);
      }
    }

    if (dataUpdated) {
      // 履歴は最新の1000件のみ保持する
      const newProcessedFeeds = Array.from(processedFeedsSet).slice(-1000);
      
      // データストアに反映
      await env.WEATHER_DATA_STORE.put('warnings', JSON.stringify(warningsData));
      await env.WEATHER_DATA_STORE.put('earthquakes', JSON.stringify(earthquakesData));
      await env.WEATHER_DATA_STORE.put('typhoons', JSON.stringify(typhoonsData));
      await env.WEATHER_DATA_STORE.put('processed_feeds', JSON.stringify(newProcessedFeeds));
      await env.WEATHER_DATA_STORE.put('status', JSON.stringify({ lastUpdated: new Date().toISOString() }));
      
      await invalidateApiCaches();
    }
  },

  processWarningToMemory(report: any, xmlId: string, reportDateTime: string, infoType: string, status: string, warningsData: any[]) {
    if (infoType === '取消') return;

    const warnings = Array.isArray(report.Body?.Warning) ? report.Body.Warning : (report.Body?.Warning ? [report.Body.Warning] : []);
    if (warnings.length === 0) return;

    let prefecture = '';
    const idMatch = xmlId.match(/_VPWW(?:53|54)_(\d{6})\.xml/);
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
            
            // 特別警報・警報の判定
            if (wName.includes('特別警報')) level = 'special';
            else if (wName.includes('警報')) level = 'warning';

            // 大雨、洪水（氾濫）、高潮、土砂災害のみレベルを付与する
            if (wName.includes('大雨') || wName.includes('洪水') || wName.includes('氾濫') || wName.includes('高潮') || wName.includes('土砂災害')) {
              if (level === 'special') {
                wName = `レベル5 ${wName}`;
              } else if (level === 'warning') {
                if (wName.includes('高潮')) {
                  // 厳密には高潮警報・土砂災害警戒情報はレベル4相当ですが、フロントの表示やこれまでの仕様に合わせる場合はレベルを付与します
                  // 今回は高潮警報と土砂災害はレベル4、大雨・洪水はレベル3とします
                  wName = `レベル4 ${wName}`;
                } else {
                  wName = `レベル3 ${wName}`;
                }
              } else { // advisory
                if (wName.includes('高潮')) {
                  // 注意報でも高潮はレベル3相当の場合があるが基本は2
                  // 簡易的にすべてレベル2注意報とする
                  wName = `レベル2 ${wName}`; 
                } else {
                  wName = `レベル2 ${wName}`;
                }
              }
              // レベル文字列からwarningLevelを再設定
              const levelMatch = wName.match(/レベル([1-5])/);
              if (levelMatch) level = `level_${levelMatch[1]}`;
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

    const items = Array.isArray(infos.MeteorologicalInfo) ? infos.MeteorologicalInfo : (infos.MeteorologicalInfo ? [infos.MeteorologicalInfo] : []);
    
    let tcNumber = '';
    let name = '';
    
    for (const info of items) {
      if (info.Item && info.Item.Kind) {
        const kinds = Array.isArray(info.Item.Kind) ? info.Item.Kind : [info.Item.Kind];
        for (const kind of kinds) {
          if (kind.Property && kind.Property.TyphoonNamePart) {
            tcNumber = kind.Property.TyphoonNamePart.Number || tcNumber;
            name = kind.Property.TyphoonNamePart.NameKana || kind.Property.TyphoonNamePart.Name || name;
          }
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
        updatedAt: updated
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
