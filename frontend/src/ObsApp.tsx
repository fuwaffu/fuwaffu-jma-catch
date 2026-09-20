import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = 'https://jma-dashboard-backend.fuwaffu.workers.dev';

export default function ObsApp() {
  const [typhoons, setTyphoons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    // OBSモードでは背景透過にする
    document.body.style.backgroundColor = 'transparent';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/typhoons`);
        if (res.ok) {
          const data = await res.json();
          setTyphoons(data);
        }
      } catch (e) {
        console.error('Failed to fetch typhoons', e);
      }
      setLoading(false);
    };
    
    fetchData();
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, []);

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

      L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
        maxZoom: 14,
        className: 'gsi-blank-dark'
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

    // ポリゴン生成ヘルパー
    const getPolygonPoints = (points: { lat: number, lon: number, r: number }[]) => {
      if (points.length <= 1) return [];
      const conePointsLeft: [number, number][] = [];
      const conePointsRight: [number, number][] = [];
      
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (!p.lat || !p.lon) continue;
        
        const pNext = points[i + 1];
        const pPrev = points[i - 1];
        
        let dx1 = 0, dy1 = 0, dx2 = 0, dy2 = 0;
        
        if (pNext) {
          dx1 = (pNext.lon - p.lon) * Math.cos(p.lat * Math.PI / 180);
          dy1 = pNext.lat - p.lat;
        }
        if (pPrev) {
          dx2 = (p.lon - pPrev.lon) * Math.cos(p.lat * Math.PI / 180);
          dy2 = p.lat - pPrev.lat;
        }
        
        let dx = (dx1 + dx2) / 2;
        let dy = (dy1 + dy2) / 2;
        if (!pPrev) { dx = dx1; dy = dy1; }
        if (!pNext) { dx = dx2; dy = dy2; }
        
        let theta = Math.atan2(dy, dx);
        
        let thetaLeft = theta + Math.PI / 2;
        let thetaRight = theta - Math.PI / 2;
        
        let leftLat = p.lat + (p.r * Math.sin(thetaLeft) / 111);
        let leftLon = p.lon + (p.r * Math.cos(thetaLeft) / (111 * Math.cos(p.lat * Math.PI / 180)));
        
        let rightLat = p.lat + (p.r * Math.sin(thetaRight) / 111);
        let rightLon = p.lon + (p.r * Math.cos(thetaRight) / (111 * Math.cos(p.lat * Math.PI / 180)));
        
        conePointsLeft.push([leftLat, leftLon]);
        conePointsRight.unshift([rightLat, rightLon]);
      }
      return [...conePointsLeft, ...conePointsRight];
    };

    // 白色の予報円
    const forecastPoints = [{ lat, lon, r: 0 }, ...forecasts.map((f: any) => ({ lat: f.lat, lon: f.lon, r: f.circleRadiusKm || 0 }))];
    const forecastPolygon = getPolygonPoints(forecastPoints);
    if (forecastPolygon.length > 0) {
      L.polygon(forecastPolygon, { color: '#fff', fillColor: '#fff', fillOpacity: 0.15, weight: 1.5, dashArray: '5,5' }).addTo(map);
    }

    // 赤色の暴風警戒域
    const getStormR = (radii: any[]) => radii && radii.length > 0 ? Math.max(...radii.map(r => r.radiusKm || 0)) : 0;
    const curStormR = getStormR(cur.stormRadii);
    const stormPointsRaw = [{ lat, lon, r: curStormR }, ...forecasts.map((f: any) => ({ lat: f.lat, lon: f.lon, r: getStormR(f.stormRadii) }))];
    
    if (stormPointsRaw.some(p => p.r > 0)) {
      const validStormPoints = [];
      for (const p of stormPointsRaw) {
        validStormPoints.push(p);
        if (p.r === 0) break; 
      }
      const stormPolygon = getPolygonPoints(validStormPoints);
      if (stormPolygon.length > 0) {
        L.polygon(stormPolygon, { color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '2,4' }).addTo(map);
      }
    }

    // 現在の強風域と暴風域
    if (cur.galeRadii && cur.galeRadii.length > 0) {
      const maxGale = Math.max(...cur.galeRadii.map((r: any) => r.radiusKm || 0));
      if (maxGale > 0) {
        L.circle([lat, lon], { radius: maxGale * 1000, color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0.15, weight: 1.5, dashArray: '5,5' }).addTo(map);
      }
    }

    if (cur.stormRadii && cur.stormRadii.length > 0) {
      const maxStorm = Math.max(...cur.stormRadii.map((r: any) => r.radiusKm || 0));
      if (maxStorm > 0) {
        L.circle([lat, lon], { radius: maxStorm * 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.2, weight: 2 }).addTo(map);
      }
    }

    // 予報円とマーカー
    const formatForecastTime = (dtStr: string) => {
      const d = new Date(dtStr);
      return `${d.getDate()}日${d.getHours()}時`;
    };

    forecasts.forEach((fc: any, idx: number) => {
      if (!fc.lat || !fc.lon) return;
      trackPoints.push([fc.lat, fc.lon]);

      if (fc.circleRadiusKm > 0) {
        L.circle([fc.lat, fc.lon], {
          radius: fc.circleRadiusKm * 1000, color: '#fff', fillColor: 'transparent', weight: 1.5, dashArray: '6,4',
        }).addTo(map);
      }

      const fcIcon = L.divIcon({
        html: '<div style="width:8px;height:8px;background:#555;border-radius:50%;border:1px solid #fff;"></div>',
        iconSize: [8, 8], iconAnchor: [4, 4], className: '',
      });
      L.marker([fc.lat, fc.lon], { icon: fcIcon }).addTo(map);

      // 予報の強風域と暴風域
      if (fc.galeRadii && fc.galeRadii.length > 0) {
        const maxGale = Math.max(...fc.galeRadii.map((r: any) => r.radiusKm || 0));
        if (maxGale > 0) {
          L.circle([fc.lat, fc.lon], { radius: maxGale * 1000, color: '#FFD700', fillColor: 'transparent', weight: 1.2, dashArray: '4,4' }).addTo(map);
        }
      }

      if (fc.stormRadii && fc.stormRadii.length > 0) {
        const maxStorm = Math.max(...fc.stormRadii.map((r: any) => r.radiusKm || 0));
        if (maxStorm > 0) {
          L.circle([fc.lat, fc.lon], { radius: maxStorm * 1000, color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '2,4' }).addTo(map);
        }
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
        color: '#fff', weight: 1, dashArray: '2,2'
      }).addTo(map);

      const labelIcon = L.divIcon({
        html: `<div style="color:#fff;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #000,-1px -1px 2px #000,1px -1px 2px #000,-1px 1px 2px #000;white-space:nowrap;font-family:'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);">${timeLabel}</div>`,
        className: '',
        iconSize: [0, 0]
      });
      L.marker([labelLat, labelLon], { icon: labelIcon }).addTo(map);
    });

    // 現在地のアイコン
    const curIcon = L.divIcon({
      html: '<div style="width:14px;height:14px;background:#ef4444;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(0,0,0,0.5);"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7], className: '',
    });
    L.marker([lat, lon], { icon: curIcon, zIndexOffset: 1000 }).addTo(map);

    // 軌跡
    L.polyline(trackPoints, { color: '#fff', weight: 2 }).addTo(map);

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

    // OBSは1920x1080なので広めにパディング
    map.fitBounds(bounds, { padding: [150, 150] });

  }, [activeTyphoon]);

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
