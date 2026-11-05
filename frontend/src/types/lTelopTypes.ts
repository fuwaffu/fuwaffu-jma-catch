export type TelopCategory =
  | 'special_warning'
  | 'tsunami_warning'
  | 'earthquake'
  | 'tsunami_advisory'
  | 'warning'
  | 'typhoon'
  | 'volcano'
  | 'tornado'
  | 'heavy_rain'
  | 'landslide'
  | 'advisory'
  | 'custom';

export interface LayoutElementConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  locked?: boolean;
}

export interface SidebarLayoutConfig extends LayoutElementConfig {
  titleText: string;
  subTitleText: string;
  titleOffsetX: number; // px offset from center
  titleOffsetY: number; // px offset from center
  direction: 'vertical' | 'horizontal';
  fontSize: number;
  letterSpacing: number;
}

export interface TickerLayoutConfig extends LayoutElementConfig {
  fontSize: number;
  scrollSpeed: number; // px/sec (40 - 200)
  scrollDirection: 'rtl' | 'ltr';
}

export interface TyphoonMapLayoutConfig extends LayoutElementConfig {
  displayMode: 'auto' | 'always' | 'manual';
  tileType: 'osm' | 'gsi' | 'carto';
}

export interface ClockLayoutConfig extends LayoutElementConfig {
  fontFamily: string;
  timeFontWeight: number;
  timeFontSize: number;
  dateFontWeight: number;
  dateFontSize: number;
  dateFormatMode?: 'alternate' | 'ja' | 'en';
  dividerThickness?: number;
}

export interface PriorityRule {
  category: TelopCategory;
  label: string;
  priority: number;
  enabled: boolean;
  durationSec: number; // 0 = 消去まで (無期限)
}

export interface CustomTelopMessage {
  id: string;
  categoryLabel: string;
  text: string;
  color: string;
  textColor: string;
  enabled: boolean;
}

export interface LTelopConfig {
  version: string;
  info: {
    enableSpecialWarning: boolean;
    enableWarning: boolean;
    enableAdvisory: boolean;
    enableEarthquake: boolean;
    minSeismicIntensity: '1' | '2' | '3' | '4' | '5弱' | '5強' | '6弱' | '6強' | '7';
    maxEarthquakeItems: number;
    warningMaxAgeHours: number; // 1 - 72 hours
    earthquakeMaxAgeHours: number; // 1 - 72 hours
    warningAreaLevel: 'prefecture' | 'region' | 'municipality';
    enableTyphoon: boolean;
    enableCustomMessages: boolean;
    regionScope: 'all' | 'regions' | 'prefectures';
    selectedRegions: string[];
    selectedPrefectures: string[];
    priorities: PriorityRule[];
    customMessages: CustomTelopMessage[];
  };
  colors: {
    warningLevels: {
      special: { bg: string; text: string };
      level4: { bg: string; text: string };
      warning: { bg: string; text: string };
      advisory: { bg: string; text: string };
      cleared: { bg: string; text: string };
    };
    seismic: Record<string, { bg: string; text: string }>;
    tsunami: {
      majorWarning: { bg: string; text: string };
      warning: { bg: string; text: string };
      advisory: { bg: string; text: string };
    };
  };
  areaColors: {
    sidebar: {
      bgStart: string;
      bgEnd: string;
      useGradient: boolean;
      gradientDeg: number;
      textColor: string;
      borderRightWidth: number;
      borderRightColor: string;
      opacity: number;
    };
    ticker: {
      bgStart: string;
      bgEnd: string;
      useGradient: boolean;
      textColor: string;
      borderTopWidth: number;
      borderTopColor: string;
      opacity: number;
    };
    headerBadge: {
      bgColor: string;
      textColor: string;
      borderRadius: number;
    };
    frameBorder: {
      color: string;
      width: number;
    };
  };
  layout: {
    sidebar: SidebarLayoutConfig;
    ticker: TickerLayoutConfig;
    typhoonMap: TyphoonMapLayoutConfig;
    earthquakePanel: LayoutElementConfig;
    clock: ClockLayoutConfig;
    attribution: LayoutElementConfig;
  };
  advanced: {
    fontFamily: string;
    pollingIntervalSec: number;
    attributionText: string;
    attributionFontSize: number;
    attributionOpacity: number;
    dataSourceMode: 'live' | 'test';
    activeTestPreset: string | null;
  };
}

