import L from 'leaflet';

// 台風MAP描画の共通ヘルパー（通常画面 App.tsx / OBS画面 ObsApp.tsx で共用）

type LayerTarget = L.Map | L.LayerGroup;
type CirclePoint = { lat: number; lon: number; r: number };

const KM_PER_DEG = 111;

const DIR_ANGLES: Record<string, number> = {
  '北': 0, '北北東': 22.5, '北東': 45, '東北東': 67.5,
  '東': 90, '東南東': 112.5, '南東': 135, '南南東': 157.5,
  '南': 180, '南南西': 202.5, '南西': 225, '西南西': 247.5,
  '西': 270, '西北西': 292.5, '北西': 315, '北北西': 337.5,
};

const distKm = (p1: { lat: number; lon: number }, p2: { lat: number; lon: number }) => {
  const dLat = (p2.lat - p1.lat) * KM_PER_DEG;
  const dLon = (p2.lon - p1.lon) * KM_PER_DEG * Math.cos(((p1.lat + p2.lat) / 2) * Math.PI / 180);
  return { dist: Math.sqrt(dLat * dLat + dLon * dLon), angle: Math.atan2(dLat, dLon) };
};

// 気象庁の非対称半径データから「真の円の中心と半径」を計算する
export function getTrueCircleFromRadii(eyeLat: number, eyeLon: number, radii: any[]) {
  if (!radii || radii.length === 0) return null;

  const all = radii.find(r => r.direction === '全域' || !r.direction);
  if (all) return { lat: eyeLat, lon: eyeLon, radius: all.radiusKm };

  let maxR = 0;
  let maxDir = '';
  for (const r of radii) {
    if (r.radiusKm > maxR) {
      maxR = r.radiusKm;
      maxDir = (r.direction || '').replace('側', '');
    }
  }

  const maxAngle = DIR_ANGLES[maxDir];
  if (maxAngle === undefined) return { lat: eyeLat, lon: eyeLon, radius: maxR };

  const oppAngle = (maxAngle + 180) % 360;
  let minDiff = 360;
  let minOppositeR = 0;
  for (const r of radii) {
    const angle = DIR_ANGLES[(r.direction || '').replace('側', '')];
    if (angle === undefined) continue;
    let diff = Math.abs(angle - oppAngle);
    if (diff > 180) diff = 360 - diff;
    if (diff < minDiff) {
      minDiff = diff;
      minOppositeR = r.radiusKm;
    }
  }
  if (minOppositeR === 0) minOppositeR = maxR;

  const trueRadius = (maxR + minOppositeR) / 2;
  const offsetKm = (maxR - minOppositeR) / 2;
  const rad = maxAngle * Math.PI / 180;
  return {
    lat: eyeLat + (offsetKm * Math.cos(rad)) / KM_PER_DEG,
    lon: eyeLon + (offsetKm * Math.sin(rad)) / (KM_PER_DEG * Math.cos(eyeLat * Math.PI / 180)),
    radius: trueRadius,
  };
}

// 隣の円に完全に含まれる円は外接線を引けないため除外する
const removeContainedCircles = (points: CirclePoint[]) => {
  const result = [...points];
  let changed = true;
  while (changed && result.length > 1) {
    changed = false;
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i], b = result[i + 1];
      const { dist } = distKm(a, b);
      if (dist + Math.min(a.r, b.r) <= Math.max(a.r, b.r)) {
        result.splice(a.r <= b.r ? i : i + 1, 1);
        changed = true;
        break;
      }
    }
  }
  return result;
};

