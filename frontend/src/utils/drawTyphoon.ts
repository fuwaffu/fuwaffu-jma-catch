import L from 'leaflet';

export function drawTyphoon(
  map: L.Map,
  typhoon: any,
  options: { isObs?: boolean; use24HourFormat?: boolean } = {}
) {
  // ponytail: Extracted shared drawing logic to prevent divergence between DB and OBS
  const { isObs = false, use24HourFormat = false } = options;
  const cur = typhoon.current;
  if (!cur || !cur.center) return [];

  const lat = cur.center.lat;
  const lon = cur.center.lon;
  const forecasts = typhoon.forecasts || [];
  const trackPoints: [number, number][] = [[lat, lon]];

  // 扇形（コーン）の外枠を計算するヘルパー
  const getOuterTangentPolygon = (points: { lat: number, lon: number, r: number }[]) => {
    if (!points || points.length <= 1) return [];
    const segments: [number, number][][] = [];
    const getDistAndAngle = (p1: any, p2: any) => {
      const dLat = (p2.lat - p1.lat) * 111;
      const dLon = (p2.lon - p1.lon) * 111 * Math.cos((p1.lat + p2.lat) / 2 * Math.PI / 180);
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      const angle = Math.atan2(dLat, dLon); 
      return { dist, angle };
    };
    const toLatLng = (p: any, angle: number): [number, number] => [
      p.lat + (p.r * Math.sin(angle)) / 111,
      p.lon + (p.r * Math.cos(angle)) / (111 * Math.cos(p.lat * Math.PI / 180))
    ];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i], p2 = points[i + 1];
      if (!p1 || !p2) continue;
      const { dist, angle } = getDistAndAngle(p1, p2);
      if (dist <= Math.abs(p1.r - p2.r) || dist === 0) continue;
      const theta = Math.asin((p2.r - p1.r) / dist);
      const a1 = angle + Math.PI / 2 + theta;
      const a2 = angle - Math.PI / 2 - theta;
      segments.push([toLatLng(p1, a1), toLatLng(p2, a1)]);
      segments.push([toLatLng(p1, a2), toLatLng(p2, a2)]);
    }
    return segments;
  };

  // 気象庁の非対称半径データから「真の円の中心と半径」を計算するヘルパー
  const getTrueCircleFromRadii = (eyeLat: number, eyeLon: number, radii: any[]) => {
    if (!radii || radii.length === 0) return null;
    const all = radii.find((r: any) => r.direction === '全域' || !r.direction);
    if (all) return { lat: eyeLat, lon: eyeLon, radius: all.radiusKm };
    const dirAngles: Record<string, number> = {
      '北': 0, '北北東': 22.5, '北東': 45, '東北東': 67.5,
      '東': 90, '東南東': 112.5, '南東': 135, '南南東': 157.5,
      '南': 180, '南南西': 202.5, '南西': 225, '西南西': 247.5,
      '西': 270, '西北西': 292.5, '北西': 315, '北北西': 337.5
    };
    let maxR = 0, minOppositeR = 0, maxDir = '';
    for (const r of radii) {
      if (r.radiusKm > maxR) { maxR = r.radiusKm; maxDir = (r.direction || '').replace('側', ''); }
    }
    const maxAngle = dirAngles[maxDir];
    if (maxAngle !== undefined) {
      const oppAngle = (maxAngle + 180) % 360;
      let minDiff = 360, foundOpposite = false;
      for (const r of radii) {
         const dir = (r.direction || '').replace('側', '');
         const angle = dirAngles[dir];
         if (angle !== undefined) {
            let diff = Math.abs(angle - oppAngle);
            if (diff > 180) diff = 360 - diff;
            if (diff < minDiff) { minDiff = diff; minOppositeR = r.radiusKm; foundOpposite = true; }
         }
      }
      if (!foundOpposite || minOppositeR === 0) minOppositeR = maxR;
      const offsetKm = (maxR - minOppositeR) / 2;
      const rad = maxAngle * Math.PI / 180;
      const dLat = (offsetKm * Math.cos(rad)) / 111;
      const dLon = (offsetKm * Math.sin(rad)) / (111 * Math.cos(eyeLat * Math.PI / 180));
      return { lat: eyeLat + dLat, lon: eyeLon + dLon, radius: (maxR + minOppositeR) / 2 };
    }
    return { lat: eyeLat, lon: eyeLon, radius: maxR };
  };

  const formatForecastTime = (isoStr: string): string => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = d.getDate(), hour = d.getHours();
      const weekDay = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
      if (use24HourFormat) return `${day}日(${weekDay}) ${hour}時`;
      if (hour === 0) return `${day}日(${weekDay}) 午前0時`;
      if (hour < 12) return `${day}日(${weekDay}) 午前${hour}時`;
      if (hour === 12) return `${day}日(${weekDay}) 午後0時`;
      return `${day}日(${weekDay}) 午後${hour - 12}時`;
    } catch { return isoStr; }
  };

  // 1. 白色の予報円コーン（扇形外枠のみ）
  const forecastPoints = [{ lat, lon, r: 0 }, ...forecasts.map((f: any) => ({ lat: f.lat, lon: f.lon, r: f.circleRadiusKm || 0 }))];
  const forecastPolygon = getOuterTangentPolygon(forecastPoints);
  if (forecastPolygon.length > 0) {
    L.polyline(forecastPolygon, { color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);
  }

  // 2. 赤色の暴風警戒域コーン
  const getStormCircleForPoint = (fEyeLat: number, fEyeLon: number, radii: any[]) => {
    const c = getTrueCircleFromRadii(fEyeLat, fEyeLon, radii);
    return c ? { lat: c.lat, lon: c.lon, r: c.radius } : { lat: fEyeLat, lon: fEyeLon, r: 0 };
  };
  const curStormRaw = getStormCircleForPoint(lat, lon, cur.stormRadii);
  const stormPointsRaw = [curStormRaw];
  for (const f of forecasts) {
    const p = getStormCircleForPoint(f.lat, f.lon, f.stormRadii);
    stormPointsRaw.push(p);
    if (p.r === 0) break;
  }
  const stormPolygon = getOuterTangentPolygon(stormPointsRaw);
  if (stormPolygon.length > 0) {
    L.polyline(stormPolygon, { color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);
  }

  // 3. 現在の強風域と暴風域（塗りつぶしあり、実線）
  const curGaleCircle = getTrueCircleFromRadii(lat, lon, cur.galeRadii);
  if (curGaleCircle && curGaleCircle.radius > 0) {
    L.circle([curGaleCircle.lat, curGaleCircle.lon], { radius: curGaleCircle.radius * 1000, color: '#FFFF00', fillColor: '#FFFF00', fillOpacity: 0.3, weight: 3 }).addTo(map);
  }
  const curStormCircle = getTrueCircleFromRadii(lat, lon, cur.stormRadii);
  if (curStormCircle && curStormCircle.radius > 0) {
    L.circle([curStormCircle.lat, curStormCircle.lon], { radius: curStormCircle.radius * 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.3, weight: 3 }).addTo(map);
  }

  // 4. 各予報円とマーカーの描画
  const fStormCircles: {lat: number, lon: number, radius: number}[] = [];
  forecasts.forEach((fc: any, idx: number) => {
    if (!fc.lat || !fc.lon) return;
    trackPoints.push([fc.lat, fc.lon]);

    if (fc.circleRadiusKm > 0) {
      L.circle([fc.lat, fc.lon], { radius: fc.circleRadiusKm * 1000, color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);
    }

    const cMarkerProps = isObs 
      ? { radius: 4, color: '#fff', fillColor: '#fff', fillOpacity: 1, weight: 1, pane: 'markerPane' }
      : { radius: 3, color: '#000', fillColor: '#000', fillOpacity: 1, weight: 1 };
    L.circleMarker([fc.lat, fc.lon], cMarkerProps as any).addTo(map);

    const fStormCircle = getTrueCircleFromRadii(fc.lat, fc.lon, fc.stormRadii);
    if (fStormCircle && fStormCircle.radius > 0) fStormCircles.push(fStormCircle);

    const timeLabel = formatForecastTime(fc.dateTime);
    const angle = (idx % 2 === 0) ? -45 : 135; 
    let labelOffsetKm = (fc.circleRadiusKm || 50) + (isObs ? 160 : 90); 
    const rad = angle * Math.PI / 180;
    let labelLat = fc.lat + (labelOffsetKm / 111) * Math.cos(rad);
    let labelLon = fc.lon + (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);

    // ponytail: Ensure forecast label does not enter the CURRENT typhoon circle
    let distToCur = Math.sqrt(Math.pow((labelLat - lat) * 111, 2) + Math.pow((labelLon - lon) * 111 * Math.cos((lat + labelLat) / 2 * Math.PI / 180), 2));
    let attempts = 0;
    while (distToCur < maxCurRadius + 40 && attempts < 20) {
      labelOffsetKm += 30;
      labelLat = fc.lat + (labelOffsetKm / 111) * Math.cos(rad);
      labelLon = fc.lon + (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);
      distToCur = Math.sqrt(Math.pow((labelLat - lat) * 111, 2) + Math.pow((labelLon - lon) * 111 * Math.cos((lat + labelLat) / 2 * Math.PI / 180), 2));
      attempts++;
    }

    L.polyline([[fc.lat, fc.lon], [labelLat, labelLon]], {
      color: isObs ? '#e2e8f0' : '#666', weight: isObs ? 2 : 1.5, opacity: 0.8, dashArray: isObs ? '4,4' : '2,2'
    }).addTo(map);

    const html = isObs 
      ? `<div style="color:#1e293b;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;white-space:nowrap;font-family:'Zen Kaku Gothic Paren', 'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);">${timeLabel}</div>`
      : `<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,255,255,0.92);border:1px solid #999;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#333;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;">${timeLabel}</div>`;

    L.marker([labelLat, labelLon], { 
      icon: L.divIcon({ html, iconSize: [0, 0], iconAnchor: isObs ? undefined : [0, 0], className: '' }),
      zIndexOffset: 1000 
    }).addTo(map);
  });

  // 5. 現在位置のラベル
  const curTimeLabel = formatForecastTime(cur.dateTime);
  const maxCurRadius = Math.max(...(cur.stormRadii||[]).map((r: any)=>r.radiusKm), ...(cur.galeRadii||[]).map((r: any)=>r.radiusKm), 0);
  const curLabelOffsetKm = maxCurRadius + 60;
  const curRad = -135 * Math.PI / 180;
  const curLabelLat = lat + (curLabelOffsetKm / 111) * Math.cos(curRad);
  const curLabelLon = lon + (curLabelOffsetKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(curRad);

  L.polyline([[lat, lon], [curLabelLat, curLabelLon]], { color: '#FF2800', weight: 1.5, opacity: 0.8, dashArray: '2,2' }).addTo(map);

  const curHtml = isObs
    ? `<div style="color:#FF2800;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;white-space:nowrap;font-family:'Zen Kaku Gothic Paren', 'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);">${curTimeLabel}</div>`
    : `<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,240,240,0.92);border:1px solid #FF2800;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#FF2800;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;">${curTimeLabel}</div>`;

  L.marker([curLabelLat, curLabelLon], { 
    icon: L.divIcon({ html: curHtml, iconSize: [0, 0], iconAnchor: isObs ? undefined : [0, 0], className: '' })
  }).addTo(map);

  // 6. 白の進路予測線
  if (trackPoints.length > 1) {
    L.polyline(trackPoints, { color: '#ffffff', weight: 2, opacity: 1 }).addTo(map);
  }

  // 7. その上に暴風域予報円
  fStormCircles.forEach(c => {
    L.circle([c.lat, c.lon], { radius: c.radius * 1000, color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);
  });

  // 8. DB表示の場合のみ、現在位置の×印とポップアップを追加
  if (!isObs) {
    const typhoonIcon = L.divIcon({
      html: '<div style="font-size:24px;text-align:center;line-height:1;color:#FF2800;font-weight:bold;text-shadow:1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;">×</div>',
      iconSize: [24, 24], iconAnchor: [12, 12], className: '',
    });
    L.marker([lat, lon], { icon: typhoonIcon }).addTo(map)
      .bindPopup(`<b>${typhoon.name?.text || ''}</b><br>${cur.location || ''}<br>${cur.pressure}hPa / 最大風速${cur.maxWind}m/s`);
  }

  // マップのフィットは呼び出し元で行うために trackPoints を返す
  return trackPoints;
}
