// 気象庁 area.json から警報表示用の軽量階層データを生成する
// 使い方: node scripts/gen-area.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const res = await fetch('https://www.jma.go.jp/bosai/common/const/area.json');
const a = await res.json();

const pick = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, [v.name, v.parent]]));

const out = {
  offices: Object.fromEntries(Object.entries(a.offices).map(([k, v]) => [k, v.name])),
  class10s: pick(a.class10s),
  class15s: pick(a.class15s),
  class20s: pick(a.class20s),
};

mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/data/jmaArea.json', import.meta.url), JSON.stringify(out));
console.log('offices', Object.keys(out.offices).length, 'class20s', Object.keys(out.class20s).length);
