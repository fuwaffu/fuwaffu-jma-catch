import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://jma-dashboard-backend.fuwaffu.workers.dev';

export default function ObsApp() {
  const [typhoons, setTyphoons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const prevIsSyncing = useRef(false);

  useEffect(() => {
    let intervalId;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();
        
        const currentlySyncing = !!data.isSyncing;
        
        if (currentlySyncing) {
            // syncing
        } else if (prevIsSyncing.current) {
            console.log('[Sync Status] Sync complete, fetching new data...');
            // Need to fetch data here... wait, fetchData is defined lower down!
            // I should just emit an event or rely on the 5 min interval? 
            // We can dispatch a custom event.
            window.dispatchEvent(new Event('forceFetchData'));
        }
        
        prevIsSyncing.current = currentlySyncing;
        
        if (data.lastUpdated) {
          // console.log("【システム更新検証】最新の更新時刻:", data.lastUpdated);
        }
      } catch (e) {}
    };
    checkStatus();
    intervalId = setInterval(checkStatus, 3000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // OBSモードでは背景透過にする
    document.body.style.backgroundColor = 'transparent';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      console.log("[ObsApp] Starting data fetch for typhoons...");
      try {
        const res = await fetch(`${API_BASE}/api/typhoons`);
        console.log(`[ObsApp] Typhoons response status: ${res.status}`);
        if (res.ok) {
          const data = await res.json();
          console.log(`[ObsApp] Loaded Typhoons: ${data?.length} items`, data);
          setTyphoons(data);
        } else {
          console.error("[ObsApp] Typhoons API not OK:", res.statusText);
        }
      } catch (e) {
        console.error('[ObsApp] Failed to fetch typhoons:', e);
      }
      setLoading(false);
    };
    
    fetchData();
    const interval = setInterval(fetchData, 300000);
    
    const handleForceFetch = () => fetchData();
    window.addEventListener('forceFetchData', handleForceFetch);
    
    return () => {
        clearInterval(interval);
        window.removeEventListener('forceFetchData', handleForceFetch);
    };
  }, []);

  const [use24HourFormat, setUse24HourFormat] = useState(true);

  // 一番最新の台風（またはTC番号が一番大きいもの）を選択
  const activeTyphoon = typhoons.length > 0 
    ? [...typhoons].sort((a, b) => b.tcNumber - a.tcNumber)[0] 
    : null;

  useEffect(() => {
    if (!activeTyphoon || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false // 出典表記は独自のUIで行うため非表示
      });

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    
    // 既存のレイヤーをクリア（タイルレイヤー以外）
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    const cur = activeTyphoon.current || {};
    const lat = cur.lat;
    const lon = cur.lon;
    if (!lat || !lon) return;

    const forecasts = activeTyphoon.forecasts || [];
    const trackPoints: [number, number][] = [[lat, lon]];

    // 台風の目（現在位置）のマーカー
    const typhoonIcon = L.divIcon({
      html: '<div style="font-size:24px;text-align:center;line-height:1;color:#FF2800;font-weight:bold;text-shadow:1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;">×</div>',
      iconSize: [24, 24], iconAnchor: [12, 12], className: '',
    });
    L.marker([lat, lon], { icon: typhoonIcon }).addTo(map);

    // 扇形（コーン）の外枠を計算するヘルパー
    const getOuterTangentPolygon = (points: { lat: number, lon: number, r: number }[]) => {
      if (points.length <= 1) return [];
      
      const leftPoints: [number, number][] = [];
      const rightPoints: [number, number][] = [];
      
      // 球面上の緯度経度から距離(km)と角度(ラジアン)を簡易計算
      const getDistAndAngle = (p1: any, p2: any) => {
        const dLat = (p2.lat - p1.lat) * 111;
        const dLon = (p2.lon - p1.lon) * 111 * Math.cos((p1.lat + p2.lat) / 2 * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        const angle = Math.atan2(dLat, dLon); 
        return { dist, angle };
      };

      const toLatLng = (p: any, angle: number): [number, number] => {
        return [
          p.lat + (p.r * Math.sin(angle)) / 111,
          p.lon + (p.r * Math.cos(angle)) / (111 * Math.cos(p.lat * Math.PI / 180))
        ];
      };

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const { dist, angle } = getDistAndAngle(p1, p2);
        
        if (dist <= Math.abs(p1.r - p2.r) || dist === 0) {
          continue; // 内包されるか同じ場所の場合は接線を引かない
        }
        
        const theta = Math.asin((p1.r - p2.r) / dist);
        
        const a1Left = angle + Math.PI / 2 + theta;
        const a1Right = angle - Math.PI / 2 - theta;
        const a2Left = angle + Math.PI / 2 + theta;
        const a2Right = angle - Math.PI / 2 - theta;

        if (i === 0) {
          // 最初の円の背面（お尻）の半円を追加
          for (let a = a1Right; a <= a1Left + 0.01; a += Math.PI / 16) {
            rightPoints.push(toLatLng(p1, a));
          }
        }
        
        leftPoints.push(toLatLng(p1, a1Left));
        leftPoints.push(toLatLng(p2, a2Left));
        
        rightPoints.unshift(toLatLng(p1, a1Right));
        rightPoints.unshift(toLatLng(p2, a2Right));

        if (i === points.length - 2) {
          // 最後の円の前面（頭）の半円を追加
          for (let a = a2Left; a <= a2Right + 2 * Math.PI + 0.01; a += Math.PI / 16) {
            leftPoints.push(toLatLng(p2, a));
          }
        }
      }
      
      return [...leftPoints, ...rightPoints];
    };

    // 白色の予報円（扇形外枠のみ）
    const forecastPoints = [{ lat, lon, r: 0 }, ...forecasts.map((f: any) => ({ lat: f.lat, lon: f.lon, r: f.circleRadiusKm || 0 }))];
    const forecastPolygon = getOuterTangentPolygon(forecastPoints);
    if (forecastPolygon.length > 0) {
      L.polygon(forecastPolygon, { color: '#555', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);
    }

    // 気象庁の非対称半径データから「真の円の中心と半径」を計算するヘルパー
    const getTrueCircleFromRadii = (eyeLat: number, eyeLon: number, radii: any[]) => {
      if (!radii || radii.length === 0) return null;
      
      const all = radii.find(r => r.direction === '全域' || !r.direction);
      if (all) {
        return { lat: eyeLat, lon: eyeLon, radius: all.radiusKm };
      }

      const dirAngles: Record<string, number> = {
        '北': 0, '北北東': 22.5, '北東': 45, '東北東': 67.5,
        '東': 90, '東南東': 112.5, '南東': 135, '南南東': 157.5,
        '南': 180, '南南西': 202.5, '南西': 225, '西南西': 247.5,
        '西': 270, '西北西': 292.5, '北西': 315, '北北西': 337.5
      };

      let maxR = 0;
      let minOppositeR = 0;
      let maxDir = '';

      for (const r of radii) {
        if (r.radiusKm > maxR) {
          maxR = r.radiusKm;
          maxDir = (r.direction || '').replace('側', '');
        }
      }

      const maxAngle = dirAngles[maxDir];
      if (maxAngle !== undefined) {
        const oppAngle = (maxAngle + 180) % 360;
        let minDiff = 360;
        let foundOpposite = false;
        for (const r of radii) {
           const dir = (r.direction || '').replace('側', '');
           const angle = dirAngles[dir];
           if (angle !== undefined) {
              let diff = Math.abs(angle - oppAngle);
              if (diff > 180) diff = 360 - diff;
              if (diff < minDiff) {
                 minDiff = diff;
                 minOppositeR = r.radiusKm;
                 foundOpposite = true;
              }
           }
        }
        
        if (!foundOpposite || minOppositeR === 0) minOppositeR = maxR;

        const trueRadius = (maxR + minOppositeR) / 2;
        const offsetKm = (maxR - minOppositeR) / 2;
        
        const rad = maxAngle * Math.PI / 180;
        const dLat = (offsetKm * Math.cos(rad)) / 111;
        const dLon = (offsetKm * Math.sin(rad)) / (111 * Math.cos(eyeLat * Math.PI / 180));
        
        return { lat: eyeLat + dLat, lon: eyeLon + dLon, radius: trueRadius };
      }
      
      return { lat: eyeLat, lon: eyeLon, radius: maxR };
    };

    // 日付フォーマット関数
    const formatForecastTime = (isoStr: string): string => {
      if (!isoStr) return '';
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const day = d.getDate();
        const hour = d.getHours();
        
        if (use24HourFormat) {
          return `${day}日${hour}時`;
        } else {
          if (hour === 0) return `${day}日午前0時`;
          if (hour < 12) return `${day}日午前${hour}時`;
          if (hour === 12) return `${day}日午後0時`;
          return `${day}日午後${hour - 12}時`;
        }
      } catch { return isoStr; }
    };

    // 現在位置の時刻ラベル
    const curTimeLabel = formatForecastTime(cur.dateTime);
    const curLabelOffsetKm = 80;
    const curRad = -135 * Math.PI / 180;
    const curDLat = (curLabelOffsetKm / 111) * Math.cos(curRad);
    const curDLon = (curLabelOffsetKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(curRad);
    const curLabelLat = lat + curDLat;
    const curLabelLon = lon + curDLon;

    L.polyline([[lat, lon], [curLabelLat, curLabelLon]], {
      color: '#FF2800', weight: 1.5, opacity: 0.8, dashArray: '2,2'
    }).addTo(map);

    const curLabelIcon = L.divIcon({
      html: `<div style="color:#FF2800;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;white-space:nowrap;font-family:'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);">${curTimeLabel}</div>`,
      className: '',
      iconSize: [0, 0]
    });
    L.marker([curLabelLat, curLabelLon], { icon: curLabelIcon }).addTo(map);

    const getStormCircleForPoint = (fEyeLat: number, fEyeLon: number, radii: any[]) => {
      const c = getTrueCircleFromRadii(fEyeLat, fEyeLon, radii);
      return c ? { lat: c.lat, lon: c.lon, r: c.radius } : { lat: fEyeLat, lon: fEyeLon, r: 0 };
    };

    const curStormRaw = getStormCircleForPoint(lat, lon, cur.stormRadii);
    const stormPointsRaw = [curStormRaw];
    for (const f of forecasts) {
      const p = getStormCircleForPoint(f.lat, f.lon, f.stormRadii);
      stormPointsRaw.push(p);
      if (p.r === 0) break; // 暴風域が0になった時点で先の予報を打ち切る
    }
    
    // 暴風警戒域の赤点線ポリゴン（stormPolygon）は非表示にするよう修正

    
    // 現在の強風域と暴風域（台風の目からの真の円として描画）
    const curGaleCircle = getTrueCircleFromRadii(lat, lon, cur.galeRadii);
    if (curGaleCircle && curGaleCircle.radius > 0) {
      L.circle([curGaleCircle.lat, curGaleCircle.lon], { radius: curGaleCircle.radius * 1000, color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0.15, weight: 1.5, dashArray: '5,5' }).addTo(map);
    }

    const curStormCircle = getTrueCircleFromRadii(lat, lon, cur.stormRadii);
    if (curStormCircle && curStormCircle.radius > 0) {
      L.circle([curStormCircle.lat, curStormCircle.lon], { radius: curStormCircle.radius * 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.2, weight: 2 }).addTo(map);
    }


    // 予報円とマーカー
    forecasts.forEach((fc: any, idx: number) => {
      if (!fc.lat || !fc.lon) return;
      trackPoints.push([fc.lat, fc.lon]);

      if (fc.circleRadiusKm > 0) {
        L.circle([fc.lat, fc.lon], {
          radius: fc.circleRadiusKm * 1000, color: '#555', fillColor: 'transparent', weight: 1.5, dashArray: '6,4'
        }).addTo(map);
      }

      // 黒点（fcIcon）は非表示にするよう修正
      if (fc.circleRadiusKm > 0) {
        L.circle([fc.lat, fc.lon], {
          radius: fc.circleRadiusKm * 1000, color: '#fff', fillColor: '#fff', fillOpacity: 0.1, weight: 1.5, dashArray: '5,5',
        }).addTo(map);
      }

      const timeLabel = formatForecastTime(fc.dateTime);
      const angle = (idx % 2 === 0) ? -45 : 135; 
      const labelOffsetKm = (fc.circleRadiusKm || 50) + 70; 
      const rad = angle * Math.PI / 180;
      const dLat = (labelOffsetKm / 111) * Math.cos(rad);
      const dLon = (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);
      const labelLat = fc.lat + dLat;
      const labelLon = fc.lon + dLon;

      L.polyline([[fc.lat, fc.lon], [labelLat, labelLon]], {
        color: '#666', weight: 1, dashArray: '2,2'
      }).addTo(map);

      const labelIcon = L.divIcon({
        html: `<div style="color:#1e293b;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;white-space:nowrap;font-family:'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);">${timeLabel}</div>`,
        className: '',
        iconSize: [0, 0]
      });
      L.marker([labelLat, labelLon], { icon: labelIcon }).addTo(map);
    });

    // 現在地の黒点/赤点（curIcon）は非表示にするよう修正
    // 軌跡
    L.polyline(trackPoints, { color: '#333', weight: 2 }).addTo(map);

    // マップの表示範囲を調整
    const bounds = L.latLngBounds(trackPoints);
    
    // 現在の強風域・暴風域の最大半径を考慮してバウンズを拡張
    const maxRadius = Math.max(
      ...((cur.galeRadii || []).map((r: any) => r.radiusKm || 0)),
      ...((cur.stormRadii || []).map((r: any) => r.radiusKm || 0))
    );
    if (maxRadius > 0) {
      const dLatBound = maxRadius / 111;
      bounds.extend([lat + dLatBound, lon]);
      bounds.extend([lat - dLatBound, lon]);
      // 経度方向の広がり（緯度による補正）
      const dLonBound = maxRadius / (111 * Math.cos(lat * Math.PI / 180));
      bounds.extend([lat, lon + dLonBound]);
      bounds.extend([lat, lon - dLonBound]);
    }

    // OBSは1920x1080なので広めにパディング、かつ寄りすぎないよう最大ズームを6に制限
    map.fitBounds(bounds, { padding: [150, 150], maxZoom: 6 });

  }, [activeTyphoon, use24HourFormat]);

  if (loading) {
    return <div style={{ color: '#fff', padding: '20px', fontFamily: "'LINE Seed JP', sans-serif" }}>読み込み中...</div>;
  }

  if (!activeTyphoon) {
    return <div style={{ color: '#fff', padding: '20px', fontFamily: "'LINE Seed JP', sans-serif" }}>現在発表されている台風情報はありません。</div>;
  }

  const num = String(activeTyphoon.tcNumber);
  const typhoonNum = num.length >= 2 ? parseInt(num.slice(-2)) : activeTyphoon.tcNumber;
  const cur = activeTyphoon.current || {};
  const dt = new Date(activeTyphoon.updatedAt);

  return (
    <div style={{
      width: '1920px', 
      height: '1080px', 
      position: 'relative', 
      fontFamily: "'LINE Seed JP', sans-serif",
      overflow: 'hidden'
    }}>
      {/* 背景地図 */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
      
      {/* グラデーションオーバーレイ (情報が見やすいように) */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(to right, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.4) 45%, transparent 100%)',
        zIndex: 2,
        pointerEvents: 'none'
      }} />

      <button 
        onClick={() => setUse24HourFormat(!use24HourFormat)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          padding: '8px 16px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          color: '#1e293b',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 600,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
      >
        {use24HourFormat ? '24時間表記' : '午前/午後表記'}
      </button>

      {/* 左側の情報パネル */}
      <div style={{
        position: 'absolute',
        top: '80px',
        left: '80px',
        width: '520px',
        zIndex: 10,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px'
      }}>
        
        {/* 台風タイトル */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.85)',
          borderLeft: '10px solid #3b82f6',
          padding: '30px 40px',
          borderRadius: '0 16px 16px 0',
          boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ fontSize: '28px', color: '#93c5fd', marginBottom: '8px', fontWeight: 700 }}>
            台風<span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900, fontSize: '40px', margin: '0 6px' }}>{typhoonNum}</span>号
            <span style={{ fontSize: '20px', color: '#cbd5e1', marginLeft: '12px' }}>({activeTyphoon.nameEn})</span>
          </div>
          <div style={{ fontSize: '56px', fontWeight: 700, letterSpacing: '2px', lineHeight: 1.1 }}>
            {activeTyphoon.name}
          </div>
          <div style={{ marginTop: '20px', fontSize: '22px', color: '#94a3b8' }}>
            <span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>{dt.getDate()}</span>日
            <span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>{dt.getHours()}</span>時
            <span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>{String(dt.getMinutes()).padStart(2, '0')}</span>分 発表
          </div>
        </div>

        {/* 現在情報 */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.85)',
          padding: '30px 40px',
          borderRadius: '16px',
          boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ fontSize: '26px', fontWeight: 700, borderBottom: '3px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '24px' }}>
            現在の情報 <span style={{ fontSize: '20px', color: '#94a3b8', fontWeight: 400, marginLeft: '8px' }}>({cur.location})</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '24px', alignItems: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '22px' }}>強さ・大きさ</div>
            <div style={{ fontSize: '26px', fontWeight: 700 }}>
              {cur.intensityClass || '—'} {cur.areaClass ? `・${cur.areaClass}` : ''}
            </div>
            
            <div style={{ color: '#94a3b8', fontSize: '22px' }}>中心気圧</div>
            <div style={{ fontSize: '42px', color: '#38bdf8', fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>
              {cur.pressure || '—'}<span style={{ fontSize: '24px', marginLeft: '8px', fontFamily: "'LINE Seed JP', sans-serif", fontWeight: 700 }}>hPa</span>
            </div>

            <div style={{ color: '#94a3b8', fontSize: '22px' }}>最大風速</div>
            <div style={{ fontSize: '42px', color: '#fbbf24', fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>
              {cur.maxWind || '—'}<span style={{ fontSize: '24px', marginLeft: '8px', fontFamily: "'LINE Seed JP', sans-serif", fontWeight: 700 }}>m/s</span>
            </div>
            
            <div style={{ color: '#94a3b8', fontSize: '22px' }}>最大瞬間風速</div>
            <div style={{ fontSize: '42px', color: '#f87171', fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>
              {cur.gustWind || '—'}<span style={{ fontSize: '24px', marginLeft: '8px', fontFamily: "'LINE Seed JP', sans-serif", fontWeight: 700 }}>m/s</span>
            </div>
          </div>
        </div>

      </div>

      {/* 出典表示 (右下) */}
      <div style={{
        position: 'absolute',
        bottom: '60px',
        right: '60px',
        zIndex: 10,
        background: 'rgba(15, 23, 42, 0.85)',
        padding: '16px 32px',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '26px',
        fontWeight: 700,
        backdropFilter: 'blur(8px)',
        border: '2px solid rgba(255,255,255,0.1)',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
      }}>
        出典：気象庁
      </div>

    </div>
  );
}
