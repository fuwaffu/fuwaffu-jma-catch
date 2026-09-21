import { useEffect, useState, useRef } from 'react';
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

    // 赤色の暴風警戒域（扇形外枠のみ、暴風域が消えるまでの点だけで構成）
    const getStormR = (radii: any[]) => radii && radii.length > 0 ? Math.max(...radii.map(r => r.radiusKm || 0)) : 0;
    
    // 現在の暴風域の中心位置（指定がなければ台風の目）
    const curStormCenterLat = cur.stormCenterLat || lat;
    const curStormCenterLon = cur.stormCenterLon || lon;
    const curStormR = getStormR(cur.stormRadii);
    
    const stormPointsRaw = [{ lat: curStormCenterLat, lon: curStormCenterLon, r: curStormR }];
    for (const f of forecasts) {
      const sr = getStormR(f.stormRadii);
      const slat = f.stormCenterLat || f.lat;
      const slon = f.stormCenterLon || f.lon;
      stormPointsRaw.push({ lat: slat, lon: slon, r: sr });
      if (sr === 0) break; // 暴風域が0になった時点で先の予報を打ち切る
    }
    
    if (stormPointsRaw.some(p => p.r > 0)) {
      const stormPolygon = getOuterTangentPolygon(stormPointsRaw);
      if (stormPolygon.length > 0) {
        L.polygon(stormPolygon, { color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '2,4' }).addTo(map);
      }
    }

    // 現在の強風域と暴風域（円で描画）
    const getRadiiMax = (radii: any[]) => radii && radii.length > 0 ? Math.max(...radii.map(r => r.radiusKm || 0)) : 0;
    
    const curGaleLat = cur.galeCenterLat || lat;
    const curGaleLon = cur.galeCenterLon || lon;
    const curGaleMax = getRadiiMax(cur.galeRadii);
    if (curGaleMax > 0) {
      L.circle([curGaleLat, curGaleLon], { radius: curGaleMax * 1000, color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0.15, weight: 1.5, dashArray: '5,5' }).addTo(map);
    }

    const curStormLat = cur.stormCenterLat || lat;
    const curStormLon = cur.stormCenterLon || lon;
    const curStormMax = getRadiiMax(cur.stormRadii);
    if (curStormMax > 0) {
      L.circle([curStormLat, curStormLon], { radius: curStormMax * 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.2, weight: 2 }).addTo(map);
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
          radius: fc.circleRadiusKm * 1000, color: '#555', fillColor: 'transparent', weight: 1.5, dashArray: '6,4',
        }).addTo(map);
      }

      const fcIcon = L.divIcon({
        html: '<div style="width:8px;height:8px;background:#333;border-radius:50%;border:1px solid #999;"></div>',
        iconSize: [8, 8], iconAnchor: [4, 4], className: '',
      });
      L.marker([fc.lat, fc.lon], { icon: fcIcon }).addTo(map);

      // 予報の強風域と暴風域（円で描画）
      const fGaleLat = fc.galeCenterLat || fc.lat;
      const fGaleLon = fc.galeCenterLon || fc.lon;
      const fGaleMax = getRadiiMax(fc.galeRadii);
      if (fGaleMax > 0) {
        L.circle([fGaleLat, fGaleLon], { radius: fGaleMax * 1000, color: '#FFD700', fillColor: 'transparent', weight: 1.2, dashArray: '4,4' }).addTo(map);
      }

      const fStormLat = fc.stormCenterLat || fc.lat;
      const fStormLon = fc.stormCenterLon || fc.lon;
      const fStormMax = getRadiiMax(fc.stormRadii);
      if (fStormMax > 0) {
        L.circle([fStormLat, fStormLon], { radius: fStormMax * 1000, color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '2,4' }).addTo(map);
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

    // 現在地のアイコン
    const curIcon = L.divIcon({
      html: '<div style="width:14px;height:14px;background:#ef4444;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4);"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7], className: '',
    });
    L.marker([lat, lon], { icon: curIcon, zIndexOffset: 1000 }).addTo(map);

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
