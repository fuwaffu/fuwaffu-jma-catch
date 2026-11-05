import { formatIntensity } from '../EarthquakeDetailView';
import { deduplicateEarthquakes, getRegionFromHypocenter } from './earthquakeUtils';
import {
  type LTelopConfig,
  type TelopCategory,
  type TelopItem,
  REGION_PREFECTURES,
} from '../types/lTelopTypes';

const INTENSITY_RANK: Record<string, number> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5弱': 5,
  '5-': 5,
  '5強': 6,
  '5+': 6,
  '6弱': 7,
  '6-': 7,
  '6強': 8,
  '6+': 8,
  '7': 9,
};

export function getRegionForPrefecture(prefOrArea: string): string {
  for (const [region, prefs] of Object.entries(REGION_PREFECTURES)) {
    if (prefs.includes(prefOrArea)) return region;
  }
  return 'その他';
}

export function isAreaAllowed(
  prefecture: string | undefined,
  regionName: string | undefined,
  config: LTelopConfig
): boolean {
  const scope = config.info.regionScope;
  if (scope === 'all') return true;
  const pref = prefecture || '';
  const reg = regionName || (pref ? getRegionForPrefecture(pref) : '');
  if (scope === 'regions') {
    return config.info.selectedRegions.some(r => r === reg || reg.includes(r) || r.includes(reg));
  }
  if (scope === 'prefectures') {
    return config.info.selectedPrefectures.includes(pref);
  }
  return true;
}

function getPriorityRule(config: LTelopConfig, category: TelopCategory) {
  return (
    config.info.priorities.find(p => p.category === category) || {
      category,
      label: category,
      priority: 99,
      enabled: true,
      durationSec: 0,
    }
  );
}

function isWithinDuration(timestampStr: string | undefined, durationSec: number): boolean {
  if (!durationSec || durationSec <= 0 || !timestampStr) return true;
  const ts = new Date(timestampStr).getTime();
  if (isNaN(ts)) return true;
  return Date.now() - ts <= durationSec * 1000;
}

