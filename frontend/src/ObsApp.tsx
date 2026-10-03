import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { drawTyphoon } from './utils/drawTyphoon';
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

  const urlParams = new URLSearchParams(window.location.search);
  const typhoonIdParam = urlParams.get('id');

  // URLのIDに一致する台風を優先、なければ一番最新の台風（TC番号が一番大きいもの）を選択
  const activeTyphoon = typhoons.length > 0 
    ? (typhoonIdParam 
        ? typhoons.find(t => String(t.tcNumber) === typhoonIdParam) || [...typhoons].sort((a, b) => b.tcNumber - a.tcNumber)[0]
        : [...typhoons].sort((a, b) => b.tcNumber - a.tcNumber)[0])
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

      const targetMap = mapInstanceRef.current;
    if (targetMap) {
      fetch('/world_50m.geojson')
        .then(res => res.json())
        .then(data => {
          const style = { fillColor: '#dcfce7', color: '#166534', weight: 1, fillOpacity: 1 };
          const bgLayer = L.geoJSON(data, { style, pane: 'bgPane' });
          (bgLayer as any).isBaseMap = true;
          bgLayer.eachLayer((l: any) => l.isBaseMap = true);
          bgLayer.addTo(targetMap);

          // ponytail: To prevent the map from cutting off at longitude 180 (right of Japan),
          // we add a second geojson layer shifted by +360 degrees.
          const shiftedData = JSON.parse(JSON.stringify(data));
          shiftedData.features.forEach((f: any) => {
            if (f.geometry) {
              const shiftCoords = (coords: any[]) => {
                if (typeof coords[0] === 'number') {
                  coords[0] += 360;
                } else {
                  coords.forEach(shiftCoords);
                }
              };
              shiftCoords(f.geometry.coordinates);
            }
          });
          const bgLayerRight = L.geoJSON(shiftedData, { style, pane: 'bgPane' });
          (bgLayerRight as any).isBaseMap = true;
          bgLayerRight.eachLayer((l: any) => l.isBaseMap = true);
          bgLayerRight.addTo(targetMap);
        });
    }
    }

    const map = mapInstanceRef.current;
    
    // 既存のレイヤーをクリア（タイルレイヤー以外）
    map.eachLayer((layer: any) => {
      if (!layer.isBaseMap) {
        map.removeLayer(layer);
      }
    });

    const cur = activeTyphoon.current || {};
    const lat = cur.lat;
    const lon = cur.lon;
    if (!lat || !lon) return;

    const trackPoints = drawTyphoon(map, activeTyphoon, { isObs: true, use24HourFormat: true });
    // マップの表示範囲を調整
    const bounds = L.latLngBounds(trackPoints);
    // 予報円と現在位置全体を当たり判定として四角形の範囲(バウンズ)を生成
    const extendBoundsForPoint = (lat: number, lon: number, r: number) => {
      // 半径(km)を緯度経度の度に変換してバウンズを拡張
      const dLatBound = r / 111;
      const dLonBound = r / (111 * Math.cos(lat * Math.PI / 180));
      bounds.extend([lat + dLatBound, lon]);
      bounds.extend([lat - dLatBound, lon]);
      bounds.extend([lat, lon + dLonBound]);
      bounds.extend([lat, lon - dLonBound]);
    };

    if (activeTyphoon.current) {
      const cur = activeTyphoon.current;
      const curR = Math.max(...(cur.stormRadii||[]).map((r: any)=>r.radiusKm), ...(cur.galeRadii||[]).map((r: any)=>r.radiusKm), 0);
      extendBoundsForPoint(cur.lat || 30, cur.lon || 135, curR);
    }
    if (activeTyphoon.forecasts) {
      activeTyphoon.forecasts.forEach((f: any) => {
        const fR = (f.circleRadiusKm || 0) + Math.max(...(f.stormRadii||[]).map((r:any)=>r.radiusKm), 0);
        if (f.lat && f.lon) extendBoundsForPoint(f.lat, f.lon, fR);
      });
    }
    
    // 生成した四角形の上限・下限位置(縦幅)を取り、外側8%を高さの余白として確保
    if (bounds.isValid()) {
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const east = bounds.getEast();
      const west = bounds.getWest();
      
      const dLat = north - south;
      const padLat = dLat * 0.08; // 縦幅の8%
      
      // 横幅についてはそのままか、アスペクト比で自然に決まる
      const newBounds = L.latLngBounds(
        [south - padLat, west],
        [north + padLat, east]
      );
      map.fitBounds(newBounds, { padding: [0, 0], maxZoom: 6 });
    } else {
      map.fitBounds(bounds, { padding: [0, 0], maxZoom: 6 });
    }

  }, [activeTyphoon, use24HourFormat]);

  if (loading) {
    return <div style={{ color: '#fff', padding: '20px', fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif", animation: 'fadeInSlide 0.8s ease-out forwards' }}>読み込み中...</div>;
  }

  if (!activeTyphoon) {
    return <div style={{ color: '#fff', padding: '20px', fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif" }}>現在発表されている台風情報はありません。</div>;
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
      fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif",
      overflow: 'hidden'
    }}>
      {/* 背景地図 */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1, backgroundColor: '#87cefa' }} />
      


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
        gap: '40px',
        transform: 'scale(0.7)',
        transformOrigin: 'top left'
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
          <div style={{ fontSize: '56px', color: '#93c5fd', marginBottom: '8px', fontWeight: 700, lineHeight: 1.1 }}>
            台風<span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900, fontSize: '72px', margin: '0 8px' }}>{typhoonNum}</span>号
            
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '2px' }}>
            {activeTyphoon.name}
            {activeTyphoon.nameEn && <span style={{ fontSize: '20px', color: '#cbd5e1', marginLeft: '12px', fontWeight: 600, letterSpacing: 'normal' }}>({activeTyphoon.nameEn})</span>}
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
              {cur.pressure || '—'}<span style={{ fontSize: '24px', marginLeft: '8px', fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif", fontWeight: 700 }}>hPa</span>
            </div>

            <div style={{ color: '#94a3b8', fontSize: '22px' }}>最大風速</div>
            <div style={{ fontSize: '42px', color: '#fbbf24', fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>
              {cur.maxWind || '—'}<span style={{ fontSize: '24px', marginLeft: '8px', fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif", fontWeight: 700 }}>m/s</span>
            </div>
            
            <div style={{ color: '#94a3b8', fontSize: '22px' }}>最大瞬間風速</div>
            <div style={{ fontSize: '42px', color: '#f87171', fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>
              {cur.gustWind || '—'}<span style={{ fontSize: '24px', marginLeft: '8px', fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif", fontWeight: 700 }}>m/s</span>
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

