import { WEATHER_DATA_STORE } from './localKv';

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

export async function syncMapJsonState(env: any) {
  try {
    console.log('[Hybrid Sync] Fetching map.json and area.json...');
    const [mapRes, areaRes] = await Promise.all([
      fetch('https://www.jma.go.jp/bosai/warning/data/warning/map.json'),
      fetch('https://www.jma.go.jp/bosai/common/const/area.json')
    ]);

    if (!mapRes.ok || !areaRes.ok) {
      console.warn('[Hybrid Sync] Failed to fetch JMA JSON APIs');
      return;
    }

    const mapData = await mapRes.json();
    const areaData = await areaRes.json();

    // 辞書の作成
    const areaCodeToName = (code: string) => {
        if (areaData.class20s && areaData.class20s[code]) return areaData.class20s[code].name;
        if (areaData.class15s && areaData.class15s[code]) return areaData.class15s[code].name;
        if (areaData.class10s && areaData.class10s[code]) return areaData.class10s[code].name;
        if (areaData.offices && areaData.offices[code]) return areaData.offices[code].name;
        if (areaData.centers && areaData.centers[code]) return areaData.centers[code].name;
        return code;
    };

    // JSONから現在の全警報のリストを作成
    const activeWarningsSet = new Set<string>();

    for (const report of mapData) {
        if (!report.areaTypes) continue;
        for (const areaTypeObj of report.areaTypes) {
            for (const area of areaTypeObj.areas) {
                const areaCode = area.code;
                const regionName = areaCodeToName(areaCode);
                
                for (const w of area.warnings) {
                    if (w.status === '発表' || w.status === '継続') {
                        const warningCode = w.code;
                        const wInfo = WARNING_CODES[warningCode];
                        if (wInfo) {
                            // ユニークなキー: "地域名_警報名"
                            activeWarningsSet.add(`${regionName}_${wInfo.name}`);
                        }
                    }
                }
            }
        }
    }

    console.log(`[Hybrid Sync] Found ${activeWarningsSet.size} active warnings in map.json`);

    // 既存の warningsData と突合
    let warningsData: any[] = await env.WEATHER_DATA_STORE.get('warnings', { type: 'json' }) || [];
    let modified = false;

    for (let i = 0; i < warningsData.length; i++) {
        if (warningsData[i].isCancelled) continue;

        const region = warningsData[i].region || warningsData[i].area;
        const warningName = warningsData[i].warningName;
        
        // JSONの方にこの警報が存在しない場合は削除（論理削除）
        if (!activeWarningsSet.has(`${region}_${warningName}`)) {
            warningsData[i].isCancelled = true;
            warningsData[i].reportDateTime = new Date().toISOString(); // キャンセル時刻を記録
            modified = true;
            console.log(`[Hybrid Sync] Purged outdated warning: ${region} ${warningName}`);
        }
    }

    if (modified) {
        await env.WEATHER_DATA_STORE.put('warnings', JSON.stringify(warningsData));
        console.log('[Hybrid Sync] Cleaned up old warnings in KV');
    } else {
        console.log('[Hybrid Sync] No old warnings to clean up');
    }

  } catch (e) {
    console.error('[Hybrid Sync Error]', e);
  }
}
