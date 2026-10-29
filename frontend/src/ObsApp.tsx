import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { drawTyphoon } from './utils/drawTyphoon';
import {
  fetchEarthquakeDetailData,
  formatIntensity,
  getSeismicIntensityColor,
  type EarthquakeItem,
  type IntensityGroup,
  type StationItem,
} from './EarthquakeDetailView';
import { deduplicateEarthquakes } from './utils/earthquakeUtils';
import 'leaflet/dist/leaflet.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://jma-dashboard-backend.fuwaffu.workers.dev';

export default function ObsApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const obsType = urlParams.get('type') === 'earthquake' ? 'earthquake' : 'typhoon';
  const idParam = urlParams.get('id');
  const timeParam = urlParams.get('time');

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  // ponytail: Watch lastUpdated directly instead of legacy sync_queue polling
  useEffect(() => {
    let lastSeen: string | null = null;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.lastUpdated && lastSeen && data.lastUpdated !== lastSeen) {
          window.dispatchEvent(new Event('forceFetchData'));
        }
        if (data.lastUpdated) lastSeen = data.lastUpdated;
      } catch {}
    };
    checkStatus();
    const intervalId = setInterval(checkStatus, 300000);
    return () => clearInterval(intervalId);
  }, []);

  if (obsType === 'earthquake') {
    return <ObsEarthquakeView idParam={idParam} timeParam={timeParam} />;
  }
  return <ObsTyphoonView typhoonIdParam={idParam} />;
}

