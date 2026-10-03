import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildHierarchy, sortedPrefCodes, areaName, type AreaNode } from './areaHierarchy';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://jma-dashboard-backend.fuwaffu.workers.dev';

export default function App() {
  const [activeTab, setActiveTab] = useState<'warnings' | 'earthquakes' | 'typhoons'>('warnings');
  const [warnings, setWarnings] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [typhoons, setTyphoons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedTyphoon, setSelectedTyphoon] = useState<any | null>(null);

  // 表示階層: class10=全国(一次細分一覧) / class15=一次細分内の二次細分一覧 / municipality=二次細分内の市町村一覧
  const [viewMode, setViewMode] = useState<'class10' | 'class15' | 'municipality'>('class10');
  const [selectedClass10, setSelectedClass10] = useState<string | null>(null); // 一次細分区域コード
  const [selectedClass15, setSelectedClass15] = useState<string | null>(null); // 二次細分区域コード
  
  const [use24HourFormat, setUse24HourFormat] = useState(true);

  const fetchData = async (bustCache = false) => {
    setLoading(true);
    setError('');
    console.log(`[App] Starting data fetch. bustCache=${bustCache}`);
    try {
      if (bustCache) {
        console.log("[App] Triggering /api/sync-initial...");
        await fetch(`${API_BASE}/api/sync-initial`);
      }
      const cacheBuster = bustCache ? `?_t=${Date.now()}` : '';
      console.log(`[App] Fetching API endpoints with cacheBuster: "${cacheBuster}"`);
      const [warningsRes, earthquakesRes, typhoonsRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/warnings${cacheBuster}`),
        fetch(`${API_BASE}/api/earthquakes${cacheBuster}`),
        fetch(`${API_BASE}/api/typhoons${cacheBuster}`),
        fetch(`${API_BASE}/api/status${cacheBuster}`)
      ]);

      console.log(`[App] Responses status - Warnings: ${warningsRes.status}, Earthquakes: ${earthquakesRes.status}, Typhoons: ${typhoonsRes.status}, Status: ${statusRes.status}`);

      if (!warningsRes.ok || !earthquakesRes.ok || !typhoonsRes.ok) {
        if (warningsRes.status === 500 || earthquakesRes.status === 500) {
          console.error("[App] KV Limit Exceeded detected (500 status)");
          throw new Error('LIMIT_EXCEEDED');
        }
        throw new Error(`Failed to fetch APIs. W:${warningsRes.status}, E:${earthquakesRes.status}, T:${typhoonsRes.status}`);
      }

      const warningsData = await warningsRes.json();
      const earthquakesData = await earthquakesRes.json();
      const typhoonsData = await typhoonsRes.json();

      console.log(`[App] Loaded Warnings: ${warningsData?.length} items`, warningsData);
      console.log(`[App] Loaded Earthquakes: ${earthquakesData?.length} items`, earthquakesData);
      console.log(`[App] Loaded Typhoons: ${typhoonsData?.length} items`, typhoonsData);

      setWarnings(warningsData);
      setEarthquakes(earthquakesData);
      setTyphoons(typhoonsData);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        console.log("[App] Loaded Status:", statusData);
        setLastUpdated(statusData.lastUpdated || null);
      } else {
        console.warn("[App] Status API failed:", statusRes.status);
      }
    } catch (e: any) {
      console.error("[App] Catch Error in fetchData:", e);
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

  const prevIsSyncing = useRef(false);

  useEffect(() => {
    let timeoutId: any;
    let isProcessing = false;
    let consecutiveErrors = 0;

    const checkStatus = async () => {
      if (isProcessing) return;
      isProcessing = true;
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();
        
        const currentlySyncing = !!data.isSyncing;
        
        if (currentlySyncing) {
            console.log(`[Sync Status] isSyncing: true, progress: ${data.progress}% (target: ${data.target || '?'}, current: ${data.current || '?'})`);
            // Render.comバックエンドが同期を完了するまで待つ
        } else if (prevIsSyncing.current) {
            // 同期中だったのが完了に変わった場合、データを再取得
            console.log('[Sync Status] Sync complete, fetching new data...');
            fetchData();
        }
        
        prevIsSyncing.current = currentlySyncing;
      } catch (e) {
        console.error('[Sync Status Error]', e);
        consecutiveErrors++;
      } finally {
        isProcessing = false;
        // 連続エラーが多い場合はインターバルを伸ばす
        const nextPoll = consecutiveErrors > 0 ? Math.min(10000, 3000 * consecutiveErrors) : 3000;
        timeoutId = setTimeout(checkStatus, nextPoll);
      }
    };
    checkStatus();
    return () => clearTimeout(timeoutId);
  }, []);

  
  // 市町村単位の警報を区域コードで解決し、二次細分・一次細分・府県予報区へ集約
  const hierarchy = React.useMemo(() => {
    const h = buildHierarchy(warnings);
    if (h.unresolved.length > 0) console.warn(`[App] 区域を特定できなかった警報: ${h.unresolved.length}件`, h.unresolved);
    return h;
  }, [warnings]);

  // 画面遷移（ブラウザの戻る/進むにも対応）
  const navigate = (mode: 'class10' | 'class15' | 'municipality', c10: string | null, c15: string | null, push = true) => {
    setViewMode(mode);
    setSelectedClass10(c10);
    setSelectedClass15(c15);
    if (push) window.history.pushState({ mode, class10: c10, class15: c15 }, '');
  };

  const handleBack = () => {
    if (viewMode === 'municipality') navigate('class15', selectedClass10, null);
    else if (viewMode === 'class15') navigate('class10', null, null);
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.mode) navigate(e.state.mode, e.state.class10, e.state.class15, false);
      else navigate('class10', null, null, false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '16px', backgroundColor: '#f1f5f9', color: '#0f172a' }}>
      <div style={{ maxWidth: '1152px', margin: '0 auto', position: 'relative' }}>
        
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
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={() => setUse24HourFormat(!use24HourFormat)}
              style={{ padding: '8px 16px', backgroundColor: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              {use24HourFormat ? '24時間表記' : '午前/午後表記'}
            </button>
            <button 
              onClick={() => fetchData(true)} 
              disabled={loading}
              style={{ padding: '8px 16px', backgroundColor: loading ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}
            >
              <i className={`fa-solid fa-arrows-rotate${loading ? ' fa-spin' : ''}`} style={{ marginRight: '6px' }}></i>
              {loading ? '更新中...' : '最新データを取得'}
            </button>
          </div>
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
                {viewMode !== 'class10' && (
                  <button
                    id="warnings-back-button"
                    onClick={handleBack}
                    style={{ padding: '4px 12px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                  >
                    ← 戻る
                  </button>
                )}
                {/* パンくず: 全国 > 府県予報区 > 一次細分区域 > 二次細分区域 */}
                <nav aria-label="区域階層" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: 600, flexWrap: 'wrap' }}>
                  {(() => {
                    const crumbStyle = (active: boolean): React.CSSProperties => ({
                      background: 'none', border: 'none', padding: 0, fontWeight: 600, fontSize: '0.875rem',
                      color: active ? '#1e293b' : '#2563eb', cursor: active ? 'default' : 'pointer',
                      textDecoration: active ? 'none' : 'underline', textUnderlineOffset: '3px',
                    });
                    const sep = <span style={{ color: '#94a3b8' }}>›</span>;
                    const c10 = selectedClass10;
                    return (
                      <>
                        <button id="crumb-national" style={crumbStyle(viewMode === 'class10')} onClick={() => viewMode !== 'class10' && navigate('class10', null, null)}>全国</button>
                        {c10 && <>{sep}<span style={{ color: '#475569' }}>{areaName.pref(areaName.prefOf10(c10))}</span></>}
                        {c10 && <>{sep}<button id="crumb-class10" style={crumbStyle(viewMode === 'class15')} onClick={() => viewMode !== 'class15' && navigate('class15', c10, null)}>{areaName.class10(c10)}</button></>}
                        {selectedClass15 && <>{sep}<span style={{ color: '#1e293b' }}>{areaName.class15(selectedClass15)}</span></>}
                        <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                          {viewMode === 'class10' ? '一次細分区域' : viewMode === 'class15' ? '二次細分区域' : '市町村'}ごとの気象警報・注意報
                        </span>
                      </>
                    );
                  })()}
                </nav>

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
                    const badges = (n?: AreaNode) => (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {!n || n.warnings.length === 0 ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>発表なし</span>
                        ) : [...n.warnings]
                          .sort((a: any, b: any) => getWarningPriority(a.warningLevel) - getWarningPriority(b.warningLevel))
                          .map((w: any, idx: number) => (
                            <span key={idx} style={{
                              padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                              whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              ...getWarningColor(w.warningLevel)
                            }}>
                              {formatWarningName(w.warningName)}
                            </span>
                          ))}
                      </div>
                    );
                    const row = (id: string, name: string, n: AreaNode | undefined, onClick?: () => void) => (
                      <tr key={id} id={`area-row-${id}`} className="slide-in-row fade-update" style={{ borderBottom: '1px solid #f1f5f9', opacity: n ? 1 : 0.6 }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                      >
                        <td style={{ padding: '12px 16px', color: '#64748b', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {n?.latest ? new Date(n.latest).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: !use24HourFormat }) : '—'}
                        </td>
                        <td
                          style={{
                            padding: '12px 16px', fontWeight: 500, color: '#1e293b', verticalAlign: 'middle',
                            cursor: onClick ? 'pointer' : 'default',
                            textDecoration: onClick ? 'underline' : 'none',
                            textDecorationColor: '#93c5fd', textUnderlineOffset: '4px'
                          }}
                          onClick={onClick}
                        >
                          {name}
                          {onClick && <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.7rem', marginLeft: '6px', color: '#94a3b8' }}></i>}
                        </td>
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>{badges(n)}</td>
                      </tr>
                    );
                    const empty = (msg: string) => (
                      <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>{msg}</td></tr>
                    );

                    // 階層1: 都道府県を見出しに、警報・注意報が発表されている一次細分区域を一覧
                    if (viewMode === 'class10') {
                      const prefs = sortedPrefCodes(hierarchy);
                      if (prefs.length === 0) return empty(loading ? '読み込み中...' : '現在発表されている警報・注意報はありません');
                      return prefs.map(pc => {
                        const o = hierarchy.prefs.get(pc)!;
                        return (
                          <React.Fragment key={pc}>
                            <tr id={`pref-heading-${pc}`} style={{ backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>
                              <td colSpan={3} style={{ padding: '8px 16px', fontWeight: 700, color: '#1e293b' }}>{o.name}</td>
                            </tr>
                            {o.children.filter(c => hierarchy.class10s.has(c)).map(c10 =>
                              row(c10, areaName.class10(c10), hierarchy.class10s.get(c10), () => navigate('class15', c10, null))
                            )}
                          </React.Fragment>
                        );
                      });
                    }

                    // 階層2: 選択した一次細分区域内の全二次細分区域
                    if (viewMode === 'class15' && selectedClass10) {
                      const n10 = hierarchy.class10s.get(selectedClass10);
                      if (!n10) return empty('この区域に発表中の警報・注意報はありません');
                      return n10.children.map(c15 =>
                        row(c15, areaName.class15(c15), hierarchy.class15s.get(c15), () => navigate('municipality', selectedClass10, c15))
                      );
                    }

                    // 階層3: 選択した二次細分区域内の全市町村
                    if (viewMode === 'municipality' && selectedClass15) {
                      const n15 = hierarchy.class15s.get(selectedClass15);
                      if (!n15) return empty('この区域に発表中の警報・注意報はありません');
                      return n15.children.map(c20 => row(c20, areaName.class20(c20), hierarchy.class20s.get(c20)));
                    }
                    return null;
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
                      <TyphoonDetailView typhoon={selectedTyphoon} onBack={() => setSelectedTyphoon(null)} use24HourFormat={use24HourFormat} />
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
function TyphoonDetailView({ typhoon, onBack, use24HourFormat }: { typhoon: any; onBack: () => void; use24HourFormat: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const num = String(typhoon.tcNumber);
  const typhoonNum = num.length >= 2 ? parseInt(num.slice(-2)) : typhoon.tcNumber;
  const displayName = `台風${typhoonNum}号（${typhoon.name}）`;
  const cur = typhoon.current || {};

  // 時刻フォーマッター
  const formatForecastTime = (isoStr: string): string => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = d.getDate();
      const hour = d.getHours();
      const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekDay = weekDays[d.getDay()];
      
      if (use24HourFormat) {
        return `${day}日(${weekDay}) ${hour}時`;
      } else {
        if (hour === 0) return `${day}日(${weekDay}) 午前0時`;
        if (hour < 12) return `${day}日(${weekDay}) 午前${hour}時`;
        if (hour === 12) return `${day}日(${weekDay}) 午後0時`;
        return `${day}日(${weekDay}) 午後${hour - 12}時`;
      }
    } catch { return isoStr; }
  };
  


  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const lat = cur.lat || 30;
    const lon = cur.lon || 135;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([lat, lon], 5);
    mapInstanceRef.current = map;

    // Pre-rendered 4K map background (much lighter processing for OBS)
    const bounds: L.LatLngBoundsExpression = [[-20, 70], [60, 180]];
    const targetMap = mapInstanceRef.current;
    if (targetMap) {
      const bgLayer = L.imageOverlay('/map_bg.png', bounds);
      (bgLayer as any).isBaseMap = true;
      bgLayer.addTo(targetMap);
    }

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
    
    // ポリゴン生成ヘルパー
    // 扇形（コーン）の外枠を計算するヘルパー
    const getOuterTangentPolygon = (points: { lat: number, lon: number, r: number }[]) => {
      if (!points || points.length <= 1) return [];
      
      const leftPoints: [number, number][] = [];
      const rightPoints: [number, number][] = [];
      
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
        if (!p1 || !p2) continue;
        const { dist, angle } = getDistAndAngle(p1, p2);
        
        if (dist <= Math.abs(p1.r - p2.r) || dist === 0) continue;

        const theta = Math.asin((p1.r - p2.r) / dist);
        const a1 = angle + Math.PI / 2 + theta;
        const a2 = angle - Math.PI / 2 - theta;

        leftPoints.push(toLatLng(p1, a1));
        if (i === points.length - 2) leftPoints.push(toLatLng(p2, a1));

        rightPoints.push(toLatLng(p1, a2));
        if (i === points.length - 2) rightPoints.push(toLatLng(p2, a2));
      }
      
      return [leftPoints, rightPoints];
    };

    // 白色の予報円（Cone of uncertainty）
    const forecastPoints = [{ lat, lon, r: 0 }, ...forecasts.map((f: any) => ({ lat: f.lat, lon: f.lon, r: f.circleRadiusKm || 0 }))];
    const forecastPolygon = getOuterTangentPolygon(forecastPoints);
    if (forecastPolygon.length > 0) {
      L.polyline(forecastPolygon, { color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);
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

    // 現在位置の時刻ラベル
    const curTimeLabel = formatForecastTime(cur.dateTime);
    // 現在位置のラベルは少し左上に配置（予報の最初の点と重なりにくくするため）
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
      html: `<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,240,240,0.92);border:1px solid #FF2800;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#FF2800;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;">${curTimeLabel}</div>`,
      iconSize: [0, 0], iconAnchor: [0, 0], className: '',
    });
    L.marker([curLabelLat, curLabelLon], { icon: curLabelIcon }).addTo(map);

    // 赤色の暴風警戒域（Cone of storm warning area）
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
    
    const stormPolygon = getOuterTangentPolygon(stormPointsRaw);
    if (stormPolygon.length > 0) {
      L.polyline(stormPolygon, { color: '#FF2800', fillColor: 'transparent', weight: 1, dashArray: '5,5' }).addTo(map);
    }



    // 現在の強風域と暴風域（台風の目からの真の円として描画）
    const curGaleCircle = getTrueCircleFromRadii(lat, lon, cur.galeRadii);
    if (curGaleCircle && curGaleCircle.radius > 0) {
      L.circle([curGaleCircle.lat, curGaleCircle.lon], { radius: curGaleCircle.radius * 1000, color: '#FFFF00', fillColor: '#FFFF00', fillOpacity: 0.3, weight: 2 }).addTo(map);
    }

    const curStormCircle = getTrueCircleFromRadii(lat, lon, cur.stormRadii);
    if (curStormCircle && curStormCircle.radius > 0) {
      L.circle([curStormCircle.lat, curStormCircle.lon], { radius: curStormCircle.radius * 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.3, weight: 1, dashArray: '5,5' }).addTo(map);
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

      // 予報円の中心に黒点を表示 (現在位置以外の予報点)
      L.circleMarker([fc.lat, fc.lon], {
        radius: 3,
        color: '#000',
        fillColor: '#000',
        fillOpacity: 1,
        weight: 1
      }).addTo(map);

      // 予報の暴風域（円で描画）
      const fStormCircle = getTrueCircleFromRadii(fc.lat, fc.lon, fc.stormRadii);
      if (fStormCircle && fStormCircle.radius > 0) {
        L.circle([fStormCircle.lat, fStormCircle.lon], { radius: fStormCircle.radius * 1000, color: '#FF2800', fillColor: 'transparent', weight: 3, dashArray: '6,6' }).addTo(map);
      }

      // 時刻ラベル：円の中心から線を延ばして表示
      const timeLabel = formatForecastTime(fc.dateTime);
      
      // 進行方向（大まかに北東向きが多い）に対して邪魔になりにくい角度を計算
      // 奇数は左上(-45度)、偶数は右下(135度)などに振る
      const angle = (idx % 2 === 0) ? -45 : 135; 
      const labelOffsetKm = (fc.circleRadiusKm || 50) + 90; // 円の外側に配置
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
        html: `<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,255,255,0.92);border:1px solid #999;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#333;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;">${timeLabel}</div>`,
        iconSize: [0, 0], iconAnchor: [0, 0], className: '',
      });
      L.marker([labelLat, labelLon], { icon: labelIcon, zIndexOffset: 1000 }).addTo(map);
    });

    // 進路線
    if (trackPoints.length > 1) {
      L.polyline(trackPoints, { color: '#ffffff', weight: 2, opacity: 1 }).addTo(map);
    }

    // 全体が見えるようにフィット
    if (trackPoints.length > 1) {
      map.fitBounds(L.latLngBounds(trackPoints).pad(0.3), { maxZoom: 6 });
    } else {
      map.setZoom(6);
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
        <span style={{ fontSize: '0.8rem', color: '#64748b', flex: 1 }}>更新: {new Date(typhoon.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
        <button
          onClick={() => {
            const url = `${window.location.origin}/?mode=obs&id=${typhoon.tcNumber}`;
            navigator.clipboard.writeText(url).then(() => {
              alert('OBS用のURLをクリップボードにコピーしました！\nブラウザソースのURLに指定してください。');
            }).catch(e => {
              console.error(e);
              alert('コピーに失敗しました。');
            });
          }}
          style={{ padding: '6px 14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <i className="fa-solid fa-link"></i> OBS表示用リンクをコピー
        </button>
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