export interface TickerBadgeInfo {
  label: string;
  subLabel?: string;
  bgColor: string;
  textColor: string;
}

export interface TelopItem {
  id: string;
  category: TelopCategory;
  categoryLabel: string;
  sidebarTitle: string;
  headlineText: string;
  subText?: string;
  badgeText?: string;
  bgColor: string;
  textColor: string;
  priority: number;
  timestamp: string;
  office?: string;
  areaName?: string;
  prefectureName?: string;
  subAreaName?: string;
  areaLevel?: 'prefecture' | 'region' | 'municipality';
  rawType: 'warning' | 'earthquake' | 'typhoon' | 'test' | 'custom';
  rawData?: any;
  /** 下部ティッカー左端のクロスディゾルブ表示用バッジ候補 */
  tickerBadges?: TickerBadgeInfo[];
  /** ティッカー本文内でラベル（ピル）として並べて表示する警報リスト */
  inlineBadges?: TickerBadgeInfo[];
}

export const ALL_REGIONS = [
  '北海道',
  '東北',
  '関東甲信',
  '北陸',
  '東海',
  '近畿',
  '中国 (山口は除く)',
  '四国',
  '九州北部 (山口を含む)',
  '九州南部・奄美',
  '沖縄',
];

export const REGION_PREFECTURES: Record<string, string[]> = {
  '北海道': [
    '北海道', '宗谷地方', '上川地方', '留萌地方', '網走地方', '北見地方', '紋別地方',
    '十勝地方', '釧路地方', '根室地方', '胆振地方', '日高地方', '石狩地方', '空知地方',
    '後志地方', '渡島地方', '檜山地方',
    '上川・留萌地方', '網走・北見・紋別地方', '石狩・空知・後志地方',
    '釧路・根室地方', '胆振・日高地方', '渡島・檜山地方',
  ],
  '東北': ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  '関東甲信': ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '山梨県', '長野県'],
  '北陸': ['新潟県', '富山県', '石川県', '福井県'],
  '東海': ['岐阜県', '静岡県', '愛知県', '三重県'],
  '近畿': ['滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  '中国 (山口は除く)': ['鳥取県', '島根県', '岡山県', '広島県'],
  '四国': ['徳島県', '香川県', '愛媛県', '高知県'],
  '九州北部 (山口を含む)': ['山口県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県'],
  '九州南部・奄美': ['宮崎県', '鹿児島県', '鹿児島県（奄美地方除く）', '奄美地方'],
  '沖縄': ['沖縄県', '沖縄本島地方', '大東島地方', '宮古島地方', '八重山地方'],
};

/** 全国47都道府県のJISコード (JIS X 0401) */
export const PREFECTURE_CODES: Record<string, number> = {
  '北海道': 1,
  '青森県': 2,
  '岩手県': 3,
  '宮城県': 4,
  '秋田県': 5,
  '山形県': 6,
  '福島県': 7,
  '茨城県': 8,
  '栃木県': 9,
  '群馬県': 10,
  '埼玉県': 11,
  '千葉県': 12,
  '東京都': 13,
  '神奈川県': 14,
  '新潟県': 15,
  '富山県': 16,
  '石川県': 17,
  '福井県': 18,
  '山梨県': 19,
  '長野県': 20,
  '岐阜県': 21,
  '静岡県': 22,
  '愛知県': 23,
  '三重県': 24,
  '滋賀県': 25,
  '京都府': 26,
  '大阪府': 27,
  '兵庫県': 28,
  '奈良県': 29,
  '和歌山県': 30,
  '鳥取県': 31,
  '島根県': 32,
  '岡山県': 33,
  '広島県': 34,
  '山口県': 35,
  '徳島県': 36,
  '香川県': 37,
  '愛媛県': 38,
  '高知県': 39,
  '福岡県': 40,
  '佐賀県': 41,
  '長崎県': 42,
  '熊本県': 43,
  '大分県': 44,
  '宮崎県': 45,
  '鹿児島県': 46,
  '沖縄県': 47,
};