export function buildTelopQueue(
  warnings: any[],
  earthquakes: any[],
  typhoons: any[],
  config: LTelopConfig
): TelopItem[] {
  // テストモードでプリセットが選択されている場合
  if (config.advanced.dataSourceMode === 'test' && config.advanced.activeTestPreset) {
    const presetItems = getTestPresetItems(config.advanced.activeTestPreset, config);
    if (presetItems.length > 0) return presetItems;
  }

  const items: TelopItem[] = [];

  // 1. 気象特別警報・警報・注意報（DBの都道府県単位データを優先集約、なければ地域単位）
  const validWarnings = (Array.isArray(warnings) ? warnings : []).filter(w => {
    // R1: Statusが「通常」以外（訓練・試験）は除外、InfoTypeが「取消」は即座に除外
    if (w.status && w.status !== '通常') return false;
    if (w.infoType === '取消') return false;
    return true;
  });

  // 都道府県または一次細分区域ごとに最新発表分を集約（訂正・更新時は最新reportDateTimeで上書き）
  const prefWarnings = validWarnings.filter(w => w.areaType === 'prefecture');
  const sourceWarnings = prefWarnings.length > 0 ? prefWarnings : validWarnings.filter(w => w.areaType === 'region' || !w.areaType);

  const groupedByArea: Record<
    string,
    {
      area: string;
      prefecture: string;
      reportDateTime: string;
      office?: string;
      entries: any[];
    }
  > = {};

  for (const w of sourceWarnings) {
    const areaKey = w.region || w.area || w.prefecture;
    if (!areaKey) continue;
    const pref = w.prefecture || areaKey;
    if (!isAreaAllowed(pref, getRegionForPrefecture(pref), config)) continue;

    const existing = groupedByArea[areaKey];
    if (!existing || new Date(w.reportDateTime) > new Date(existing.reportDateTime)) {
      groupedByArea[areaKey] = {
        area: areaKey,
        prefecture: pref,
        reportDateTime: w.reportDateTime,
        office: w.publishingOffice,
        entries: [w],
      };
    } else if (w.reportDateTime === existing.reportDateTime) {
      if (!existing.entries.some(e => e.warningName === w.warningName)) {
        existing.entries.push(w);
      }
    }
  }

  for (const group of Object.values(groupedByArea)) {
    const hasSpecial = group.entries.some(e => e.warningLevel === 'level_5' || e.warningLevel === 'special');
    const hasWarning = group.entries.some(
      e => e.warningLevel === 'level_4' || e.warningLevel === 'level_3' || e.warningLevel === 'warning'
    );
    const hasAdvisory = group.entries.some(e => e.warningLevel === 'level_2' || e.warningLevel === 'advisory');

    let topCategory: TelopCategory = 'advisory';
    let categoryLabel = '気象注意報';
    let sidebarTitle = '気象注意報';
    let colorPair = config.colors.warningLevels.advisory;

    if (hasSpecial) {
      if (!config.info.enableSpecialWarning) continue;
      topCategory = 'special_warning';
      categoryLabel = '特別警報';
      sidebarTitle = '特別警報';
      colorPair = config.colors.warningLevels.special;
    } else if (hasWarning) {
      if (!config.info.enableWarning) continue;
      topCategory = 'warning';
      categoryLabel = '気象警報';
      sidebarTitle = '気象警報';
      const isLv4 = group.entries.some(e => e.warningLevel === 'level_4');
      colorPair = isLv4 ? config.colors.warningLevels.level4 : config.colors.warningLevels.warning;
    } else if (hasAdvisory) {
      if (!config.info.enableAdvisory) continue;
      topCategory = 'advisory';
      categoryLabel = '気象注意報';
      sidebarTitle = '気象注意報';
      colorPair = config.colors.warningLevels.advisory;
    } else {
      continue;
    }

    const rule = getPriorityRule(config, topCategory);
    if (!rule.enabled) continue;
    if (!isWithinDuration(group.reportDateTime, rule.durationSec)) continue;

    // フィルタ設定に応じて有効なレベルの警報・注意報名称を気象庁発表のまま結合
    const filteredEntries = group.entries.filter(e => {
      if (e.warningLevel === 'level_5' || e.warningLevel === 'special') return config.info.enableSpecialWarning;
      if (e.warningLevel === 'level_4' || e.warningLevel === 'level_3' || e.warningLevel === 'warning') return config.info.enableWarning;
      if (e.warningLevel === 'level_2' || e.warningLevel === 'advisory') return config.info.enableAdvisory;
      return true;
    });

    if (filteredEntries.length === 0) continue;

    const namesText = filteredEntries.map(e => e.warningName).join('・');
    const headlineText = `【${group.area}】${namesText} 発表中`;

    items.push({
      id: `warn-${group.area}-${group.reportDateTime}`,
      category: topCategory,
      categoryLabel,
      sidebarTitle,
      headlineText,
      subText: namesText,
      badgeText: group.area,
      bgColor: colorPair.bg,
      textColor: colorPair.text,
      priority: rule.priority,
      timestamp: group.reportDateTime,
      office: group.office || '気象庁発表',
      areaName: group.area,
      rawType: 'warning',
      rawData: group,
    });
  }

  // 2. 地震情報
  if (config.info.enableEarthquake) {
    const eqRule = getPriorityRule(config, 'earthquake');
    if (eqRule.enabled) {
      const minRank = INTENSITY_RANK[config.info.minSeismicIntensity] || 1;
      const deduped = deduplicateEarthquakes(Array.isArray(earthquakes) ? earthquakes : [])
        .filter(eq => {
          if (eq.status && eq.status !== '通常') return false;
          if (eq.infoType === '取消') return false;
          const formattedInt = formatIntensity(eq.maxIntensity);
          const rank = INTENSITY_RANK[formattedInt] || 0;
          if (rank < minRank) return false;
          const eqRegion = getRegionFromHypocenter(eq.hypocenterName || '');
          if (config.info.regionScope === 'regions' && eqRegion !== 'その他') {
            if (!config.info.selectedRegions.some(r => r.includes(eqRegion) || eqRegion.includes(r))) {
              return false;
            }
          }
          if (!isWithinDuration(eq.originTime, eqRule.durationSec)) return false;
          return true;
        })
        .sort((a, b) => new Date(b.originTime).getTime() - new Date(a.originTime).getTime())
        .slice(0, config.info.maxEarthquakeItems || 3);

      for (const eq of deduped) {
        const formattedInt = formatIntensity(eq.maxIntensity);
        const seismicColor = config.colors.seismic[formattedInt] || { bg: '#2563EB', text: '#FFFFFF' };
        const dt = new Date(eq.originTime);
        const timeStr = !isNaN(dt.getTime())
          ? `${dt.getDate()}日${String(dt.getHours()).padStart(2, '0')}時${String(dt.getMinutes()).padStart(2, '0')}分頃`
          : '';
        const magStr = eq.magnitude ? `M${eq.magnitude}` : '規模調査中';
        const depthStr =
          eq.depth != null ? (eq.depth === 0 ? 'ごく浅い' : `深さ約${eq.depth}km`) : '';

        const headlineText = `【地震情報】${timeStr} 震源地：${eq.hypocenterName || '調査中'}（${magStr}${depthStr ? `・${depthStr}` : ''}）最大震度${formattedInt}`;

        items.push({
          id: `eq-${eq.eventId || eq.xmlId || eq.originTime}`,
          category: 'earthquake',
          categoryLabel: '地震情報',
          sidebarTitle: '地震情報',
          headlineText,
          subText: `${eq.hypocenterName} 最大震度${formattedInt}`,
          badgeText: `最大震度 ${formattedInt}`,
          bgColor: seismicColor.bg,
          textColor: seismicColor.text,
          priority: eqRule.priority,
          timestamp: eq.originTime,
          office: '気象庁発表',
          areaName: eq.hypocenterName,
          rawType: 'earthquake',
          rawData: eq,
        });
      }
    }
  }

  // 3. 台風情報
  if (config.info.enableTyphoon) {
    const tyRule = getPriorityRule(config, 'typhoon');
    if (tyRule.enabled) {
      const validTyphoons = (Array.isArray(typhoons) ? typhoons : []).filter(ty => {
        if (ty.status && ty.status !== '通常') return false;
        if (ty.infoType === '取消') return false;
        return isWithinDuration(ty.updatedAt, tyRule.durationSec);
      });

      for (const ty of validTyphoons) {
        const num = String(ty.tcNumber || '');
        const typhoonNum = num.length >= 2 ? parseInt(num.slice(-2), 10) : ty.tcNumber;
        const cur = ty.current || {};
        const namePart = ty.name ? `（${ty.name}）` : '';
        const locPart = cur.location ? `中心位置：${cur.location}` : '';
        const presPart = cur.pressure ? `中心気圧${cur.pressure}hPa` : '';
        const windPart = cur.maxWind ? `最大風速${cur.maxWind}m/s` : '';
        const movePart = [cur.direction, cur.speedKmh ? `${cur.speedKmh}km/h` : ''].filter(Boolean).join(' ');
        const intensityPart = [cur.intensityClass, cur.areaClass].filter(Boolean).join('・');

        const details = [intensityPart, locPart, movePart ? `進行：${movePart}` : '', presPart, windPart]
          .filter(Boolean)
          .join(' / ');

        const headlineText = ty.headlineText
          ? `【台風第${typhoonNum}号${namePart}】${ty.headlineText}（${details}）`
          : `【台風第${typhoonNum}号${namePart}】${details}`;

        items.push({
          id: `ty-${ty.tcNumber}`,
          category: 'typhoon',
          categoryLabel: `台風第${typhoonNum}号`,
          sidebarTitle: '台風情報',
          headlineText,
          subText: `台風第${typhoonNum}号 ${cur.pressure ? `${cur.pressure}hPa` : ''}`,
          badgeText: `台風${typhoonNum}号`,
          bgColor: '#0284C7',
          textColor: '#FFFFFF',
          priority: tyRule.priority,
          timestamp: ty.updatedAt || new Date().toISOString(),
          office: '気象庁発表',
          areaName: cur.location || '',
          rawType: 'typhoon',
          rawData: ty,
        });
      }
    }
  }

  // 4. カスタムメッセージ
  if (config.info.enableCustomMessages && Array.isArray(config.info.customMessages)) {
    const customRule = getPriorityRule(config, 'custom');
    if (customRule.enabled) {
      for (const msg of config.info.customMessages) {
        if (!msg.enabled || !msg.text.trim()) continue;
        items.push({
          id: `custom-${msg.id}`,
          category: 'custom',
          categoryLabel: msg.categoryLabel || 'お知らせ',
          sidebarTitle: msg.categoryLabel || 'お知らせ',
          headlineText: msg.text,
          badgeText: msg.categoryLabel || 'お知らせ',
          bgColor: msg.color || '#2563EB',
          textColor: msg.textColor || '#FFFFFF',
          priority: customRule.priority,
          timestamp: new Date().toISOString(),
          office: '気象庁発表',
          rawType: 'custom',
        });
      }
    }
  }

  // 優先度昇順（数値が小さいほど高優先）→ 発表日時降順でソート
  return items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

export function getTestPresetItems(presetKey: string, config: LTelopConfig): TelopItem[] {
  const nowIso = new Date().toISOString();
  switch (presetKey) {
    case 'special_warning':
      return [
        {
          id: 'test-special-warning',
          category: 'special_warning',
          categoryLabel: '特別警報',
          sidebarTitle: '特別警報',
          headlineText: '【気象特別警報・テスト】東京都・神奈川県に大雨特別警報が発表されています。最大級の警戒をしてください。（気象庁発表）',
          badgeText: '大雨特別警報',
          bgColor: config.colors.warningLevels.special.bg,
          textColor: config.colors.warningLevels.special.text,
          priority: 1,
          timestamp: nowIso,
          office: '気象庁発表',
          areaName: '東京都・神奈川県',
          rawType: 'test',
        },
      ];
    case 'warning':
      return [
        {
          id: 'test-warning',
          category: 'warning',
          categoryLabel: '気象警報',
          sidebarTitle: '気象警報',
          headlineText: '【東京都気象警報・注意報】東京地方では、大雨警報・洪水警報・雷注意報が発表されています。低い土地の浸水や河川の増水に警戒してください。',
          badgeText: '大雨・洪水警報',
          bgColor: config.colors.warningLevels.warning.bg,
          textColor: config.colors.warningLevels.warning.text,
          priority: 4,
          timestamp: nowIso,
          office: '気象庁発表',
          areaName: '東京都',
          rawType: 'test',
        },
      ];
    case 'eq_4': {
      const c4 = config.colors.seismic['4'] || { bg: '#FAE696', text: '#1E293B' };
      return [
        {
          id: 'test-eq-4',
          category: 'earthquake',
          categoryLabel: '地震情報',
          sidebarTitle: '地震情報',
          headlineText: '【震源・震度に関する情報】千葉県北西部を震源とする地震がありました（M4.8・深さ約70km）最大震度4を観測しています。この地震による津波の心配はありません。',
          badgeText: '最大震度 4',
          bgColor: c4.bg,
          textColor: c4.text,
          priority: 3,
          timestamp: nowIso,
          office: '気象庁発表',
          areaName: '千葉県北西部',
          rawType: 'earthquake',
          rawData: {
            hypocenterName: '千葉県北西部',
            magnitude: '4.8',
            maxIntensity: '4',
            depth: 70,
            originTime: nowIso,
            lat: 35.68,
            lon: 140.12,
          },
        },
      ];
    }
    case 'eq_6plus': {
      const c6 = config.colors.seismic['6強'] || { bg: '#A50021', text: '#FFFFFF' };
      return [
        {
          id: 'test-eq-6plus',
          category: 'earthquake',
          categoryLabel: '地震情報',
          sidebarTitle: '地震情報',
          headlineText: '【震源・震度に関する情報】日向灘を震源とする強い地震がありました（M7.1・深さ約30km）最大震度6強を観測しています。今後の情報に十分注意してください。',
          badgeText: '最大震度 6強',
          bgColor: c6.bg,
          textColor: c6.text,
          priority: 2,
          timestamp: nowIso,
          office: '気象庁発表',
          areaName: '日向灘',
          rawType: 'earthquake',
          rawData: {
            hypocenterName: '日向灘',
            magnitude: '7.1',
            maxIntensity: '6強',
            depth: 30,
            originTime: nowIso,
            lat: 31.8,
            lon: 131.7,
          },
        },
      ];
    }
    case 'typhoon':
      return [
        {
          id: 'test-typhoon',
          category: 'typhoon',
          categoryLabel: '台風第5号',
          sidebarTitle: '台風情報',
          headlineText: '【台風第5号（マリア）に関する情報】大型で強い台風第5号は、日本の南を北北東へ時速20kmで進んでいます（中心気圧950hPa・最大風速40m/s・最大瞬間風速60m/s）',
          badgeText: '台風第5号',
          bgColor: '#0284C7',
          textColor: '#FFFFFF',
          priority: 5,
          timestamp: nowIso,
          office: '気象庁発表',
          areaName: '日本の南',
          rawType: 'typhoon',
          rawData: {
            tcNumber: '2605',
            name: 'マリア',
            nameEn: 'MARIA',
            updatedAt: nowIso,
            current: {
              lat: 31.2,
              lon: 136.5,
              location: '日本の南',
              direction: '北北東',
              speedKmh: 20,
              pressure: 950,
              maxWind: 40,
              gustWind: 60,
              typhoonClass: '台風',
              intensityClass: '強い',
              areaClass: '大型',
              stormRadii: [{ direction: '全域', radiusKm: 130 }],
              galeRadii: [{ direction: '全域', radiusKm: 330 }],
            },
            forecasts: [
              {
                dateTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                forecastType: '24時間後',
                lat: 34.0,
                lon: 138.2,
                circleRadiusKm: 110,
                pressure: 960,
                maxWind: 35,
                gustWind: 50,
                stormRadii: [{ direction: '全域', radiusKm: 110 }],
                galeRadii: [],
              },
              {
                dateTime: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
                forecastType: '48時間後',
                lat: 37.5,
                lon: 141.0,
                circleRadiusKm: 180,
                pressure: 975,
                maxWind: 30,
                gustWind: 45,
                stormRadii: [],
                galeRadii: [],
              },
            ],
          },
        },
      ];
    case 'tsunami':
      return [
        {
          id: 'test-tsunami',
          category: 'tsunami_warning',
          categoryLabel: '津波警報',
          sidebarTitle: '津波警報',
          headlineText: '【津波警報・注意報】沿岸部に津波警報を発表しました。直ちに海岸や河口付近から離れ、高台や避難ビルなど安全な場所へ避難してください。（気象庁発表）',
          badgeText: '津波警報',
          bgColor: config.colors.tsunami.warning.bg,
          textColor: config.colors.tsunami.warning.text,
          priority: 2,
          timestamp: nowIso,
          office: '気象庁発表',
          areaName: '太平洋沿岸',
          rawType: 'test',
        },
      ];
    case 'volcano':
      return [
        {
          id: 'test-volcano',
          category: 'volcano',
          categoryLabel: '噴火警報',
          sidebarTitle: '噴火警報',
          headlineText: '【噴火警報（火口周辺警報）】桜島に火口周辺警報（噴火警戒レベル3、入山規制）が発表されています。大きな噴石や火砕流に警戒してください。（気象庁発表）',
          badgeText: '噴火警戒レベル3',
          bgColor: '#D97706',
          textColor: '#FFFFFF',
          priority: 6,
          timestamp: nowIso,
          office: '気象庁発表',
          areaName: '桜島',
          rawType: 'test',
        },
      ];
    case 'tornado':
      return [
        {
          id: 'test-tornado',
          category: 'tornado',
          categoryLabel: '竜巻注意情報',
          sidebarTitle: '竜巻注意',
          headlineText: '【竜巻注意情報】埼玉県・東京都では、竜巻などの激しい突風が発生しやすい気象状況になっています。空の様子に注意し、頑丈な建物内に移動してください。（気象庁発表）',
          badgeText: '竜巻注意情報',
          bgColor: '#E11D48',
          textColor: '#FFFFFF',
          priority: 5,
          timestamp: nowIso,
          office: '気象庁発表',
          areaName: '埼玉県・東京都',
          rawType: 'test',
        },
      ];
    default:
      return [];
  }
}

