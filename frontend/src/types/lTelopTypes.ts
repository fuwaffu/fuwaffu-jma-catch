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
    clock: LayoutElementConfig;
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
  rawType: 'warning' | 'earthquake' | 'typhoon' | 'test' | 'custom';
  rawData?: any;
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

export const DEFAULT_LTELOP_CONFIG: LTelopConfig = {
  version: '1.0',
  info: {
    enableSpecialWarning: true,
    enableWarning: true,
    enableAdvisory: true,
    enableEarthquake: true,
    minSeismicIntensity: '1',
    maxEarthquakeItems: 3,
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
      special: { bg: '#8B008B', text: '#FFFFFF' },
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
      bgColor: '#C41E3A',
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
      width: 110,
      height: 1016,
      visible: true,
      direction: 'vertical',
      fontSize: 44,
      letterSpacing: 8,
    },
    ticker: {
      x: 0,
      y: 1016,
      width: 1920,
      height: 64,
      visible: true,
      fontSize: 30,
      scrollSpeed: 90,
      scrollDirection: 'rtl',
    },
    typhoonMap: {
      x: 136,
      y: 36,
      width: 440,
      height: 360,
      visible: true,
      displayMode: 'auto',
      tileType: 'osm',
    },
    earthquakePanel: {
      x: 136,
      y: 416,
      width: 440,
      height: 200,
      visible: true,
    },
    clock: {
      x: 1710,
      y: 24,
      width: 186,
      height: 54,
      visible: true,
    },
    attribution: {
      x: 1680,
      y: 960,
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

export function loadLTelopConfig(): LTelopConfig {
  try {
    // URLパラメータにcfgが含まれている場合はそれを優先マージ（OBS単体ブラウザ対応）
    const params = new URLSearchParams(window.location.search);
    const cfgParam = params.get('cfg');
    if (cfgParam) {
      const decoded = JSON.parse(decodeURIComponent(atob(cfgParam)));
      return deepMergeConfig(DEFAULT_LTELOP_CONFIG, decoded);
    }
  } catch {
    // ignore malformed url param
  }

  try {
    const raw = localStorage.getItem(LTELOP_STORAGE_KEY);
    if (!raw) return DEFAULT_LTELOP_CONFIG;
    const parsed = JSON.parse(raw);
    return deepMergeConfig(DEFAULT_LTELOP_CONFIG, parsed);
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
    // URL長を抑えるため、選択された都道府県が全件の場合は省略した軽量オブジェクトにする
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
      // regionScope !== 'prefectures' のときに空配列で上書きされた場合はデフォルト維持
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

