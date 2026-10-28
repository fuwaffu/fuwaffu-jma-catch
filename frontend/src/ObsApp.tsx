import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getOuterTangentPolygon,
  getTrueCircleFromRadii,
  drawPastTrack,
  drawStormWarningArea,
  getTyphoonAllTrackPoints,
} from './typhoonMap';

const API_BASE = 'https://jma-dashboard-backend.fuwaffu.workers.dev';
const EXPIRE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default function ObsApp() {
  const [typhoons, setTyphoons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState({ isSyncing: false, progress: 0 });
  const [use24HourFormat, setUse24HourFormat] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    let intervalId: any;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();
        setSyncStatus({ isSyncing: !!data.isSyncing, progress: data.progress || 0 });
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
      try {
        const res = await fetch(`${API_BASE}/api/typhoons`);
        if (res.ok) {
          const data = (await res.json()) as any[];
          // 温帯低気圧や熱帯低気圧で数日（3日）更新が途絶えた台風は除外
          const now = Date.now();
          const activeOnly = data.filter((t: any) => {
            const ts = new Date(t.updatedAt || t.current?.dateTime).getTime();
            return isNaN(ts) || now - ts < EXPIRE_DAYS_MS;
          });
          setTyphoons(activeOnly);
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

  // 一番最新の台風（TC番号が一番大きいもの）を選択
  const activeTyphoon = typhoons.length > 0
    ? [...typhoons].sort((a, b) => b.tcNumber - a.tcNumber)[0]
    : null;

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
    } catch {
      return isoStr;
    }
  };

  useEffect(() => {
    if (!activeTyphoon || !mapRef.current) return;

    const cur = activeTyphoon.current || {};
    const lat = cur.lat;
    const lon = cur.lon;
    if (!lat || !lon) return;

    // 既存のマップインスタンスがあれば一度完全に破棄（DOM再マウント対応・React StrictMode対策）
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: false,
    }).setView([lat, lon], 5);
    mapInstanceRef.current = map;

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16,
      }
    ).addTo(map);

    const forecasts = activeTyphoon.forecasts || [];

    // 1. これまでの進路を線で描画（熱帯低気圧期間は点線、台風期間は実線）
    drawPastTrack(map, activeTyphoon, lat, lon, { color: '#333333', weight: 2.5 });

    // 2. 白色の予報円（Cone of uncertainty）の外枠
    const forecastPoints = [
      { lat, lon, r: 0 },
      ...forecasts.map((f: any) => ({ lat: f.lat, lon: f.lon, r: f.circleRadiusKm || 0 })),
    ];
    const forecastPolygon = getOuterTangentPolygon(forecastPoints);
    if (forecastPolygon.length > 0) {
      L.polygon(forecastPolygon, { color: '#555', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);
    }

    // 3. 暴風警戒域（暴風域表示がなくなった地点で描画を止める。中心へ収束させない）
    drawStormWarningArea(map, activeTyphoon, lat, lon, { color: '#FF2800', weight: 1.5, dashArray: '2,4' });

    // 4. 現在の強風域と暴風域（中心オフセットを反映した真円として描画）
    const curGaleCircle = getTrueCircleFromRadii(lat, lon, cur.galeRadii);
    if (curGaleCircle && curGaleCircle.radius > 0) {
      L.circle([curGaleCircle.lat, curGaleCircle.lon], {
        radius: curGaleCircle.radius * 1000,
        color: '#FFD700',
        fillColor: '#FFD700',
        fillOpacity: 0.18,
        weight: 1.5,
        dashArray: '5,5',
      }).addTo(map);
    }

    const curStormCircle = getTrueCircleFromRadii(lat, lon, cur.stormRadii);
    if (curStormCircle && curStormCircle.radius > 0) {
      L.circle([curStormCircle.lat, curStormCircle.lon], {
        radius: curStormCircle.radius * 1000,
        color: '#FF2800',
        fillColor: '#FF2800',
        fillOpacity: 0.25,
        weight: 2,
      }).addTo(map);
    }

    // 5. 台風の目（現在位置）のマーカー（×印）
    const typhoonIcon = L.divIcon({
      html: '<div style="font-size:24px;text-align:center;line-height:1;color:#FF2800;font-weight:bold;text-shadow:1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;">×</div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      className: '',
    });
    L.marker([lat, lon], { icon: typhoonIcon }).addTo(map);

    // 6. 現在位置の時刻ラベル（引き出し線付き）
    const curTimeLabel = formatForecastTime(cur.dateTime);
    const curLabelOffsetKm = 80;
    const curRad = (-135 * Math.PI) / 180;
    const curDLat = (curLabelOffsetKm / 111) * Math.cos(curRad);
    const curDLon = (curLabelOffsetKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(curRad);
    const curLabelLat = lat + curDLat;
    const curLabelLon = lon + curDLon;

    L.polyline([[lat, lon], [curLabelLat, curLabelLon]], {
      color: '#FF2800',
      weight: 1.5,
      opacity: 0.8,
      dashArray: '2,2',
    }).addTo(map);

    const curLabelIcon = L.divIcon({
      html: `<div style="color:#FF2800;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;white-space:nowrap;font-family:'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);">${curTimeLabel}</div>`,
      className: '',
      iconSize: [0, 0],
    });
    L.marker([curLabelLat, curLabelLon], { icon: curLabelIcon }).addTo(map);

    // 7. 予報進路線（現在位置から予報円の中心を結ぶ線）
    const forecastCenterPoints: [number, number][] = [[lat, lon]];

    // 8. 各予報円と時刻ラベル
    forecasts.forEach((fc: any, idx: number) => {
      if (!fc.lat || !fc.lon) return;
      forecastCenterPoints.push([fc.lat, fc.lon]);

      if (fc.circleRadiusKm > 0) {
        L.circle([fc.lat, fc.lon], {
          radius: fc.circleRadiusKm * 1000,
          color: '#555',
          fillColor: '#fff',
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '6,4',
        }).addTo(map);
      }

      // 予報の暴風域（ある場合のみ点線円）
      const fStormCircle = getTrueCircleFromRadii(fc.lat, fc.lon, fc.stormRadii);
      if (fStormCircle && fStormCircle.radius > 0) {
        L.circle([fStormCircle.lat, fStormCircle.lon], {
          radius: fStormCircle.radius * 1000,
          color: '#FF2800',
          fillColor: 'transparent',
          weight: 1.5,
          dashArray: '2,4',
        }).addTo(map);
      }

      const timeLabel = formatForecastTime(fc.dateTime);
      const angle = idx % 2 === 0 ? -45 : 135;
      const labelOffsetKm = (fc.circleRadiusKm || 50) + 70;
      const rad = (angle * Math.PI) / 180;
      const dLat = (labelOffsetKm / 111) * Math.cos(rad);
      const dLon = (labelOffsetKm / (111 * Math.cos((fc.lat * Math.PI) / 180))) * Math.sin(rad);
      const labelLat = fc.lat + dLat;
      const labelLon = fc.lon + dLon;

      L.polyline([[fc.lat, fc.lon], [labelLat, labelLon]], {
        color: '#666',
        weight: 1,
        dashArray: '2,2',
      }).addTo(map);

      const labelIcon = L.divIcon({
        html: `<div style="color:#1e293b;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;white-space:nowrap;font-family:'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);">${timeLabel}</div>`,
        className: '',
        iconSize: [0, 0],
      });
      L.marker([labelLat, labelLon], { icon: labelIcon }).addTo(map);
    });

    if (forecastCenterPoints.length > 1) {
      L.polyline(forecastCenterPoints, { color: '#333', weight: 2, dashArray: '6,4' }).addTo(map);
    }

    // 9. 過去の進路、現在地、予報円を含む全範囲でフィット
    const allTrackPoints = getTyphoonAllTrackPoints(activeTyphoon, lat, lon);
    const bounds = L.latLngBounds(allTrackPoints.length > 0 ? allTrackPoints : [[lat, lon]]);

    const maxRadius = Math.max(
      ...((cur.galeRadii || []).map((r: any) => r.radiusKm || 0)),
      ...((cur.stormRadii || []).map((r: any) => r.radiusKm || 0))
    );
    if (maxRadius > 0) {
      const dLatBound = maxRadius / 111;
      bounds.extend([lat + dLatBound, lon]);
      bounds.extend([lat - dLatBound, lon]);
      const dLonBound = maxRadius / (111 * Math.cos((lat * Math.PI) / 180));
      bounds.extend([lat, lon + dLonBound]);
      bounds.extend([lat, lon - dLonBound]);
    }

    map.fitBounds(bounds, { padding: [150, 150], maxZoom: 6 });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeTyphoon, use24HourFormat]);

  const num = activeTyphoon ? String(activeTyphoon.tcNumber) : '';
  const typhoonNum = num.length >= 2 ? parseInt(num.slice(-2)) : activeTyphoon?.tcNumber;
  const cur = activeTyphoon?.current || {};
  const dt = activeTyphoon ? new Date(activeTyphoon.updatedAt) : null;

  return (
    <div
      style={{
        width: '1920px',
        height: '1080px',
        position: 'relative',
        fontFamily: "'LINE Seed JP', sans-serif",
        overflow: 'hidden',
        backgroundColor: '#f1f5f9',
      }}
    >
      {/* 背景地図 (常にDOMにマウントしLeafletが安定して動作) */}
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      />

      {loading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 15,
            color: '#fff',
            backgroundColor: 'rgba(15,23,42,0.85)',
            padding: '20px 40px',
            borderRadius: '12px',
            fontSize: '24px',
            fontWeight: 'bold',
          }}
        >
          読み込み中...
        </div>
      )}

      {!loading && !activeTyphoon && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 15,
            color: '#fff',
            backgroundColor: 'rgba(15,23,42,0.85)',
            padding: '24px 48px',
            borderRadius: '12px',
            fontSize: '24px',
            fontWeight: 'bold',
          }}
        >
          現在発表されている台風情報はありません。
        </div>
      )}

      {syncStatus.isSyncing && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 0 15px rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
            fontWeight: 'bold',
          }}
        >
          <i className="fa-solid fa-arrows-rotate fa-spin"></i>
          <span>情報整理中... {syncStatus.progress}%</span>
        </div>
      )}

      {/* グラデーションオーバーレイ */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'linear-gradient(to right, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.4) 45%, transparent 100%)',
          zIndex: 2,
          pointerEvents: 'none',
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
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}
      >
        {use24HourFormat ? '24時間表記' : '午前/午後表記'}
      </button>

      {/* 左側の情報パネル */}
      {activeTyphoon && dt && (
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '80px',
            width: '520px',
            zIndex: 10,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: '40px',
          }}
        >
          {/* 台風タイトル */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.85)',
              borderLeft: '10px solid #3b82f6',
              padding: '30px 40px',
              borderRadius: '0 16px 16px 0',
              boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ fontSize: '28px', color: '#93c5fd', marginBottom: '8px', fontWeight: 700 }}>
              台風
              <span
                style={{
                  fontFamily: "'Lato', sans-serif",
                  fontWeight: 900,
                  fontSize: '40px',
                  margin: '0 6px',
                }}
              >
                {typhoonNum}
              </span>
              号
              <span style={{ fontSize: '20px', color: '#cbd5e1', marginLeft: '12px' }}>
                ({activeTyphoon.nameEn})
              </span>
            </div>
            <div style={{ fontSize: '56px', fontWeight: 700, letterSpacing: '2px', lineHeight: 1.1 }}>
              {activeTyphoon.name}
            </div>
            <div style={{ marginTop: '20px', fontSize: '22px', color: '#94a3b8' }}>
              <span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>{dt.getDate()}</span>日
              <span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>{dt.getHours()}</span>時
              <span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>
                {String(dt.getMinutes()).padStart(2, '0')}
              </span>
              分 発表
            </div>
          </div>

          {/* 現在情報 */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.85)',
              padding: '30px 40px',
              borderRadius: '16px',
              boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              style={{
                fontSize: '26px',
                fontWeight: 700,
                borderBottom: '3px solid rgba(255,255,255,0.1)',
                paddingBottom: '16px',
                marginBottom: '24px',
              }}
            >
              現在の情報{' '}
              <span style={{ fontSize: '20px', color: '#94a3b8', fontWeight: 400, marginLeft: '8px' }}>
                ({cur.location})
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr',
                gap: '24px',
                alignItems: 'center',
              }}
            >
              <div style={{ color: '#94a3b8', fontSize: '22px' }}>強さ・大きさ</div>
              <div style={{ fontSize: '26px', fontWeight: 700 }}>
                {cur.intensityClass || '—'} {cur.areaClass ? `・${cur.areaClass}` : ''}
              </div>

              <div style={{ color: '#94a3b8', fontSize: '22px' }}>中心気圧</div>
              <div
                style={{
                  fontSize: '42px',
                  color: '#38bdf8',
                  fontFamily: "'Lato', sans-serif",
                  fontWeight: 900,
                }}
              >
                {cur.pressure || '—'}
                <span
                  style={{
                    fontSize: '24px',
                    marginLeft: '8px',
                    fontFamily: "'LINE Seed JP', sans-serif",
                    fontWeight: 700,
                  }}
                >
                  hPa
                </span>
              </div>

              <div style={{ color: '#94a3b8', fontSize: '22px' }}>最大風速</div>
              <div
                style={{
                  fontSize: '42px',
                  color: '#fbbf24',
                  fontFamily: "'Lato', sans-serif",
                  fontWeight: 900,
                }}
              >
                {cur.maxWind || '—'}
                <span
                  style={{
                    fontSize: '24px',
                    marginLeft: '8px',
                    fontFamily: "'LINE Seed JP', sans-serif",
                    fontWeight: 700,
                  }}
                >
                  m/s
                </span>
              </div>

              <div style={{ color: '#94a3b8', fontSize: '22px' }}>最大瞬間風速</div>
              <div
                style={{
                  fontSize: '42px',
                  color: '#f87171',
                  fontFamily: "'Lato', sans-serif",
                  fontWeight: 900,
                }}
              >
                {cur.gustWind || '—'}
                <span
                  style={{
                    fontSize: '24px',
                    marginLeft: '8px',
                    fontFamily: "'LINE Seed JP', sans-serif",
                    fontWeight: 700,
                  }}
                >
                  m/s
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 出典表示 (右下) */}
      <div
        style={{
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
        }}
      >
        出典：気象庁
      </div>
    </div>
  );
}
