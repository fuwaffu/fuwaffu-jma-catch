import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = 'https://jma-dashboard-backend.fuwaffu.workers.dev';

export interface EarthquakeItem {
  xmlId: string;
  eventId?: string;
  originTime: string;
  hypocenterName: string;
  magnitude: string | number;
  maxIntensity: string;
  depth?: number | string;
  lat?: number | null;
  lon?: number | null;
}

// 震度コードの正規化（5- -> 5弱, etc.）
export function formatIntensity(i: string | number | undefined | null): string {
  if (i == null) return '—';
  const s = String(i).trim();
  if (s === '5-') return '5弱';
  if (s === '5+') return '5強';
  if (s === '6-') return '6弱';
  if (s === '6+') return '6強';
  return s.replace(/[+-]/g, '');
}

// 気象庁標準カラーに準拠した震度の色付け
export function getSeismicIntensityColor(intensity: string): React.CSSProperties {
  if (intensity == null) return { backgroundColor: '#e2e8f0', color: '#475569' };
  const i = String(intensity).replace(/[^0-9強弱]/g, '');
  switch (i) {
    case '7': return { backgroundColor: '#B40068', color: '#FFFFFF', border: '1px solid #9c0059' };
    case '6強': return { backgroundColor: '#A50021', color: '#FFFFFF', border: '1px solid #8e001c' };
    case '6弱': return { backgroundColor: '#FF2800', color: '#FFFFFF', border: '1px solid #e02300' };
    case '5強': return { backgroundColor: '#FF9900', color: '#000000', border: '1px solid #e68a00' };
    case '5弱': return { backgroundColor: '#FFD700', color: '#000000', border: '1px solid #d4b200' };
    case '4': return { backgroundColor: '#FAEA00', color: '#000000', border: '1px solid #e5d600' };
    case '3': return { backgroundColor: '#0000FF', color: '#FFFFFF', border: '1px solid #0000e0' };
    case '2': return { backgroundColor: '#00AA00', color: '#FFFFFF', border: '1px solid #009300' };
    case '1': return { backgroundColor: '#F2F2FF', color: '#000000', border: '1px solid #dcdcf2' };
    default: return { backgroundColor: '#e2e8f0', color: '#475569' };
  }
}