function ObsEarthquakeView({ idParam, timeParam }: { idParam: string | null; timeParam: string | null }) {
  const [earthquake, setEarthquake] = useState<EarthquakeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [hypoLat, setHypoLat] = useState<number | null>(null);
  const [hypoLon, setHypoLon] = useState<number | null>(null);
  const [depthKm, setDepthKm] = useState<number | string>(0);
  const [stations, setStations] = useState<StationItem[]>([]);
  const [intensityGroups, setIntensityGroups] = useState<IntensityGroup[]>([]);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const fetchEq = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/earthquakes`);
        if (res.ok) {
          const raw = await res.json();
          const list = deduplicateEarthquakes(raw).sort(
            (a, b) => new Date(b.originTime).getTime() - new Date(a.originTime).getTime()
          );
          const matched =
            list.find((eq: any) => idParam && (eq.eventId === idParam || eq.xmlId === idParam)) ||
            list.find((eq: any) => timeParam && eq.originTime === timeParam) ||
            list[0] ||
            null;

          if (matched) {
            setEarthquake(matched);
            if (matched.lat != null) setHypoLat(matched.lat);
            if (matched.lon != null) setHypoLon(matched.lon);
            if (matched.depth != null) setDepthKm(matched.depth);

            const detail = await fetchEarthquakeDetailData(matched);
            if (detail) {
              if (detail.hypoLat != null) setHypoLat(detail.hypoLat);
              if (detail.hypoLon != null) setHypoLon(detail.hypoLon);
              if (detail.depthKm != null) setDepthKm(detail.depthKm);
              setStations(detail.stations);
              setIntensityGroups(detail.intensityGroups);
            }
          }
        }
      } catch (e) {
        console.error('[ObsApp] Failed to fetch earthquake:', e);
      }
      setLoading(false);
    };

    fetchEq();
    const interval = setInterval(fetchEq, 300000);
    window.addEventListener('forceFetchData', fetchEq);
    return () => {
      clearInterval(interval);
      window.removeEventListener('forceFetchData', fetchEq);
    };
  }, [idParam, timeParam]);

  useEffect(() => {
    if (!earthquake || !mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultLat = hypoLat ?? 36.5;
    const defaultLon = hypoLon ?? 138;
    const map = L.map(mapRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: false,
    }).setView([defaultLat, defaultLon], 7);
    mapInstanceRef.current = map;

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
    }).addTo(map);

    const boundsPoints: [number, number][] = [];

    if (hypoLat != null && hypoLon != null) {
      boundsPoints.push([hypoLat, hypoLon]);
      const hypocenterIcon = L.divIcon({
        html: `<div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.45));">
          <svg width="36" height="36" viewBox="0 0 28 28">
            <path d="M 5 5 L 23 23 M 23 5 L 5 23" stroke="#000000" stroke-width="7" stroke-linecap="round" />
            <path d="M 5 5 L 23 23 M 23 5 L 5 23" stroke="#FF2800" stroke-width="3.5" stroke-linecap="round" />
          </svg>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        className: '',
      });
      L.marker([hypoLat, hypoLon], { icon: hypocenterIcon }).addTo(map);
    }

    for (const st of stations) {
      boundsPoints.push([st.lat, st.lon]);
      const colorStyle = getSeismicIntensityColor(st.int);
      const stationIcon = L.divIcon({
        html: `<div style="
          background: ${colorStyle.backgroundColor};
          color: ${colorStyle.color};
          width: 26px; height: 26px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 13px;
          border: 1.5px solid rgba(0,0,0,0.35);
          box-shadow: 0 2px 5px rgba(0,0,0,0.35);
        ">${st.int}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        className: '',
      });
      L.marker([st.lat, st.lon], { icon: stationIcon }).addTo(map);
    }

    if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints).pad(0.22), { maxZoom: 9 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 8);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [earthquake, hypoLat, hypoLon, stations]);

  if (loading) {
    return (
      <div style={{ color: '#fff', padding: '20px', fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif" }}>
        読み込み中...
      </div>
    );
  }

  if (!earthquake) {
    return (
      <div style={{ color: '#fff', padding: '20px', fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif" }}>
        該当する地震情報はありません。
      </div>
    );
  }

  const formattedMaxInt = formatIntensity(earthquake.maxIntensity);
  const maxIntColor = getSeismicIntensityColor(formattedMaxInt);
  const dt = new Date(earthquake.originTime);

  return (
    <div style={{
      width: '1920px',
      height: '1080px',
      position: 'relative',
      fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif",
      overflow: 'hidden',
    }}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
          backgroundColor: '#cbd5e1',
        }}
      />

      {/* 左側の地震情報パネル */}
      <div style={{
        position: 'absolute',
        top: '60px',
        left: '60px',
        width: '560px',
        zIndex: 10,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        transform: 'scale(0.78)',
        transformOrigin: 'top left',
      }}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.88)',
          borderLeft: '10px solid #ef4444',
          padding: '28px 36px',
          borderRadius: '0 16px 16px 0',
          boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '12px' }}>
            <span style={{ fontSize: '28px', color: '#fca5a5', fontWeight: 700 }}>地震情報</span>
            <span style={{
              padding: '6px 18px',
              borderRadius: '8px',
              fontSize: '34px',
              fontWeight: 900,
              ...maxIntColor,
            }}>
              最大震度 {formattedMaxInt}
            </span>
          </div>
          <div style={{ fontSize: '42px', fontWeight: 800, lineHeight: 1.2 }}>
            {earthquake.hypocenterName || '震源調査中'}
          </div>
          <div style={{ marginTop: '14px', fontSize: '22px', color: '#cbd5e1' }}>
            {dt.getMonth() + 1}月{dt.getDate()}日 {String(dt.getHours()).padStart(2, '0')}時{String(dt.getMinutes()).padStart(2, '0')}分頃 発生
          </div>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.88)',
          padding: '28px 36px',
          borderRadius: '16px',
          boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
          display: 'grid',
          gridTemplateColumns: '160px 1fr',
          gap: '20px',
          alignItems: 'center',
        }}>
          <div style={{ color: '#94a3b8', fontSize: '22px' }}>規模 (M)</div>
          <div style={{ fontSize: '40px', color: '#38bdf8', fontWeight: 900 }}>
            {earthquake.magnitude ? `M${earthquake.magnitude}` : '—'}
          </div>

          <div style={{ color: '#94a3b8', fontSize: '22px' }}>震源の深さ</div>
          <div style={{ fontSize: '34px', color: '#fbbf24', fontWeight: 800 }}>
            {depthKm ? `約 ${depthKm} km` : 'ごく浅い'}
          </div>
        </div>

        {intensityGroups.length > 0 && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.88)',
            padding: '24px 32px',
            borderRadius: '16px',
            boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            maxHeight: '520px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}>
            <div style={{ fontSize: '22px', fontWeight: 700, borderBottom: '2px solid rgba(255,255,255,0.12)', paddingBottom: '10px' }}>
              各地の震度
            </div>
            {intensityGroups.slice(0, 4).map(group => {
              const c = getSeismicIntensityColor(group.intensity);
              return (
                <div key={group.intensity} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '20px',
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    ...c,
                  }}>
                    震度{group.intensity}
                  </span>
                  <div style={{ fontSize: '18px', color: '#e2e8f0', lineHeight: 1.45 }}>
                    {group.prefectures.map(p => `${p.prefName}（${p.cities.slice(0, 4).join('、')}${p.cities.length > 4 ? ' ほか' : ''}）`).join(' / ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      }}>
        出典：気象庁
      </div>
    </div>
  );
}

function ObsTyphoonView({ typhoonIdParam }: { typhoonIdParam: string | null }) {
  const [typhoons, setTyphoons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [use24HourFormat, setUse24HourFormat] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/typhoons`);
        if (res.ok) {
          const data = await res.json();
          const now = Date.now();
          const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
          const activeOnly = Array.isArray(data) ? data.filter((t: any) => {
            const up = new Date(t.updatedAt || t.current?.dateTime || 0).getTime();
            return !up || (now - up) < THREE_DAYS_MS;
          }) : [];
          setTyphoons(activeOnly);
        }
      } catch (e) {
        console.error('[ObsApp] Failed to fetch typhoons:', e);
      }
      setLoading(false);
    };
    
    fetchData();
    const interval = setInterval(fetchData, 300000);
    window.addEventListener('forceFetchData', fetchData);
    return () => {
      clearInterval(interval);
      window.removeEventListener('forceFetchData', fetchData);
    };
  }, []);

  // URLのIDに一致する台風を優先、なければ一番最新の台風（TC番号が一番大きいもの）を選択
  const activeTyphoon = typhoons.length > 0 
    ? (typhoonIdParam 
        ? typhoons.find(t => String(t.tcNumber) === typhoonIdParam) || [...typhoons].sort((a, b) => b.tcNumber - a.tcNumber)[0]
        : [...typhoons].sort((a, b) => b.tcNumber - a.tcNumber)[0])
    : null;

  useEffect(() => {
    if (!activeTyphoon || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false
      });
      map.createPane('bgPane');
      map.getPane('bgPane')!.style.zIndex = '200';
      mapInstanceRef.current = map;

      fetch('/world_50m.geojson')
        .then(res => res.json())
        .then(data => {
          if (!mapInstanceRef.current) return;
          const style = { fillColor: '#dcfce7', color: '#166534', weight: 1, fillOpacity: 1 };
          const addGeo = (geo: any) => {
            const layer = L.geoJSON(geo, { style, pane: 'bgPane' });
            (layer as any).isBaseMap = true;
            layer.eachLayer((l: any) => (l.isBaseMap = true));
            layer.addTo(mapInstanceRef.current!);
          };
          addGeo(data);

          // 経度180度（日本の東側）での切れ目を防ぐため+360度シフトしたレイヤーを追加
          const shiftedData = JSON.parse(JSON.stringify(data));
          const shiftCoords = (coords: any[]) => {
            if (typeof coords[0] === 'number') coords[0] += 360;
            else coords.forEach(shiftCoords);
          };
          shiftedData.features.forEach((f: any) => f.geometry && shiftCoords(f.geometry.coordinates));
          addGeo(shiftedData);
        })
        .catch(e => console.error('Failed to load world geojson', e));
    }

    const map = mapInstanceRef.current;
    map.eachLayer((layer: any) => {
      if (!layer.isBaseMap) map.removeLayer(layer);
    });

    const cur = activeTyphoon.current || {};
    if (!cur.lat || !cur.lon) return;

    const trackPoints = drawTyphoon(map, activeTyphoon, { isObs: true, use24HourFormat });

    const bounds = L.latLngBounds(trackPoints);
    const extendBoundsForPoint = (bLat: number, bLon: number, r: number) => {
      const dLatBound = r / 111;
      const dLonBound = r / (111 * Math.cos(bLat * Math.PI / 180));
      bounds.extend([bLat + dLatBound, bLon]);
      bounds.extend([bLat - dLatBound, bLon]);
      bounds.extend([bLat, bLon + dLonBound]);
      bounds.extend([bLat, bLon - dLonBound]);
    };

    if (activeTyphoon.current) {
      const curR = Math.max(...(cur.stormRadii || []).map((r: any) => r.radiusKm), ...(cur.galeRadii || []).map((r: any) => r.radiusKm), 0);
      extendBoundsForPoint(cur.lat || 30, cur.lon || 135, curR);
    }
    if (activeTyphoon.forecasts) {
      activeTyphoon.forecasts.forEach((f: any) => {
        const fR = (f.circleRadiusKm || 0) + Math.max(...(f.stormRadii || []).map((r: any) => r.radiusKm), 0);
        if (f.lat && f.lon) extendBoundsForPoint(f.lat, f.lon, fR);
      });
    }
    
    if (bounds.isValid()) {
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const padLat = (north - south) * 0.08;
      map.fitBounds(L.latLngBounds([south - padLat, bounds.getWest()], [north + padLat, bounds.getEast()]), { padding: [0, 0], maxZoom: 6 });
    }
  }, [activeTyphoon, use24HourFormat]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div style={{ color: '#fff', padding: '20px', fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif" }}>
        読み込み中...
      </div>
    );
  }

  if (!activeTyphoon) {
    return (
      <div style={{ color: '#fff', padding: '20px', fontFamily: "'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif" }}>
        現在発表されている台風情報はありません。
      </div>
    );
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
      <div 
        ref={mapRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          zIndex: 1, 
          backgroundColor: '#87cefa' 
        }} 
      />

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