// 連続する円の外接線で囲んだ領域（扇形/コーン）の外枠を計算する
export function getOuterTangentPolygon(input: CirclePoint[]): [number, number][] {
  const points = removeContainedCircles(input);
  if (points.length <= 1) return [];

  const leftPoints: [number, number][] = [];
  const rightPoints: [number, number][] = [];
  const toLatLng = (p: CirclePoint, angle: number): [number, number] => [
    p.lat + (p.r * Math.sin(angle)) / KM_PER_DEG,
    p.lon + (p.r * Math.cos(angle)) / (KM_PER_DEG * Math.cos(p.lat * Math.PI / 180)),
  ];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const { dist, angle } = distKm(p1, p2);
    const theta = Math.asin((p1.r - p2.r) / dist);
    const aLeft = angle + Math.PI / 2 + theta;
    const aRight = angle - Math.PI / 2 - theta;

    if (i === 0) {
      // 最初の円の背面（お尻）
      for (let a = aRight; a <= aLeft + 0.01; a += Math.PI / 16) rightPoints.push(toLatLng(p1, a));
    }
    leftPoints.push(toLatLng(p1, aLeft), toLatLng(p2, aLeft));
    rightPoints.unshift(toLatLng(p1, aRight));
    rightPoints.unshift(toLatLng(p2, aRight));
    if (i === points.length - 2) {
      // 最後の円の前面（頭）
      for (let a = aLeft; a <= aRight + 2 * Math.PI + 0.01; a += Math.PI / 16) leftPoints.push(toLatLng(p2, a));
    }
  }
  return [...leftPoints, ...rightPoints];
}

// これまでの経路（熱帯低気圧の期間は点線、台風の期間は実線）
export function drawPastTrack(target: LayerTarget, typhoon: any, lat: number, lon: number, opts: { color: string; weight: number }) {
  const valid = (p: any) => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number';
  const preTrack: [number, number][] = (typhoon.preTrack || []).filter(valid);
  const track: [number, number][] = (typhoon.track || []).filter(valid);

  if (preTrack.length > 1) {
    L.polyline(preTrack, { color: opts.color, weight: Math.max(1, opts.weight - 1), opacity: 0.7, dashArray: '4,4' }).addTo(target);
  }
  if (track.length > 0) {
    L.polyline([...track, [lat, lon]], { color: opts.color, weight: opts.weight, opacity: 0.9 }).addTo(target);
  }
}

// 暴風警戒域：暴風域（警戒域）がある予報点までで描画を止める（中心へ収束させない）
export function drawStormWarningArea(target: LayerTarget, typhoon: any, lat: number, lon: number, style: L.PathOptions) {
  const toPoint = (eyeLat: number, eyeLon: number, radii: any[]): CirclePoint => {
    const c = getTrueCircleFromRadii(eyeLat, eyeLon, radii);
    return c ? { lat: c.lat, lon: c.lon, r: c.radius || 0 } : { lat: eyeLat, lon: eyeLon, r: 0 };
  };

  const all: CirclePoint[] = [
    toPoint(lat, lon, typhoon.current?.stormRadii),
    ...(typhoon.forecasts || []).filter((f: any) => f.lat && f.lon).map((f: any) => toPoint(f.lat, f.lon, f.stormRadii)),
  ];
  const start = all.findIndex(p => p.r > 0);
  if (start < 0) return;
  const points: CirclePoint[] = [];
  for (let i = start; i < all.length && all[i].r > 0; i++) points.push(all[i]);

  const polygon = getOuterTangentPolygon(points);
  if (polygon.length > 0) {
    L.polygon(polygon, { fillColor: 'transparent', ...style }).addTo(target);
  }
}

// 過去の経路（preTrack, track）、現在位置、予報進路を含むすべての座標点を返す
export function getTyphoonAllTrackPoints(typhoon: any, lat: number, lon: number): [number, number][] {
  const valid = (p: any): p is [number, number] => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number';
  const points: [number, number][] = [];
  if (Array.isArray(typhoon.preTrack)) points.push(...typhoon.preTrack.filter(valid));
  if (Array.isArray(typhoon.track)) points.push(...typhoon.track.filter(valid));
  if (typeof lat === 'number' && typeof lon === 'number') points.push([lat, lon]);
  if (Array.isArray(typhoon.forecasts)) {
    for (const f of typhoon.forecasts) {
      if (typeof f.lat === 'number' && typeof f.lon === 'number') points.push([f.lat, f.lon]);
    }
  }
  return points;
}