// 座標パース ("+32.3+130.5-10000/" -> { lat, lon, depthKm })
export function parseQuakeCoord(coord: any): { lat: number; lon: number; depthKm: number | null } | null {
  const text = typeof coord === 'object' && coord !== null ? coord['#text'] : coord;
  const m = String(text || '').match(/([+-]\d+\.?\d*)([+-]\d+\.?\d*)([+-]\d+\.?\d*)?\//);
  if (!m) return null;
  return {
    lat: parseFloat(m[1]),
    lon: parseFloat(m[2]),
    depthKm: m[3] ? Math.abs(parseFloat(m[3])) / 1000 : null
  };
}

const INTENSITY_ORDER = ['7', '6強', '6弱', '5強', '5弱', '4', '3', '2', '1'];

interface IntensityGroup {
  intensity: string;
  prefectures: {
    prefName: string;
    cities: string[];
  }[];
}

interface StationItem {
  name: string;
  int: string;
  lat: number;
  lon: number;
}

export default function EarthquakeDetailView({
  earthquake,
  onBack,
  onRefresh,
}: {
  earthquake: EarthquakeItem;
  onBack: () => void;
  onRefresh?: () => Promise<void>;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const [loadingDetail, setLoadingDetail] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [hypoLat, setHypoLat] = useState<number | null>(earthquake.lat ?? null);
  const [hypoLon, setHypoLon] = useState<number | null>(earthquake.lon ?? null);
  const [depthKm, setDepthKm] = useState<number | string>(earthquake.depth ?? 0);
  const [stations, setStations] = useState<StationItem[]>([]);
  const [intensityGroups, setIntensityGroups] = useState<IntensityGroup[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // earthquake propが更新されたらローカルstateも同期
  useEffect(() => {
    if (earthquake.lat != null) setHypoLat(earthquake.lat);
    if (earthquake.lon != null) setHypoLon(earthquake.lon);
    if (earthquake.depth != null) setDepthKm(earthquake.depth);
  }, [earthquake.lat, earthquake.lon, earthquake.depth, earthquake.maxIntensity, earthquake.hypocenterName]);

  const formattedMaxInt = formatIntensity(earthquake.maxIntensity);

  // 詳細データの取得（JMA Bosai JSON）
  useEffect(() => {
    let isCancelled = false;
    const fetchDetail = async () => {
      setLoadingDetail(true);
      setDetailError(null);
      try {
        let data: any = null;
        // 1. バックエンドプロキシ経由でJMA JSONを取得（CORSおよびVXSE5k震度情報特定をバックエンドが保証）
        try {
          const params = new URLSearchParams();
          if (earthquake.xmlId) params.set('id', earthquake.xmlId);
          if (earthquake.eventId) params.set('eid', earthquake.eventId);
          if (earthquake.originTime) params.set('time', earthquake.originTime);
          if (earthquake.hypocenterName) params.set('anm', earthquake.hypocenterName);
          params.set('_t', String(Date.now()));

          const res = await fetch(`${API_BASE}/api/earthquake-detail?${params.toString()}`);
          if (res.ok) {
            data = await res.json();
          }
        } catch (e) {
          console.warn('Backend proxy fetch failed, falling back to direct JMA lookup', e);
        }

        // 2. フォールバック: 直接JMA Bosaiから取得
        if (!data) {
          try {
            const listRes = await fetch('https://www.jma.go.jp/bosai/quake/data/list.json');
            if (listRes.ok) {
              const list = (await listRes.json()) as any[];
              const eqTime = new Date(earthquake.originTime).getTime();
              const matchingEntries = list.filter((e: any) => {
                if (earthquake.eventId && (e.eid === earthquake.eventId || e.json?.includes(earthquake.eventId))) return true;
                if (e.at && Math.abs(new Date(e.at).getTime() - eqTime) < 120000) {
                  if (earthquake.hypocenterName && e.anm) {
                    return e.anm.includes(earthquake.hypocenterName) || earthquake.hypocenterName.includes(e.anm);
                  }
                  return true;
                }
                return false;
              });

              const targetEntry = matchingEntries.find((e: any) => e.ttl?.includes('震源・震度') || e.json?.includes('VXSE5k') || e.json?.includes('VXSE53'))
                || matchingEntries.find((e: any) => e.ttl?.includes('震度') || e.json?.includes('VXSE51'))
                || matchingEntries[0];

              if (targetEntry?.json) {
                const jmaRes = await fetch(`https://www.jma.go.jp/bosai/quake/data/${targetEntry.json}`);
                if (jmaRes.ok) data = await jmaRes.json();
              }
            }
          } catch (e) {
            console.error('Direct JMA lookup failed', e);
          }
        }

        if (isCancelled) return;

        if (data) {
          // 震源情報の抽出
          const eqBody = data.Body?.Earthquake || data.Earthquake;
          const coordStr = eqBody?.Hypocenter?.Area?.Coordinate || data.cod;
          if (coordStr) {
            const parsed = parseQuakeCoord(coordStr);
            if (parsed) {
              setHypoLat(parsed.lat);
              setHypoLon(parsed.lon);
              if (parsed.depthKm != null) setDepthKm(parsed.depthKm);
            }
          }

          // 観測地点および市区町村の抽出
          const obs = data.Body?.Intensity?.Observation || data.Intensity?.Observation || data.Observation;
          const obsPrefs = obs?.Pref || obs?.pref || [];
          const byIntensity: Record<string, Record<string, string[]>> = {};
          const stationList: StationItem[] = [];

          const prefArray = Array.isArray(obsPrefs) ? obsPrefs : [obsPrefs].filter(Boolean);
          for (const p of prefArray) {
            const prefName = p.Name || p.name || '';
            const areas = Array.isArray(p.Area) ? p.Area : [p.Area].filter(Boolean);
            for (const a of areas) {
              const cities = Array.isArray(a.City) ? a.City : [a.City].filter(Boolean);
              for (const c of cities) {
                const cInt = formatIntensity(c.MaxInt || c.maxi);
                const cityName = c.Name || c.name || '';

                if (cInt && cInt !== '—') {
                  if (!byIntensity[cInt]) byIntensity[cInt] = {};
                  if (!byIntensity[cInt][prefName]) byIntensity[cInt][prefName] = [];
                  if (!byIntensity[cInt][prefName].includes(cityName)) {
                    byIntensity[cInt][prefName].push(cityName);
                  }
                }

                // 観測点（地図描画用）
                const stList = Array.isArray(c.IntensityStation) ? c.IntensityStation : [c.IntensityStation].filter(Boolean);
                for (const st of stList) {
                  const latlon = st.latlon;
                  if (latlon && typeof latlon.lat === 'number' && typeof latlon.lon === 'number') {
                    stationList.push({
                      name: st.Name || st.name || cityName,
                      int: formatIntensity(st.Int || st.int || c.MaxInt),
                      lat: latlon.lat,
                      lon: latlon.lon
                    });
                  }
                }
              }
            }
          }

          setStations(stationList);

          // 震度順にソートしてグループ化
          const sortedGroups: IntensityGroup[] = [];
          for (const intVal of INTENSITY_ORDER) {
            if (byIntensity[intVal]) {
              const prefMap = byIntensity[intVal];
              const prefs = Object.keys(prefMap).map(prefName => ({
                prefName,
                cities: prefMap[prefName]
              }));
              if (prefs.length > 0) {
                sortedGroups.push({ intensity: intVal, prefectures: prefs });
              }
            }
          }
          setIntensityGroups(sortedGroups);
        } else {
          setDetailError('詳細な震度・観測点データは取得できませんでした。概要情報を表示しています。');
        }
      } catch (err: any) {
        if (!isCancelled) {
          setDetailError('詳細データの取得中にエラーが発生しました。');
        }
      } finally {
        if (!isCancelled) setLoadingDetail(false);
      }
    };

    fetchDetail();
    return () => {
      isCancelled = true;
    };
  }, [earthquake, refreshKey]);

  // 個別の地震情報の更新処理
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshSuccess(false);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      setRefreshKey(k => k + 1);
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to refresh earthquake detail', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Leaflet 地図の描画
  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultLat = hypoLat ?? 36.5;
    const defaultLon = hypoLon ?? 138;
    const defaultZoom = hypoLat && hypoLon ? 8 : 5;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([defaultLat, defaultLon], defaultZoom);
    mapInstanceRef.current = map;

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16
    }).addTo(map);

    const boundsPoints: [number, number][] = [];

    // 1. 震源地マーカー（✕印）
    if (hypoLat != null && hypoLon != null) {
      boundsPoints.push([hypoLat, hypoLon]);
      const hypocenterIcon = L.divIcon({
        html: `<div style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <svg width="28" height="28" viewBox="0 0 28 28">
            <path d="M 5 5 L 23 23 M 23 5 L 5 23" stroke="#000000" stroke-width="7" stroke-linecap="round" />
            <path d="M 5 5 L 23 23 M 23 5 L 5 23" stroke="#FF2800" stroke-width="3" stroke-linecap="round" />
          </svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: ''
      });

      L.marker([hypoLat, hypoLon], { icon: hypocenterIcon }).addTo(map)
        .bindPopup(`
          <div style="font-family:'LINE Seed JP',sans-serif;font-size:13px;line-height:1.5;">
            <b style="color:#dc2626;font-size:14px;">震源地: ${earthquake.hypocenterName}</b><br/>
            規模: M${earthquake.magnitude || '—'}<br/>
            深さ: ${depthKm ? `約${depthKm}km` : 'ごく浅い'}<br/>
            最大震度: 震度${formattedMaxInt}
          </div>
        `, { autoPan: true });
    }

    // 2. 震度観測点マーカー
    for (const st of stations) {
      boundsPoints.push([st.lat, st.lon]);
      const colorStyle = getSeismicIntensityColor(st.int);
      const stationIcon = L.divIcon({
        html: `<div style="
          background: ${colorStyle.backgroundColor};
          color: ${colorStyle.color};
          width: 22px; height: 22px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 11px;
          border: 1.5px solid rgba(0,0,0,0.3);
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        ">${st.int}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        className: ''
      });

      L.marker([st.lat, st.lon], { icon: stationIcon }).addTo(map)
        .bindPopup(`
          <div style="font-family:'LINE Seed JP',sans-serif;font-size:12px;">
            <b>${st.name}</b><br/>
            観測震度: <span style="font-weight:700;color:#dc2626;">震度${st.int}</span>
          </div>
        `);
    }

    // 全観測点と震源地を包含するようにズーム
    if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints).pad(0.15), { maxZoom: 10 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 8);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hypoLat, hypoLon, stations, formattedMaxInt, depthKm, earthquake.hypocenterName, earthquake.magnitude]);

  return (
    <div style={{ padding: 0 }}>
      {/* ヘッダー */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={onBack}
            style={{
              padding: '6px 14px',
              backgroundColor: '#e2e8f0',
              color: '#334155',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            ← 一覧に戻る
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: '6px 14px',
              backgroundColor: refreshing ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              transition: 'background-color 0.15s ease'
            }}
            title="最新の震度情報・続報を再取得します"
          >
            <i className={`fa-solid fa-arrows-rotate${refreshing ? ' fa-spin' : ''}`} style={{ marginRight: '6px' }}></i>
            {refreshing ? '更新中...' : '最新情報に更新'}
          </button>

          {refreshSuccess && (
            <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600, animation: 'fadeIn 0.2s ease-in' }}>
              ✓ 最新情報を取得しました
            </span>
          )}

          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
            🌍 {earthquake.hypocenterName} を震源とする地震
          </h2>
        </div>
        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
          発生日時: {new Date(earthquake.originTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
        </span>
      </div>

      {/* サマリーカード */}
      <div style={{
        padding: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        backgroundColor: '#ffffff'
      }}>
        <InfoCard
          label="最大震度"
          value={`震度 ${formattedMaxInt}`}
          badgeStyle={getSeismicIntensityColor(formattedMaxInt)}
        />
        <InfoCard label="震源地" value={earthquake.hypocenterName || '—'} />
        <InfoCard label="規模 (マグニチュード)" value={earthquake.magnitude ? `M${earthquake.magnitude}` : '—'} />
        <InfoCard
          label="震源の深さ"
          value={depthKm ? `約 ${depthKm} km` : (hypoLat ? 'ごく浅い' : '—')}
        />
        <InfoCard
          label="緯度・経度"
          value={hypoLat && hypoLon ? `北緯${hypoLat.toFixed(1)}° / 東経${hypoLon.toFixed(1)}°` : '—'}
        />
      </div>

      {/* 震源地と震度マップ */}
      <div style={{ position: 'relative', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 1000,
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(8px)',
          padding: '6px 12px',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: '#1e293b',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
        }}>
          🗺️ 震源地と各地の観測震度
        </div>

        {/* 凡例 */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          zIndex: 1000,
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(8px)',
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          fontSize: '0.75rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontWeight: 600, color: '#475569' }}>凡例:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#dc2626', borderRadius: '50%', textAlign: 'center', color: '#fff', fontSize: '9px', lineHeight: '12px', fontWeight: 900 }}>✕</span> 震源
          </span>
          {['7', '6強', '6弱', '5強', '5弱', '4', '3', '2', '1'].map(iv => {
            const c = getSeismicIntensityColor(iv);
            return (
              <span key={iv} style={{
                padding: '1px 5px',
                borderRadius: '3px',
                fontWeight: 700,
                fontSize: '0.7rem',
                backgroundColor: c.backgroundColor,
                color: c.color,
                border: c.border
              }}>
                {iv}
              </span>
            );
          })}
        </div>

        <div ref={mapRef} style={{ width: '100%', height: '460px', backgroundColor: '#e2e8f0' }} />
      </div>

      {/* 震度ごとの市区町村表示 */}
      <div style={{ padding: '24px 20px', backgroundColor: '#ffffff' }}>
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          color: '#1e293b',
          margin: '0 0 16px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🏛️ 各地の震度（市区町村別）</span>
          {loadingDetail && (
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}>
              (観測データを読み込み中...)
            </span>
          )}
        </h3>

        {detailError && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            color: '#64748b',
            fontSize: '0.85rem',
            marginBottom: '16px'
          }}>
            {detailError}
          </div>
        )}

        {intensityGroups.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {intensityGroups.map(group => {
              const colorStyle = getSeismicIntensityColor(group.intensity);
              return (
                <div
                  key={group.intensity}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  {/* 震度見出し */}
                  <div style={{
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      backgroundColor: colorStyle.backgroundColor,
                      color: colorStyle.color,
                      border: colorStyle.border,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      震度 {group.intensity}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                      以下の地域で震度{group.intensity}が観測されました
                    </span>
                  </div>

                  {/* 市区町村リスト */}
                  <div style={{ padding: '16px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {group.prefectures.map(pref => (
                      <div key={pref.prefName} style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{
                          fontWeight: 700,
                          color: '#1e293b',
                          fontSize: '0.875rem',
                          minWidth: '90px',
                          paddingTop: '2px'
                        }}>
                          【{pref.prefName}】
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                          {pref.cities.map(city => (
                            <span
                              key={city}
                              style={{
                                padding: '3px 8px',
                                backgroundColor: '#f1f5f9',
                                color: '#334155',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                border: '1px solid #e2e8f0'
                              }}
                            >
                              {city}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !loadingDetail && (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              fontSize: '0.875rem'
            }}>
              震度情報が取得できませんでした（海外地震や速報値のため詳細情報がない場合があります）。
            </div>
          )
        )}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  badgeStyle
}: {
  label: string;
  value: string;
  badgeStyle?: React.CSSProperties;
}) {
  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
        {label}
      </div>
      {badgeStyle ? (
        <span style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '4px',
          fontSize: '1rem',
          fontWeight: 800,
          ...badgeStyle
        }}>
          {value}
        </span>
      ) : (
        <div style={{ fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
          {value}
        </div>
      )}
    </div>
  );
}
