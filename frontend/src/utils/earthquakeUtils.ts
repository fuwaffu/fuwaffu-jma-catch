// 地方の定義（北から順）
export const REGIONS = [
  '北海道地方',
  '東北地方',
  '関東地方',
  '中部地方',
  '近畿地方',
  '中国地方',
  '四国地方',
  '九州地方',
  '沖縄地方',
  'その他',
] as const;

export type RegionName = (typeof REGIONS)[number];

// 震源地名から地方を判定する
export function getRegionFromHypocenter(hypo: string | undefined | null): RegionName {
  if (!hypo) return 'その他';
  const name = String(hypo);

  if (/北海道|宗谷|留萌|上川|オホーツク|根室|釧路|十勝|胆振|日高|石狩|空知|後志|渡島|檜山|浦河|網走|襟裳|内浦湾/.test(name)) {
    return '北海道地方';
  }
  if (/青森|岩手|宮城|秋田|山形|福島|三陸|津軽|下北|庄内|最上|村山|置賜|会津|中通り|浜通り/.test(name)) {
    return '東北地方';
  }
  if (/茨城|栃木|群馬|埼玉|千葉|東京|神奈川|八丈島|三宅島|新島|神津島|小笠原|伊豆大島|父島|母島|房総|相模湾|東京湾/.test(name)) {
    return '関東地方';
  }
  if (/新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|能登|佐渡|若狭湾|遠州灘|駿河湾|三河湾|越後|飛騨|美濃|甲信|北陸|伊豆半島|伊豆地方/.test(name)) {
    return '中部地方';
  }
  if (/三重|滋賀|京都|大阪|兵庫|奈良|和歌山|紀伊水道|播磨灘|丹後|淡路島|琵琶湖/.test(name)) {
    return '近畿地方';
  }
  if (/鳥取|島根|岡山|広島|山口|隠岐|周防灘|安芸灘|備後灘/.test(name)) {
    return '中国地方';
  }
  if (/徳島|香川|愛媛|高知|土佐湾|伊予灘|宇和海|豊後水道/.test(name)) {
    return '四国地方';
  }
  if (/福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|天草|有明海|橘湾|錦江湾|薩摩|大隅|種子島|屋久島|奄美|日向灘|吐噶喇|トカラ/.test(name)) {
    return '九州地方';
  }
  if (/沖縄|宮古島|八重山|石垣島|西表島|与那国島|久米島|大東島|先島/.test(name)) {
    return '沖縄地方';
  }
  return 'その他';
}

// 地方の並び順インデックス
export function getRegionOrder(region: RegionName): number {
  const idx = REGIONS.indexOf(region);
  return idx === -1 ? 999 : idx;
}

// 秒単位で重複している同一地震のレコードをマージ・統合する
export function deduplicateEarthquakes(earthquakes: any[]): any[] {
  if (!Array.isArray(earthquakes)) return [];

  // 1. 各地震の重複キーを生成（同一EventID、または同一秒のoriginTime＋震源地の一致/調査中）
  const result: any[] = [];
  const keyMap = new Map<string, number>(); // key -> index in result

  for (const eq of earthquakes) {
    if (!eq) continue;

    // 時刻の秒単位キー（ISO文字列の秒まで: YYYY-MM-DDTHH:mm:ss）
    let secKey = '';
    if (eq.originTime) {
      try {
        const d = new Date(eq.originTime);
        if (!isNaN(d.getTime())) {
          secKey = d.toISOString().slice(0, 19); // 2026-10-29T01:23:45
        }
      } catch {}
    }

    // 検索: eventIdが一致するか、または同一秒で震源名が一致（または一方が調査中）
    let existingIndex = -1;
    if (eq.eventId && keyMap.has(`eid:${eq.eventId}`)) {
      existingIndex = keyMap.get(`eid:${eq.eventId}`)!;
    } else if (secKey) {
      // secKeyで探す
      for (let i = 0; i < result.length; i++) {
        const r = result[i];
        let rSec = '';
        if (r.originTime) {
          try {
            rSec = new Date(r.originTime).toISOString().slice(0, 19);
          } catch {}
        }
        if (rSec === secKey) {
          // 震源名が同じ、またはどちらかが「震源調査中」などの場合、同一地震の更新と判定
          const hypo1 = (eq.hypocenterName || '').trim();
          const hypo2 = (r.hypocenterName || '').trim();
          const isSurvey1 = !hypo1 || hypo1.includes('調査中');
          const isSurvey2 = !hypo2 || hypo2.includes('調査中');

          if (isSurvey1 || isSurvey2 || hypo1 === hypo2 || hypo1.includes(hypo2) || hypo2.includes(hypo1)) {
            existingIndex = i;
            break;
          }
        }
      }
    }

    if (existingIndex !== -1) {
      // 既存のレコードとマージ（更新された情報・判明した情報を優先）
      const prev = result[existingIndex];
      const prevHypo = prev.hypocenterName || '';
      const newHypo = eq.hypocenterName || '';
      const chosenHypo = (newHypo && !newHypo.includes('調査中')) ? newHypo : (prevHypo || newHypo);

      const prevMag = String(prev.magnitude || '');
      const newMag = String(eq.magnitude || '');
      const chosenMag = newMag && newMag !== '—' ? newMag : prevMag;

      const prevMaxInt = String(prev.maxIntensity || '');
      const newMaxInt = String(eq.maxIntensity || '');
      const chosenMaxInt = newMaxInt && newMaxInt !== '—' ? newMaxInt : prevMaxInt;

      const chosenDepth = (eq.depth != null && eq.depth !== 0) ? eq.depth : (prev.depth ?? 0);
      const chosenLat = (eq.lat != null) ? eq.lat : prev.lat;
      const chosenLon = (eq.lon != null) ? eq.lon : prev.lon;

      result[existingIndex] = {
        ...prev,
        ...eq,
        hypocenterName: chosenHypo,
        magnitude: chosenMag,
        maxIntensity: chosenMaxInt,
        depth: chosenDepth,
        lat: chosenLat,
        lon: chosenLon,
        eventId: eq.eventId || prev.eventId,
        xmlId: eq.xmlId || prev.xmlId,
        originTime: eq.originTime || prev.originTime,
      };
    } else {
      // 新規登録
      const newIdx = result.length;
      result.push({ ...eq });
      if (eq.eventId) {
        keyMap.set(`eid:${eq.eventId}`, newIdx);
      }
    }
  }

  return result;
}