/** 都道府県名から都道府県コードを取得（表記揺れ・支庁名対応） */
export function getPrefectureCode(name?: string): number {
  if (!name) return 999;
  const clean = name.trim();
  if (PREFECTURE_CODES[clean]) return PREFECTURE_CODES[clean];

  // 北海道の各地方・振興局
  if (clean.includes('北海道') || REGION_PREFECTURES['北海道']?.includes(clean)) {
    return 1;
  }

  // 鹿児島県・奄美地方
  if (clean.includes('鹿児島') || clean.includes('奄美')) {
    return 46;
  }

  // 「都」「府」「県」の省略対応
  for (const [pref, code] of Object.entries(PREFECTURE_CODES)) {
    const base = pref.replace(/[都府県]$/, '');
    if (clean === base || clean.startsWith(base) || clean.includes(base)) {
      return code;
    }
  }

  return 999;
}

/**
 * 1920x1080 キャンバス内で、左サイドバーを除いた幅 (1920 - sidebarWidth) と
 * 下部ティッカーを除いた高さ (1080 - tickerHeight) が常に 16:9 になるように正規化する。
 * (1920 - W) / (1080 - H) = 16 / 9  <=>  W / H = 16 / 9
 */
export function compute16By9LFrame(
  source: { sidebarWidth?: number; tickerHeight?: number }
): { sidebarWidth: number; sidebarHeight: number; tickerHeight: number; tickerY: number; innerWidth: number; innerHeight: number } {
  let tickerHeight: number;
  if (source.tickerHeight !== undefined) {
    tickerHeight = Math.max(36, Math.min(270, Math.round(source.tickerHeight)));
  } else if (source.sidebarWidth !== undefined) {
    const sw = Math.max(64, Math.min(480, Math.round(source.sidebarWidth)));
    tickerHeight = Math.round((sw * 9) / 16);
  } else {
    tickerHeight = 72;
  }
  const sidebarWidth = Math.round((tickerHeight * 16) / 9);
  const sidebarHeight = 1080 - tickerHeight;
  const tickerY = 1080 - tickerHeight;
  return {
    sidebarWidth,
    sidebarHeight,
    tickerHeight,
    tickerY,
    innerWidth: 1920 - sidebarWidth,
    innerHeight: 1080 - tickerHeight,
  };
}

