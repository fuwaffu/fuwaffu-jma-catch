import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = 'https://jma-dashboard-backend.fuwaffu.workers.dev';

export default function App() {
  const [activeTab, setActiveTab] = useState<'warnings' | 'earthquakes' | 'typhoons'>('warnings');
  const [warnings, setWarnings] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [typhoons, setTyphoons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedTyphoon, setSelectedTyphoon] = useState<any | null>(null);

  const [viewMode, setViewMode] = useState<'prefecture' | 'region' | 'municipality'>('prefecture');
  const [selectedParentArea, setSelectedParentArea] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [warningsRes, earthquakesRes, typhoonsRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/warnings`),
        fetch(`${API_BASE}/api/earthquakes`),
        fetch(`${API_BASE}/api/typhoons`),
        fetch(`${API_BASE}/api/status`)
      ]);

      if (!warningsRes.ok || !earthquakesRes.ok || !typhoonsRes.ok) {
        if (warningsRes.status === 500 || earthquakesRes.status === 500) {
          throw new Error('LIMIT_EXCEEDED');
        }
        throw new Error('Failed to fetch one or more APIs');
      }

      setWarnings(await warningsRes.json());
      setEarthquakes(await earthquakesRes.json());
      setTyphoons(await typhoonsRes.json());

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setLastUpdated(statusData.lastUpdated || null);
      }
    } catch (e: any) {
      setError(e.message === 'LIMIT_EXCEEDED' ? 'LIMIT_EXCEEDED' : e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // viewModeに合致するデータだけをフィルタリング
  const filteredWarnings = warnings.filter((w: any) => {
    if (viewMode === 'prefecture') return w.areaType === 'prefecture';
    if (viewMode === 'region') return w.areaType === 'region' || w.areaType === 'subregion';
    if (viewMode === 'municipality') {
      if (selectedParentArea) {
        return w.areaType === 'municipality' && w.prefecture === selectedParentArea;
      }
      return w.areaType === 'municipality';
    }
    return false;
  });

  // 最新の発表日時のデータのみを地域ごとにグループ化
  const groupedWarnings = Object.values(filteredWarnings.reduce((acc: any, w: any) => {
    const areaName = w.region || w.area;
    if (!acc[areaName] || new Date(w.reportDateTime) > new Date(acc[areaName].reportDateTime)) {
      acc[areaName] = { area: areaName, prefecture: w.prefecture, reportDateTime: w.reportDateTime, items: [w] };
    } else if (w.reportDateTime === acc[areaName].reportDateTime) {
      if (!acc[areaName].items.find((i: any) => i.warningName === w.warningName)) {
        acc[areaName].items.push(w);
      }
    }
    return acc;
  }, {})).sort((a: any, b: any) => new Date(b.reportDateTime).getTime() - new Date(a.reportDateTime).getTime());

  // 戻るボタンの処理（画面上）
  const handleBack = () => {
    if (selectedParentArea) {
      setSelectedParentArea(null);
      setViewMode('prefecture');
      // ブラウザの履歴も更新する
      if (window.history.state?.area) {
        window.history.back();
      }
    }
  };

  // 選択領域が変わったときにブラウザ履歴にpushする
  useEffect(() => {
    if (selectedParentArea && window.history.state?.area !== selectedParentArea) {
      window.history.pushState({ area: selectedParentArea }, '');
    }
  }, [selectedParentArea]);

  // ブラウザの戻るボタン（popstate）の検知
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.area) {
        setSelectedParentArea(e.state.area);
        setViewMode('municipality');
      } else {
        setSelectedParentArea(null);
        setViewMode('prefecture');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '16px', backgroundColor: '#f1f5f9', color: '#0f172a' }}>
      <div style={{ maxWidth: '1152px', margin: '0 auto' }}>
        
        <header style={{ 
          background: 'rgba(255, 255, 255, 0.65)', 
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.4)', 
          padding: '24px', borderRadius: '12px', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.05)', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' 
        }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              気象庁 防災情報データベース
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
              Cloudflare KVに蓄積された気象庁の電文データを表示します
              {lastUpdated && (
                <span style={{ marginLeft: '12px', padding: '2px 8px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                  最終更新: {new Date(lastUpdated).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                </span>
              )}
            </p>
          </div>
          <button 
            onClick={fetchData} 
            disabled={loading}
            style={{ padding: '8px 16px', backgroundColor: loading ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}
          >
            <span className={loading ? 'spin-animation' : ''} style={{ display: 'inline-block', marginRight: '4px' }}>🔄</span> 
            {loading ? '更新中...' : '最新データを取得'}
          </button>
        </header>

        {error === 'LIMIT_EXCEEDED' && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'flex-start', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: '#991b1b', fontSize: '1rem', fontWeight: 700 }}>データベースの読み取り上限に達しました</h3>
              <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.875rem' }}>
                Cloudflare D1の無料枠（1日あたりの行読み取り制限）を超過したため、現在データを更新・取得できません。<br />
                日本時間の <strong>翌朝 09:00 (UTC 00:00)</strong> にリセットされるまでお待ちください。
              </p>
            </div>
          </div>
        )}

        <main style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          
          {/* タブ */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
            {[
              { id: 'warnings', label: '気象警報・注意報' },
              { id: 'earthquakes', label: '地震情報' },
              { id: 'typhoons', label: '台風情報' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1, padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.875rem',
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                  backgroundColor: activeTab === tab.id ? '#fff' : 'transparent',
                  color: activeTab === tab.id ? '#1d4ed8' : '#475569',
                  borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div>
            {activeTab === 'warnings' && (
              <div style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {selectedParentArea ? (
                  <>
                    <button 
                      onClick={handleBack}
                      style={{ padding: '4px 12px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                    >
                      ← 都道府県に戻る
                    </button>
                    <span style={{ fontSize: '0.875rem', color: '#475569', backgroundColor: '#e0e7ff', padding: '4px 10px', borderRadius: '4px', fontWeight: 600 }}>
                      {selectedParentArea} の市町村
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>表示単位:</span>
                    <select 
                      value={viewMode} 
                      onChange={(e) => {
                        setViewMode(e.target.value as any);
                        setSelectedParentArea(null);
                      }}
                      style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem', backgroundColor: '#fff', color: '#475569' }}
                    >
                      <option value="prefecture">都道府県（地方・予報区など）</option>
                      <option value="region">地域 (一次細分区域)</option>
                      <option value="municipality">市町村</option>
                    </select>
                  </>
                )}
              </div>
            )}

            {error && error !== 'LIMIT_EXCEEDED' && <div style={{ margin: '16px', padding: '12px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', fontSize: '0.875rem' }}>{error}</div>}
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  {activeTab === 'warnings' && (
                    <tr style={{ color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, width: '25%' }}>発表日時</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, width: '25%' }}>対象地域</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, width: '50%' }}>発表中の警報・注意報</th>
                    </tr>
                  )}
                  {activeTab === 'earthquakes' && (
                    <tr style={{ color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>発生日時</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>震源地</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>マグニチュード</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>最大震度</th>
                    </tr>
                  )}
                  {activeTab === 'typhoons' && !selectedTyphoon && (
                    <tr style={{ color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>台風名</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>強さ / 大きさ</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>中心気圧</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>更新日時</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {activeTab === 'warnings' && (() => {
                    const PREF_CATEGORY_MAP: Record<string, string[]> = {
                      "北海道": ["北海道", "宗谷地方", "上川地方", "留萌地方", "網走地方", "北見地方", "紋別地方", "十勝地方", "釧路地方", "根室地方", "胆振地方", "日高地方", "石狩地方", "空知地方", "後志地方", "渡島地方", "檜山地方"],
                      "東北": ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
                      "関東甲信": ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "山梨県", "長野県"],
                      "北陸": ["新潟県", "富山県", "石川県", "福井県"],
                      "東海": ["岐阜県", "静岡県", "愛知県", "三重県"],
                      "近畿": ["滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
                      "中国 (山口は除く)": ["鳥取県", "島根県", "岡山県", "広島県"],
                      "四国": ["徳島県", "香川県", "愛媛県", "高知県"],
                      "九州北部 (山口を含む)": ["山口県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県"],
                      "九州南部・奄美": ["宮崎県", "鹿児島県", "鹿児島県（奄美地方除く）", "奄美地方"],
                      "沖縄": ["沖縄県", "沖縄本島地方", "大東島地方", "宮古島地方", "八重山地方"]
                    };
                    const CATEGORY_ORDER = [
                      "北海道", "東北", "関東甲信", "北陸", "東海", "近畿",
                      "中国 (山口は除く)", "四国", "九州北部 (山口を含む)", "九州南部・奄美", "沖縄", "その他"
                    ];
                    
                    const getCategory = (pref: string) => {
                      for (const [cat, prefs] of Object.entries(PREF_CATEGORY_MAP)) {
                        if (prefs.includes(pref)) return cat;
                      }
                      return "その他";
                    };

                    const warningsByCategory: Record<string, any[]> = {};
                    groupedWarnings.forEach((row: any) => {
                      const cat = getCategory(row.prefecture || row.area);
                      if (!warningsByCategory[cat]) warningsByCategory[cat] = [];
                      warningsByCategory[cat].push(row);
                    });

                    return CATEGORY_ORDER.map(cat => {
                      if (!warningsByCategory[cat] || warningsByCategory[cat].length === 0) return null;
                      return (
                        <React.Fragment key={cat}>
                          <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>
                            <td colSpan={3} style={{ padding: '8px 16px', fontWeight: 700, color: '#1e293b' }}>{cat}</td>
                          </tr>
                          {Object.entries(
                            warningsByCategory[cat].reduce((acc: any, row: any) => {
                              const p = row.prefecture || row.area;
                              if (!acc[p]) acc[p] = [];
                              acc[p].push(row);
                              return acc;
                            }, {})
                          ).map(([pref, rows]: [string, any]) => (
                            <React.Fragment key={pref}>
                              {(viewMode === 'prefecture' || viewMode === 'region') && pref !== cat && (
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                  <td colSpan={3} style={{ padding: '6px 16px', fontWeight: 600, color: '#475569', fontSize: '0.8rem' }}>
                                    {pref}
                                  </td>
                                </tr>
                              )}
                              {rows.map((row: any, index: number) => (
                                <tr key={row.area || index} className="slide-in-row fade-update" style={{ borderBottom: '1px solid #f1f5f9' }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                >
                              <td style={{ padding: '12px 16px', color: '#64748b', verticalAlign: 'middle' }}>{new Date(row.reportDateTime).toLocaleString()}</td>
                              <td 
                                style={{
                                  padding: '12px 16px', fontWeight: 500, color: '#1e293b', verticalAlign: 'middle',
                                  cursor: (viewMode === 'prefecture' || viewMode === 'region') ? 'pointer' : 'default',
                                  textDecoration: (viewMode === 'prefecture' || viewMode === 'region') ? 'underline' : 'none',
                                  textDecorationColor: '#93c5fd',
                                  textUnderlineOffset: '4px',
                                }}
                                onClick={() => {
                                  if (viewMode === 'prefecture' || viewMode === 'region') {
                                    setSelectedParentArea(row.prefecture || row.area);
                                    setViewMode('municipality');
                                  }
                                }}
                              >
                                {viewMode !== 'prefecture' && row.prefecture ? `${row.prefecture} ${row.area}` : row.area}
                              </td>
                              <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {row.items
                                    .sort((a: any, b: any) => getWarningPriority(a.warningLevel) - getWarningPriority(b.warningLevel))
                                    .map((w: any, idx: number) => {
                                      const displayName = formatWarningName(w.warningName);
                                      return (
                                        <span key={idx} style={{
                                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                                          whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                          ...getWarningColor(w.warningLevel)
                                        }}>
                                          {displayName}
                                        </span>
                                      );
                                    })}
                                </div>
                              </td>
                            </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </React.Fragment>
                        );
                      });
                    })()}
                  {activeTab === 'earthquakes' && [...earthquakes]
                    .sort((a, b) => new Date(b.originTime).getTime() - new Date(a.originTime).getTime())
                    .map((eq, index) => {
                      const formatIntensity = (i: string) => {
                        if (i === '5-') return '5弱';
                        if (i === '5+') return '5強';
                        if (i === '6-') return '6弱';
                        if (i === '6+') return '6強';
                        return String(i).replace(/[+-]/g, '');
                      };
                      const formattedIntensity = formatIntensity(eq.maxIntensity);
                      
                      return (
                      <tr key={eq.xmlId || index} className="slide-in-row fade-update" style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                      >
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(eq.originTime).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1e293b' }}>{eq.hypocenterName}</td>
                        <td style={{ padding: '12px 16px', color: '#1e293b' }}>M{eq.magnitude}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', ...getSeismicIntensityColor(formattedIntensity) }}>
                            震度 {formattedIntensity}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                  {activeTab === 'typhoons' && !selectedTyphoon && typhoons.map((ty, index) => {
                    const num = String(ty.tcNumber);
                    const typhoonNum = num.length >= 2 ? parseInt(num.slice(-2)) : ty.tcNumber;
                    const displayName = `台風${typhoonNum}号（${ty.name}）`;
                    const intensityText = [ty.current?.intensityClass, ty.current?.areaClass].filter(Boolean).join(' / ') || '—';
                    return (
                    <tr key={ty.tcNumber || index} className="slide-in-row fade-update" style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1d4ed8', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#93c5fd', textUnderlineOffset: '4px' }}
                        onClick={() => setSelectedTyphoon(ty)}
                      >{displayName}</td>
                      <td style={{ padding: '12px 16px', color: '#1e293b' }}>{intensityText}</td>
                      <td style={{ padding: '12px 16px', color: '#1e293b' }}>{ty.current?.pressure ? `${ty.current.pressure} hPa` : '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(ty.updatedAt).toLocaleString()}</td>
                    </tr>
                    );
                  })}
                  {activeTab === 'typhoons' && selectedTyphoon && (
                    <tr><td colSpan={4} style={{ padding: 0 }}>
                      <TyphoonDetailView typhoon={selectedTyphoon} onBack={() => setSelectedTyphoon(null)} />
                    </td></tr>
                  )}
                  
                  {!loading && (
                    (activeTab === 'warnings' && warnings.length === 0) ||
                    (activeTab === 'earthquakes' && earthquakes.length === 0) ||
                    (activeTab === 'typhoons' && typhoons.length === 0)
                  ) && (
                    <tr>
                      <td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f8fafc' }}>
                        データがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px', backgroundColor: '#f8fafc' }}>
                  <div style={{ width: '24px', height: '24px', border: '2px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <span style={{ marginLeft: '12px', color: '#94a3b8', fontSize: '0.875rem' }}>読み込み中...</span>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// === 台風詳細ビュー（Leaflet地図＋情報パネル） ===
function TyphoonDetailView({ typhoon, onBack }: { typhoon: any; onBack: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const num = String(typhoon.tcNumber);
  const typhoonNum = num.length >= 2 ? parseInt(num.slice(-2)) : typhoon.tcNumber;
  const displayName = `台風${typhoonNum}号（${typhoon.name}）`;
  const cur = typhoon.current || {};

  // 「○日午前/午後○時」形式のフォーマッター
  function formatForecastTime(isoStr: string): string {
    try {
      const d = new Date(isoStr);
      const day = d.getDate();
      const hour = d.getHours();
      if (hour === 0) return `${day}日午前0時`;
      if (hour < 12) return `${day}日午前${hour}時`;
      if (hour === 12) return `${day}日午後0時`;
      return `${day}日午後${hour - 12}時`;
    } catch { return isoStr; }
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const lat = cur.lat || 30;
    const lon = cur.lon || 135;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([lat, lon], 5);
    mapInstanceRef.current = map;

    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
      maxZoom: 18,
    }).addTo(map);

    // 台風マーカー（現在位置）を「×」印に
    const typhoonIcon = L.divIcon({
      html: '<div style="font-size:24px;text-align:center;line-height:1;color:#FF2800;font-weight:bold;text-shadow:1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;">×</div>',
      iconSize: [24, 24], iconAnchor: [12, 12], className: '',
    });
    L.marker([lat, lon], { icon: typhoonIcon }).addTo(map)
      .bindPopup(`<b>${displayName}</b><br>${cur.location || ''}<br>${cur.pressure}hPa / 最大風速${cur.maxWind}m/s`);

    // 予報円をつなぐ「予報円の接線を結んだ領域（扇形/コーン）」を描画
    const forecasts = typhoon.forecasts || [];
    const trackPoints: [number, number][] = [[lat, lon]];
    
    // 全ポイント（現在地＋予報）を配列に
    const allPoints = [{ lat, lon, r: 0 }, ...forecasts.map((f: any) => ({ lat: f.lat, lon: f.lon, r: f.circleRadiusKm || 0 }))];
    
    if (allPoints.length > 1) {
      const conePointsLeft: [number, number][] = [];
      const conePointsRight: [number, number][] = [];
      
      for (let i = 0; i < allPoints.length; i++) {
        const p = allPoints[i];
        if (!p.lat || !p.lon) continue;
        
        const pNext = allPoints[i + 1];
        const pPrev = allPoints[i - 1];
        
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
        conePointsRight.unshift([rightLat, rightLon]); // 逆順で結合してポリゴンを閉じる
      }
      
      const polygonPoints = [...conePointsLeft, ...conePointsRight];
      L.polygon(polygonPoints, {
        color: '#fff', fillColor: '#fff', fillOpacity: 0.15, weight: 1.5, dashArray: '5,5'
      }).addTo(map);
    }

    // 強風域（黄色半透明）
    if (cur.galeRadii && cur.galeRadii.length > 0) {
      const maxGale = Math.max(...cur.galeRadii.map((r: any) => r.radiusKm || 0));
      if (maxGale > 0) {
        L.circle([lat, lon], { radius: maxGale * 1000, color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0.15, weight: 1.5, dashArray: '5,5' }).addTo(map);
      }
    }

    // 暴風域（赤半透明）
    if (cur.stormRadii && cur.stormRadii.length > 0) {
      const maxStorm = Math.max(...cur.stormRadii.map((r: any) => r.radiusKm || 0));
      if (maxStorm > 0) {
        L.circle([lat, lon], { radius: maxStorm * 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.2, weight: 2 }).addTo(map);
      }
    }

    // 予報進路（点線）と予報円
    forecasts.forEach((fc: any, idx: number) => {
      if (!fc.lat || !fc.lon) return;
      trackPoints.push([fc.lat, fc.lon]);

      // 予報円（白点線）
      if (fc.circleRadiusKm > 0) {
        L.circle([fc.lat, fc.lon], {
          radius: fc.circleRadiusKm * 1000, color: '#fff', fillColor: 'transparent', weight: 1.5, dashArray: '6,4',
        }).addTo(map);
      }

      // 予報円の中心にマーカー
      const fcIcon = L.divIcon({
        html: '<div style="width:8px;height:8px;background:#555;border-radius:50%;border:1px solid #fff;"></div>',
        iconSize: [8, 8], iconAnchor: [4, 4], className: '',
      });
      L.marker([fc.lat, fc.lon], { icon: fcIcon }).addTo(map);

      // 時刻ラベル：円の中心から線を延ばして表示
      const timeLabel = formatForecastTime(fc.dateTime);
      
      // 進行方向（大まかに北東向きが多い）に対して邪魔になりにくい角度を計算
      // 奇数は左上(-45度)、偶数は右下(135度)などに振る
      const angle = (idx % 2 === 0) ? -45 : 135; 
      const labelOffsetKm = (fc.circleRadiusKm || 50) + 70; // 円の外側に配置
      const rad = angle * Math.PI / 180;
      const dLat = (labelOffsetKm / 111) * Math.cos(rad);
      const dLon = (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);
      const labelLat = fc.lat + dLat;
      const labelLon = fc.lon + dLon;

      // 引き出し線
      L.polyline([[fc.lat, fc.lon], [labelLat, labelLon]], {
        color: '#666', weight: 1.5, opacity: 0.8, dashArray: '2,2'
      }).addTo(map);

      // 時刻ラベル (枠の中心が線の終端にくるように調整)
      const labelIcon = L.divIcon({
        html: `<div style="background:rgba(255,255,255,0.92);border:1px solid #999;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#333;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;">${timeLabel}</div>`,
        iconSize: [0, 0], iconAnchor: [0, 0], className: '',
      });
      L.marker([labelLat, labelLon], { icon: labelIcon }).addTo(map);
    });

    // 進路線
    if (trackPoints.length > 1) {
      L.polyline(trackPoints, { color: '#333', weight: 2, dashArray: '8,6', opacity: 0.8 }).addTo(map);
    }

    // 全体が見えるようにフィット
    if (trackPoints.length > 1) {
      map.fitBounds(L.latLngBounds(trackPoints).pad(0.3));
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ padding: '0' }}>
      {/* ヘッダー */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ padding: '6px 14px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>← 一覧に戻る</button>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>🌀 {displayName}</h2>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>更新: {new Date(typhoon.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
      </div>

      {/* 地図 */}
      <div ref={mapRef} style={{ width: '100%', height: '450px', backgroundColor: '#e2e8f0' }} />

      {/* 情報パネル */}
      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <InfoCard label="階級" value={cur.typhoonClass || '—'} />
        <InfoCard label="強さ" value={cur.intensityClass || '—'} />
        <InfoCard label="大きさ" value={cur.areaClass || '—'} />
        <InfoCard label="中心気圧" value={cur.pressure ? `${cur.pressure} hPa` : '—'} />
        <InfoCard label="最大風速" value={cur.maxWind ? `${cur.maxWind} m/s` : '—'} />
        <InfoCard label="最大瞬間風速" value={cur.gustWind ? `${cur.gustWind} m/s` : '—'} />
        <InfoCard label="現在位置" value={cur.location || '—'} />
        <InfoCard label="進行方向" value={cur.direction ? `${cur.direction} ${cur.speedKmh}km/h` : '—'} />
      </div>

      {/* 予報テーブル */}
      {typhoon.forecasts && typhoon.forecasts.length > 0 && (
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 12px 0' }}>進路予報</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead><tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'left', color: '#475569' }}>予報時刻</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'left', color: '#475569' }}>階級</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'left', color: '#475569' }}>気圧</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'left', color: '#475569' }}>最大風速</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'left', color: '#475569' }}>位置</th>
            </tr></thead>
            <tbody>
              {typhoon.forecasts.map((fc: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500 }}>{formatForecastTime(fc.dateTime)}</td>
                  <td style={{ padding: '8px 12px', color: '#475569' }}>{fc.typhoonClass || '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#475569' }}>{fc.pressure ? `${fc.pressure} hPa` : '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#475569' }}>{fc.maxWind ? `${fc.maxWind} m/s` : '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#475569' }}>{fc.location || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

// 警報名の表示フォーマット（全角数字→半角数字変換とスペース挿入）
function formatWarningName(name: string): string {
  const match = name.match(/^レベル([１-５1-5])(.+)$/);
  if (match) {
    const numMap: Record<string, string> = { '１':'1', '２':'2', '３':'3', '４':'4', '５':'5' };
    const halfNum = numMap[match[1]] || match[1];
    return `レベル${halfNum} ${match[2]}`;
  }
  return name;
}

// 警戒レベル表示の優先度（高い方が先に表示）
function getWarningPriority(level: string): number {
  switch (level) {
    case 'level_5': case 'special': return 0;
    case 'level_4': return 1;
    case 'level_3': case 'warning': return 2;
    case 'level_2': case 'advisory': return 3;
    default: return 4;
  }
}

// 警戒レベルに応じた色分け（2026年新基準対応）
function getWarningColor(level: string): React.CSSProperties {
  switch (level) {
    case 'level_5':
    case 'special':
      return { backgroundColor: '#1e003b', color: '#ffffff' }; // レベル5: 黒紫
    case 'level_4':
      return { backgroundColor: '#800080', color: '#ffffff' }; // レベル4: 紫
    case 'level_3':
    case 'warning':
      return { backgroundColor: '#ff2800', color: '#ffffff' }; // レベル3: 赤
    case 'level_2':
    case 'advisory':
      return { backgroundColor: '#f2e700', color: '#333333' }; // レベル2: 黄
    default:
      return { backgroundColor: '#f3f4f6', color: '#333333' };
  }
}

// 気象庁標準カラーに準拠した震度の色付け
function getSeismicIntensityColor(intensity: string): React.CSSProperties {
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

