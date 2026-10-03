// 警報データを「都道府県 > 一次細分区域 > 二次細分区域 > 市町村」の階層に集約する
// 区域定義は気象庁 area.json から生成した jmaArea.json（scripts/gen-area.mjs）を使用
import area from './data/jmaArea.json';

type Pair = [string, string]; // [name, parentCode]
const offices = area.offices as Record<string, string>;
const class10s = area.class10s as unknown as Record<string, Pair>;
const class15s = area.class15s as unknown as Record<string, Pair>;
const class20s = area.class20s as unknown as Record<string, Pair>;

export interface AreaNode {
  code: string;
  name: string;
  latest: string | null;          // 配下で最も新しい発表日時
  warnings: any[];                 // 配下の警報・注意報（種類ごとに重複排除）
  children: string[];              // 子区域コード（コード順）
}

const officeOf20 = (c20: string) => {
  const c15 = class20s[c20][1];
  const c10 = class15s[c15]?.[1];
  return { c15, c10, off: class10s[c10]?.[1] };
};

// 市町村名 → class20コード候補
const nameIndex = new Map<string, string[]>();
for (const [code, [name]] of Object.entries(class20s)) {
  if (!nameIndex.has(name)) nameIndex.set(name, []);
  nameIndex.get(name)!.push(code);
}

// 都道府県名（JISコード順）。府県予報区コードの上2桁が都道府県コードに対応する
const PREF_NAMES = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
const prefCodeOf = (offCode: string) => offCode.slice(0, 2);
const prefName = (prefCode: string) => PREF_NAMES[parseInt(prefCode, 10) - 1] || prefCode;
const prefCodeByName = new Map(PREF_NAMES.map((n, i) => [n, String(i + 1).padStart(2, '0')]));

// データ上の都道府県名（例: 沖縄県 / 石狩・空知・後志地方）がその府県予報区に該当するか
const officeMatches = (offCode: string, pref: string) => {
  if (!pref) return true;
  const offName = offices[offCode] || '';
  if (offName === pref || offName.startsWith(pref)) return true;
  return prefCodeByName.get(pref) === prefCodeOf(offCode);
};

const resolveCache = new Map<string, string | null>();
export function resolveClass20(w: any): string | null {
  if (w.areaCode) {
    const c = String(w.areaCode).padEnd(7, '0');
    if (class20s[c]) return c;
  }
  const key = `${w.prefecture}|${w.region}`;
  if (resolveCache.has(key)) return resolveCache.get(key)!;

  let cands = nameIndex.get(w.region) || [];
  // 「上対馬」→「対馬市上対馬」のような表記ゆれは末尾一致で救済
  if (cands.length === 0 && w.region) {
    cands = Object.keys(class20s).filter(c => class20s[c][0].endsWith(w.region));
  }
  const filtered = cands.filter(c => officeMatches(officeOf20(c).off, w.prefecture));
  const result = (filtered.length ? filtered : cands.length === 1 ? cands : [])[0] || null;
  resolveCache.set(key, result);
  return result;
}

export interface Hierarchy {
  prefs: Map<string, AreaNode>;     // 都道府県（コード2桁）
  class10s: Map<string, AreaNode>;
  class15s: Map<string, AreaNode>;
  class20s: Map<string, AreaNode>;
  unresolved: any[];
}

const sortCodes = (codes: Iterable<string>) => [...codes].sort();

export function buildHierarchy(warnings: any[]): Hierarchy {
  const h: Hierarchy = { prefs: new Map(), class10s: new Map(), class15s: new Map(), class20s: new Map(), unresolved: [] };

  const node = (map: Map<string, AreaNode>, code: string, name: string) => {
    let n = map.get(code);
    if (!n) { n = { code, name, latest: null, warnings: [], children: [] }; map.set(code, n); }
    return n;
  };
  const addWarning = (n: AreaNode, w: any) => {
    if (!n.latest || new Date(w.reportDateTime) > new Date(n.latest)) n.latest = w.reportDateTime;
    if (!n.warnings.some(x => x.warningName === w.warningName)) n.warnings.push(w);
  };

  // 市町村単位の電文を正とし、上位区域へ集約する（どの階層でも内容が一致する）
  for (const w of warnings) {
    if (w.isCancelled || w.areaType !== 'municipality') continue;
    const c20 = resolveClass20(w);
    if (!c20) { h.unresolved.push(w); continue; }
    const { c15, c10, off } = officeOf20(c20);
    if (!c10 || !off) { h.unresolved.push(w); continue; }
    addWarning(node(h.class20s, c20, class20s[c20][0]), w);
    addWarning(node(h.class15s, c15, class15s[c15][0]), w);
    addWarning(node(h.class10s, c10, class10s[c10][0]), w);
    addWarning(node(h.prefs, prefCodeOf(off), prefName(prefCodeOf(off))), w);
  }

  // 子区域リスト（警報の有無に関わらず全区域）を付与
  const childrenOf = (parent: string, src: Record<string, Pair>) =>
    sortCodes(Object.keys(src).filter(c => src[c][1] === parent));
  for (const [code, n] of h.prefs) n.children = sortCodes(Object.keys(class10s).filter(c => prefCodeOf(class10s[c][1]) === code));
  for (const [code, n] of h.class10s) n.children = childrenOf(code, class15s);
  for (const [code, n] of h.class15s) n.children = childrenOf(code, class20s);

  return h;
}

export const areaName = {
  pref: (c: string) => prefName(c),
  class10: (c: string) => class10s[c]?.[0] || c,
  class15: (c: string) => class15s[c]?.[0] || c,
  class20: (c: string) => class20s[c]?.[0] || c,
  prefOf10: (c: string) => class10s[c] ? prefCodeOf(class10s[c][1]) : '',
};

export const sortedPrefCodes = (h: Hierarchy) => sortCodes(h.prefs.keys());