// デフォルト: サイドバー幅 128px, 下部ティッカー高さ 72px -> 中の映像画面 1792 x 1008 (正確に 16:9)
export const DEFAULT_LTELOP_CONFIG: LTelopConfig = {
  version: '1.1',
  info: {
    enableSpecialWarning: true,
    enableWarning: true,
    enableAdvisory: true,
    enableEarthquake: true,
    minSeismicIntensity: '1',
    maxEarthquakeItems: 3,
    warningMaxAgeHours: 24,
    earthquakeMaxAgeHours: 24,
    warningAreaLevel: 'prefecture',
    enableTyphoon: true,
    enableCustomMessages: true,
    regionScope: 'all',
    selectedRegions: [...ALL_REGIONS],
    selectedPrefectures: Object.values(REGION_PREFECTURES).flat(),
    priorities: [
      { category: 'special_warning', label: '特別警報', priority: 1, enabled: true, durationSec: 0 },
      { category: 'tsunami_warning', label: '津波警報・大津波警報', priority: 2, enabled: true, durationSec: 0 },
      { category: 'earthquake', label: '震度速報・地震情報', priority: 3, enabled: true, durationSec: 0 },
      { category: 'warning', label: '気象警報', priority: 4, enabled: true, durationSec: 0 },
      { category: 'typhoon', label: '台風情報', priority: 5, enabled: true, durationSec: 0 },
      { category: 'advisory', label: '気象注意報', priority: 6, enabled: true, durationSec: 0 },
      { category: 'custom', label: 'カスタム・お知らせ', priority: 7, enabled: true, durationSec: 0 },
    ],
    customMessages: [],
  },
  colors: {
    warningLevels: {
      special: { bg: '#000000', text: '#FFFFFF' },
      level4: { bg: '#800080', text: '#FFFFFF' },
      warning: { bg: '#FF2800', text: '#FFFFFF' },
      advisory: { bg: '#FFD700', text: '#1E293B' },
      cleared: { bg: '#64748B', text: '#FFFFFF' },
    },
    seismic: {
      '1': { bg: '#F2F2FF', text: '#1E293B' },
      '2': { bg: '#00AAFF', text: '#FFFFFF' },
      '3': { bg: '#0041FF', text: '#FFFFFF' },
      '4': { bg: '#FAE696', text: '#1E293B' },
      '5弱': { bg: '#FFE600', text: '#1E293B' },
      '5強': { bg: '#FF9900', text: '#FFFFFF' },
      '6弱': { bg: '#FF2800', text: '#FFFFFF' },
      '6強': { bg: '#A50021', text: '#FFFFFF' },
      '7': { bg: '#B40068', text: '#FFFFFF' },
    },
    tsunami: {
      majorWarning: { bg: '#B40068', text: '#FFFFFF' },
      warning: { bg: '#FF2800', text: '#FFFFFF' },
      advisory: { bg: '#FFD700', text: '#1E293B' },
    },
  },
  areaColors: {
    sidebar: {
      bgStart: '#8B0000',
      bgEnd: '#C41E3A',
      useGradient: true,
      gradientDeg: 135,
      textColor: '#FFFFFF',
      borderRightWidth: 3,
      borderRightColor: '#FFD700',
      opacity: 0.95,
    },
    ticker: {
      bgStart: '#1a1a2e',
      bgEnd: '#16213e',
      useGradient: true,
      textColor: '#FFFFFF',
      borderTopWidth: 3,
      borderTopColor: '#FFD700',
      opacity: 0.94,
    },
    headerBadge: {
      bgColor: '#000000',
      textColor: '#FFFFFF',
      borderRadius: 6,
    },
    frameBorder: {
      color: '#334155',
      width: 0,
    },
  },
  layout: {
    sidebar: {
      x: 0,
      y: 0,
      width: 128,
      height: 1008,
      visible: true,
      titleText: '気象・防災情報',
      subTitleText: '',
      titleOffsetX: 0,
      titleOffsetY: 0,
      direction: 'vertical',
      fontSize: 44,
      letterSpacing: 8,
    },
    ticker: {
      x: 0,
      y: 1008,
      width: 1920,
      height: 72,
      visible: true,
      fontSize: 30,
      scrollSpeed: 90,
      scrollDirection: 'rtl',
    },
    typhoonMap: {
      x: 152,
      y: 36,
      width: 440,
      height: 360,
      visible: true,
      displayMode: 'auto',
      tileType: 'osm',
    },
    earthquakePanel: {
      x: 152,
      y: 416,
      width: 440,
      height: 200,
      visible: true,
    },
    clock: {
      x: 1782,
      y: 24,
      width: 114,
      height: 100,
      visible: true,
      fontFamily: "'Open Sans', sans-serif",
      timeFontWeight: 800,
      timeFontSize: 32,
      dateFontWeight: 700,
      dateFontSize: 13,
      dateFormatMode: 'alternate',
      dividerThickness: 1,
    },
    attribution: {
      x: 1680,
      y: 948,
      width: 216,
      height: 44,
      visible: true,
    },
  },
  advanced: {
    fontFamily: "'LINE Seed JP', 'Noto Sans JP', sans-serif",
    pollingIntervalSec: 300,
    attributionText: '気象庁発表',
    attributionFontSize: 18,
    attributionOpacity: 0.85,
    dataSourceMode: 'live',
    activeTestPreset: null,
  },
};

export const LTELOP_STORAGE_KEY = 'l-telop-config';

