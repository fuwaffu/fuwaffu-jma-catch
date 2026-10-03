import L from 'leaflet';

export function drawTyphoon(
  map: L.Map,
  typhoon: any,
  options: { isObs?: boolean; use24HourFormat?: boolean } = {}
) {
  const { isObs = false, use24HourFormat = false } = options;
  const cur = typhoon.current || {};
  const lat = cur.lat;
  const lon = cur.lon;
  if (!lat || !lon) return [];
  const forecasts = typhoon.forecasts || [];
  const trackPoints: [number, number][] = [[lat, lon]];

  const steps: (() => void)[][] = [];
  const addStep = (stepIdx: number, fn: () => void) => {
    if (!steps[stepIdx]) steps[stepIdx] = [];
    steps[stepIdx].push(fn);
  };

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
      if (!p1 || !p2) {
        segments.push([]);
        segments.push([]);
        continue;
      }
      const { dist, angle } = getDistAndAngle(p1, p2);
      if (dist <= Math.abs(p1.r - p2.r) || dist === 0) {
        segments.push([]);
        segments.push([]);
        continue;
      }
      const theta = Math.asin((p2.r - p1.r) / dist);
      const a1 = angle + Math.PI / 2 + theta;
      const a2 = angle - Math.PI / 2 - theta;
      segments.push([toLatLng(p1, a1), toLatLng(p2, a1)]);
      segments.push([toLatLng(p1, a2), toLatLng(p2, a2)]);
    }
    return segments;
  };

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
    for (let i = 0; i < forecasts.length; i++) {
      addStep(i + 1, () => {
        if (forecastPolygon[i*2] && forecastPolygon[i*2].length > 0) L.polyline([forecastPolygon[i*2]], { color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5', className: isObs ? 'obs-fade-in' : '' }).addTo(map);
        if (forecastPolygon[i*2+1] && forecastPolygon[i*2+1].length > 0) L.polyline([forecastPolygon[i*2+1]], { color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5', className: isObs ? 'obs-fade-in' : '' }).addTo(map);
      });
    }
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
  }
  const stormPolygon = getOuterTangentPolygon(stormPointsRaw);
  if (stormPolygon.length > 0) {
    for (let i = 0; i < forecasts.length; i++) {
      addStep(i + 1, () => {
        if (stormPolygon[i*2] && stormPolygon[i*2].length > 0) L.polyline([stormPolygon[i*2]], { color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '5,5', className: isObs ? 'obs-fade-in' : '' }).addTo(map);
        if (stormPolygon[i*2+1] && stormPolygon[i*2+1].length > 0) L.polyline([stormPolygon[i*2+1]], { color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '5,5', className: isObs ? 'obs-fade-in' : '' }).addTo(map);
      });
    }
  }

  // 3. 現在の強風域と暴風域
  const curGaleCircle = getTrueCircleFromRadii(lat, lon, cur.galeRadii);
  addStep(0, () => {
    if (curGaleCircle && curGaleCircle.radius > 0) {
      L.circle([curGaleCircle.lat, curGaleCircle.lon], { radius: curGaleCircle.radius * 1000, color: '#FFFF00', fillColor: '#FFFF00', fillOpacity: 0.3, weight: 3, className: isObs ? 'obs-fade-in' : '' }).addTo(map);
    }
  });
  const curStormCircle = getTrueCircleFromRadii(lat, lon, cur.stormRadii);
  addStep(0, () => {
    if (curStormCircle && curStormCircle.radius > 0) {
      L.circle([curStormCircle.lat, curStormCircle.lon], { radius: curStormCircle.radius * 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.3, weight: 3, className: isObs ? 'obs-fade-in' : '' }).addTo(map);
    }
  });

  // Collision helper (checks all circles)
  const placedLabels: {lat: number, lon: number}[] = [];
  const checkCollision = (lLat: number, lLon: number) => {
    let hasCollision = false;
    for (const pl of placedLabels) {
      const d = Math.sqrt(Math.pow((lLat - pl.lat) * 111, 2) + Math.pow((lLon - pl.lon) * 111 * Math.cos((pl.lat + lLat) / 2 * Math.PI / 180), 2));
      if (d < 100) hasCollision = true;
    }
    
    let maxDist = 0;
    const checkCircle = (cLat: number, cLon: number, cRadius: number) => {
      if (cRadius <= 0) return;
      const d = Math.sqrt(Math.pow((lLat - cLat) * 111, 2) + Math.pow((lLon - cLon) * 111 * Math.cos((cLat + lLat) / 2 * Math.PI / 180), 2));
      if (d < cRadius + 200) maxDist = Math.max(maxDist, cRadius + 200 - d);
    };

    if (curGaleCircle) checkCircle(curGaleCircle.lat, curGaleCircle.lon, curGaleCircle.radius);
    if (curStormCircle) checkCircle(curStormCircle.lat, curStormCircle.lon, curStormCircle.radius);
    
    forecasts.forEach((f: any) => {
      if (f.circleRadiusKm > 0) checkCircle(f.lat, f.lon, f.circleRadiusKm);
      const fStorm = getTrueCircleFromRadii(f.lat, f.lon, f.stormRadii);
      if (fStorm && fStorm.radius > 0) checkCircle(fStorm.lat, fStorm.lon, fStorm.radius);
    });
    
    return hasCollision || maxDist > 0;
  };

  // 4. 各予報円とマーカーの描画
  forecasts.forEach((fc: any, idx: number) => {
    if (!fc.lat || !fc.lon) return;
    trackPoints.push([fc.lat, fc.lon]);
    const step = idx + 1;

    addStep(step, () => {
      // 予報円
      if (fc.circleRadiusKm > 0) {
        L.circle([fc.lat, fc.lon], { radius: fc.circleRadiusKm * 1000, color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5', className: isObs ? 'obs-fade-in' : '' }).addTo(map);
      }

      // マーカー
      const cMarkerProps = isObs 
        ? { radius: 4, color: '#fff', fillColor: '#fff', fillOpacity: 1, weight: 1, pane: 'markerPane', className: 'obs-fade-in' }
        : { radius: 3, color: '#000', fillColor: '#000', fillOpacity: 1, weight: 1 };
      L.circleMarker([fc.lat, fc.lon], cMarkerProps as any).addTo(map);

      // 暴風域予報円
      const fStormCircle = getTrueCircleFromRadii(fc.lat, fc.lon, fc.stormRadii);
      if (fStormCircle && fStormCircle.radius > 0) {
        L.circle([fStormCircle.lat, fStormCircle.lon], { radius: fStormCircle.radius * 1000, color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '5,5', className: isObs ? 'obs-fade-in' : '' }).addTo(map);
      }

      // 白の進路予測線
      if (idx === 0) {
        L.polyline([[lat, lon], [fc.lat, fc.lon]], { color: '#ffffff', weight: 2, opacity: 1, className: isObs ? 'obs-fade-in' : '' }).addTo(map);
      } else {
        const prevFc = forecasts[idx - 1];
        if (prevFc && prevFc.lat && prevFc.lon) {
          L.polyline([[prevFc.lat, prevFc.lon], [fc.lat, fc.lon]], { color: '#ffffff', weight: 2, opacity: 1, className: isObs ? 'obs-fade-in' : '' }).addTo(map);
        }
      }

      // ラベル
      const timeLabel = formatForecastTime(fc.dateTime);
      let dLat = fc.lat - lat;
      let dLon = (fc.lon - lon) * Math.cos(lat * Math.PI / 180);
      if (idx > 0) {
        const prev = forecasts[idx - 1];
        dLat = fc.lat - prev.lat;
        dLon = (fc.lon - prev.lon) * Math.cos(prev.lat * Math.PI / 180);
      }
      const pathAngle = Math.atan2(dLon, dLat) * 180 / Math.PI;
      const angle = pathAngle + ((idx % 2 === 0) ? -90 : 90); // Left or Right of path
      
      let labelOffsetKm = (fc.circleRadiusKm || 50) + (isObs ? 200 : 120); 
      const rad = angle * Math.PI / 180;
      let labelLat = fc.lat + (labelOffsetKm / 111) * Math.cos(rad);
      let labelLon = fc.lon + (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);

      let attempts = 0;
      while (checkCollision(labelLat, labelLon) && attempts < 30) {
        labelOffsetKm += 50;
        labelLat = fc.lat + (labelOffsetKm / 111) * Math.cos(rad);
        labelLon = fc.lon + (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);
        attempts++;
      }

      placedLabels.push({lat: labelLat, lon: labelLon});
      L.polyline([[fc.lat, fc.lon], [labelLat, labelLon]], {
        color: isObs ? '#e2e8f0' : '#666', weight: isObs ? 2 : 1.5, opacity: 0.8, dashArray: isObs ? '4,4' : '2,2', className: isObs ? 'obs-fade-in' : ''
      }).addTo(map);

      const html = isObs 
        ? `<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,255,255,0.92);border:2px solid #999;border-radius:6px;padding:3px 7px;font-size:12px;font-weight:700;color:#333;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,0.2); transform: translate(-50%, -50%); display: inline-block;">${timeLabel}</div>`
        : `<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,255,255,0.92);border:1px solid #999;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#333;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;">${timeLabel}</div>`;

      L.marker([labelLat, labelLon], { 
        icon: L.divIcon({ html, iconSize: [0, 0], iconAnchor: isObs ? undefined : [0, 0], className: isObs ? 'obs-fade-in' : '' }),
        zIndexOffset: 1000 
      }).addTo(map);
    });
  });

  // 5. 現在位置のラベル
  addStep(0, () => {
    const curTimeLabel = formatForecastTime(cur.dateTime);
    let curLabelOffsetKm = 90;
    let pathAngle = 0;
    if (forecasts.length > 0) {
      const f = forecasts[0];
      pathAngle = Math.atan2((f.lon - lon)*Math.cos(lat*Math.PI/180), f.lat - lat) * 180 / Math.PI;
    }
    const curRad = (pathAngle - 90) * Math.PI / 180; // Left of path
    let curLabelLat = lat + (curLabelOffsetKm / 111) * Math.cos(curRad);
    let curLabelLon = lon + (curLabelOffsetKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(curRad);
    let attempts = 0;
    while (checkCollision(curLabelLat, curLabelLon) && attempts < 30) {
      curLabelOffsetKm += 50;
      curLabelLat = lat + (curLabelOffsetKm / 111) * Math.cos(curRad);
      curLabelLon = lon + (curLabelOffsetKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(curRad);
      attempts++;
    }

    placedLabels.push({lat: curLabelLat, lon: curLabelLon});
    L.polyline([[lat, lon], [curLabelLat, curLabelLon]], { color: '#FF2800', weight: 1.5, opacity: 0.8, dashArray: '2,2' }).addTo(map);

    const curHtml = isObs
      ? `<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,240,240,0.92);border:2px solid #FF2800;border-radius:6px;padding:3px 7px;font-size:12px;font-weight:700;color:#FF2800;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,0.2); transform: translate(-50%, -50%); display: inline-block;">${curTimeLabel}</div>`
      : `<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,240,240,0.92);border:1px solid #FF2800;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#FF2800;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;">${curTimeLabel}</div>`;

    L.marker([curLabelLat, curLabelLon], { 
      icon: L.divIcon({ html: curHtml, iconSize: [0, 0], iconAnchor: isObs ? undefined : [0, 0], className: isObs ? 'obs-fade-in' : '' })
    }).addTo(map);
  });

  // 8. DB表示の場合のみ、現在位置の×印とポップアップを追加
  if (!isObs) {
    addStep(0, () => {
      const typhoonIcon = L.divIcon({
        html: '<div style="font-size:24px;text-align:center;line-height:1;color:#FF2800;font-weight:bold;text-shadow:1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;">×</div>',
        iconSize: [24, 24], iconAnchor: [12, 12], className: isObs ? 'obs-fade-in' : '',
      });
      L.marker([lat, lon], { icon: typhoonIcon }).addTo(map)
        .bindPopup(`<b>${typhoon.name?.text || ''}</b><br>${cur.location || ''}<br>${cur.pressure}hPa / 最大風速${cur.maxWind}m/s`);
    });
  }

  // アニメーション実行ロジック
  if (isObs) {
    // 最初のステップ（現在位置）はすぐ描画、それ以降は500ms間隔
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i]) continue;
      if (i === 0) {
        steps[i].forEach(fn => fn());
      } else {
        setTimeout(() => {
          steps[i].forEach(fn => fn());
        }, i * 350); // 350ms per step
      }
    }
  } else {
    // DBの場合は即座にすべて描画
    steps.forEach(fns => {
      if (fns) fns.forEach(fn => fn());
    });
  }

  return trackPoints;
}