function enforce16By9OnConfig(cfg: LTelopConfig): LTelopConfig {
  const frame = compute16By9LFrame({ tickerHeight: cfg.layout?.ticker?.height ?? 72 });
  const specialBg =
    cfg.colors?.warningLevels?.special?.bg?.toUpperCase() === '#8B008B'
      ? '#000000'
      : cfg.colors?.warningLevels?.special?.bg ?? '#000000';
  const headerBadgeBg =
    cfg.areaColors?.headerBadge?.bgColor?.toUpperCase() === '#C41E3A'
      ? '#000000'
      : cfg.areaColors?.headerBadge?.bgColor ?? '#000000';
  const clampHours = (h: any, fallback = 24) => {
    const n = Number(h);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(72, Math.round(n)));
  };
  const rawClock = cfg.layout?.clock as any;
  const isOldRectClock =
    rawClock &&
    rawClock.width === 186 &&
    (rawClock.height === 54 || rawClock.height === 64);
  const clockLayout: ClockLayoutConfig = {
    x: isOldRectClock ? 1782 : rawClock?.x ?? 1782,
    y: isOldRectClock ? 24 : rawClock?.y ?? 24,
    width: isOldRectClock ? 114 : rawClock?.width ?? 114,
    height: isOldRectClock ? 100 : rawClock?.height ?? 100,
    visible: rawClock?.visible ?? true,
    locked: rawClock?.locked ?? false,
    fontFamily: rawClock?.fontFamily || "'Open Sans', sans-serif",
    timeFontWeight: Number(rawClock?.timeFontWeight) || 800,
    timeFontSize: Number(rawClock?.timeFontSize) || 32,
    dateFontWeight: Number(rawClock?.dateFontWeight) || 700,
    dateFontSize: Number(rawClock?.dateFontSize) || 13,
    dateFormatMode: rawClock?.dateFormatMode || 'alternate',
    dividerThickness:
      rawClock?.dividerThickness !== undefined ? Number(rawClock?.dividerThickness) : 1,
  };

  return {
    ...cfg,
    info: {
      ...cfg.info,
      warningMaxAgeHours: clampHours(cfg.info?.warningMaxAgeHours, 24),
      earthquakeMaxAgeHours: clampHours(cfg.info?.earthquakeMaxAgeHours, 24),
      warningAreaLevel: cfg.info?.warningAreaLevel || 'prefecture',
    },
    colors: {
      ...cfg.colors,
      warningLevels: {
        ...cfg.colors.warningLevels,
        special: {
          ...cfg.colors.warningLevels.special,
          bg: specialBg,
        },
      },
    },
    areaColors: {
      ...cfg.areaColors,
      headerBadge: {
        ...cfg.areaColors.headerBadge,
        bgColor: headerBadgeBg,
      },
    },
    layout: {
      ...cfg.layout,
      clock: clockLayout || cfg.layout.clock,
      sidebar: {
        ...cfg.layout.sidebar,
        x: 0,
        y: 0,
        width: frame.sidebarWidth,
        height: frame.sidebarHeight,
      },
      ticker: {
        ...cfg.layout.ticker,
        x: 0,
        y: frame.tickerY,
        width: 1920,
        height: frame.tickerHeight,
      },
    },
  };
}

export function loadLTelopConfig(): LTelopConfig {
  try {
    const params = new URLSearchParams(window.location.search);
    const cfgParam = params.get('cfg');
    if (cfgParam) {
      const decoded = JSON.parse(decodeURIComponent(atob(cfgParam)));
      return enforce16By9OnConfig(deepMergeConfig(DEFAULT_LTELOP_CONFIG, decoded));
    }
  } catch {
    // ignore malformed url param
  }

  try {
    const raw = localStorage.getItem(LTELOP_STORAGE_KEY);
    if (!raw) return DEFAULT_LTELOP_CONFIG;
    const parsed = JSON.parse(raw);
    return enforce16By9OnConfig(deepMergeConfig(DEFAULT_LTELOP_CONFIG, parsed));
  } catch {
    return DEFAULT_LTELOP_CONFIG;
  }
}

export function saveLTelopConfig(config: LTelopConfig): void {
  try {
    localStorage.setItem(LTELOP_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save L-Telop config to localStorage:', e);
  }
}

export function encodeConfigForUrl(config: LTelopConfig): string {
  try {
    const compact: Partial<LTelopConfig> = {
      ...config,
      info: {
        ...config.info,
        selectedPrefectures:
          config.info.regionScope === 'prefectures' ? config.info.selectedPrefectures : [],
      },
    };
    return btoa(encodeURIComponent(JSON.stringify(compact)));
  } catch {
    return '';
  }
}

function deepMergeConfig(base: any, override: any): any {
  if (!override || typeof override !== 'object') return base;
  const result: any = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override)) {
    const val = override[key];
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      if (key === 'selectedPrefectures' && val.length === 0 && override.regionScope !== 'prefectures') {
        result[key] = base[key];
      } else {
        result[key] = val;
      }
    } else if (val && typeof val === 'object' && base[key] && typeof base[key] === 'object') {
      result[key] = deepMergeConfig(base[key], val);
    } else {
      result[key] = val;
    }
  }
  return result;
}
