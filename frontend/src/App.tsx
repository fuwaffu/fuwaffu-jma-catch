import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import EarthquakeDetailView, { formatIntensity, getSeismicIntensityColor } from './EarthquakeDetailView';
import { drawTyphoon } from './utils/drawTyphoon';

const API_BASE = 'https://jma-dashboard-backend.fuwaffu.workers.dev';
const EXPIRE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default function App() {
  const [activeTab, setActiveTab] = useState<'warnings' | 'earthquakes' | 'typhoons'>('warnings');
  const [warnings, setWarnings] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [typhoons, setTyphoons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState({ isSyncing: false, progress: 0 });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedTyphoon, setSelectedTyphoon] = useState<any | null>(null);
  const [selectedEarthquake, setSelectedEarthquake] = useState<any | null>(null);

  const [viewMode, setViewMode] = useState<'prefecture' | 'region' | 'municipality'>('prefecture');
  const [selectedParentArea, setSelectedParentArea] = useState<string | null>(null);
  const [use24HourFormat, setUse24HourFormat] = useState(true);

  const fetchData = async (bustCache = false) => {
    setLoading(true);
    setError('');
    try {
      if (bustCache) {
        await fetch(`${API_BASE}/api/trigger-update`);
      }
      const cacheBuster = bustCache ? `?_t=${Date.now()}` : '';
      const [warningsRes, earthquakesRes, typhoonsRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/warnings${cacheBuster}`),
        fetch(`${API_BASE}/api/earthquakes${cacheBuster}`),
        fetch(`${API_BASE}/api/typhoons${cacheBuster}`),
        fetch(`${API_BASE}/api/status${cacheBuster}`)
      ]);

      if (!warningsRes.ok || !earthquakesRes.ok || !typhoonsRes.ok) {
        if (warningsRes.status === 500 || earthquakesRes.status === 500) {
          throw new Error('LIMIT_EXCEEDED');
        }
        throw new Error('Failed to fetch one or more APIs');
      }

      setWarnings(await warningsRes.json());
      const eqData = await earthquakesRes.json();
      setEarthquakes(eqData);
      setSelectedEarthquake((prev: any) => {
        if (!prev) return null;
        const updated = eqData.find((eq: any) => (prev.eventId && eq.eventId === prev.eventId) || eq.xmlId === prev.xmlId || eq.originTime === prev.originTime);
        return updated || prev;
      });
      const rawTyphoons = await typhoonsRes.json();
      const now = Date.now();
      const activeTyphoons = Array.isArray(rawTyphoons) ? rawTyphoons.filter((t: any) => {
        const ts = new Date(t.updatedAt || t.current?.dateTime).getTime();
        return isNaN(ts) || now - ts < EXPIRE_DAYS_MS;
      }) : [];
      setTyphoons(activeTyphoons);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setLastUpdated(statusData.lastUpdated || null);
        if (statusData.lastUpdated) {
          console.log("【システム更新検証】最新の更新時刻:", statusData.lastUpdated);
        }
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

  useEffect(() => {
    let intervalId: any;
    let isProcessing = false;
    const checkStatus = async () => {
      if (isProcessing) return;
      isProcessing = true;
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();
        setSyncStatus({ isSyncing: !!data.isSyncing, progress: data.progress || 0 });
        
        if (data.isSyncing) {
            console.log(`[Sync Status] isSyncing: ${data.isSyncing}, progress: ${data.progress}% (target: ${data.target || '?'}, current: ${data.current || '?'})`);
            // Poll sync-step to process the backend KV queue
            const stepRes = await fetch(`${API_BASE}/api/sync-step`);
            const stepData = await stepRes.json();
            if (stepData.ok) {
                setSyncStatus({ isSyncing: stepData.isSyncing, progress: stepData.progress });
            }
        }
      } catch (e) {
        console.error('[Sync Status Error]', e);
      } finally {
        isProcessing = false;
      }
    };
    checkStatus();
    intervalId = setInterval(checkStatus, 1500);
    return () => clearInterval(intervalId);
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
      <div style={{ maxWidth: '1152px', margin: '0 auto', position: 'relative' }}>
        {syncStatus.isSyncing && (
          <div style={{
            position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
            backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff', padding: '16px 32px', borderRadius: '9999px',
            display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)', fontSize: '1.25rem', fontWeight: 'bold'
          }}>
            <i className="fa-solid fa-arrows-rotate fa-spin"></i>
            <span>情報整理中... {syncStatus.progress}%</span>
          </div>
        )}
        
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
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id !== 'earthquakes') setSelectedEarthquake(null);
                  if (tab.id !== 'typhoons') setSelectedTyphoon(null);
                }}
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
                  {activeTab === 'earthquakes' && !selectedEarthquake && (
                    <tr style={{ color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>発生日時</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>震源地</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>マグニチュード</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>最大震度</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>詳細</th>
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
                      "北海道": [
                        "北海道", "宗谷地方", "上川地方", "留萌地方", "網走地方", "北見地方", "紋別地方", 
                        "十勝地方", "釧路地方", "根室地方", "胆振地方", "日高地方", "石狩地方", "空知地方", 
                        "後志地方", "渡島地方", "檜山地方",
                        "上川・留萌地方", "網走・北見・紋別地方", "石狩・空知・後志地方", 
                        "釧路・根室地方", "胆振・日高地方", "渡島・檜山地方"
                      ],
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
                  {activeTab === 'earthquakes' && !selectedEarthquake && [...earthquakes]
                    .sort((a, b) => new Date(b.originTime).getTime() - new Date(a.originTime).getTime())
                    .map((eq, index) => {
                      const formattedIntensity = formatIntensity(eq.maxIntensity);
                      
                      return (
                      <tr
                        key={eq.xmlId || index}
                        className="slide-in-row fade-update"
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                        onClick={() => setSelectedEarthquake(eq)}
                      >
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(eq.originTime).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1d4ed8', textDecoration: 'underline', textDecorationColor: '#93c5fd', textUnderlineOffset: '4px' }}>
                          {eq.hypocenterName}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1e293b' }}>M{eq.magnitude}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', ...getSeismicIntensityColor(formattedIntensity) }}>
                            震度 {formattedIntensity}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span style={{
                            padding: '4px 10px',
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            display: 'inline-block'
                          }}>
                            詳細地図 →
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                  {activeTab === 'earthquakes' && selectedEarthquake && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <EarthquakeDetailView
                          earthquake={selectedEarthquake}
                          onBack={() => setSelectedEarthquake(null)}
                        />
                      </td>
                    </tr>
                  )}
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

  const formatForecastTime = (isoStr: string): string => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = d.getDate();
      const hour = d.getHours();
      if (use24HourFormat) return `${day}日${hour}時`;
      if (hour === 0) return `${day}日午前0時`;
      if (hour < 12) return `${day}日午前${hour}時`;
      if (hour === 12) return `${day}日午後0時`;
      return `${day}日午後${hour - 12}時`;
    } catch { return isoStr; }
  };

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const lat = cur.lat || 30;
    const lon = cur.lon || 135;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([lat, lon], 5);
    map.createPane('bgPane');
    map.getPane('bgPane')!.style.zIndex = '200';
    mapInstanceRef.current = map;

    const targetMap = mapInstanceRef.current;
    if (targetMap) {
      fetch('/world_50m.geojson')
        .then(res => res.json())
        .then(data => {
          if (!mapInstanceRef.current) return;
          const style = { fillColor: '#dcfce7', color: '#166534', weight: 1, fillOpacity: 1 };
          const bgLayer = L.geoJSON(data, { style, pane: 'bgPane' });
          (bgLayer as any).isBaseMap = true;
          bgLayer.eachLayer((l: any) => (l.isBaseMap = true));
          bgLayer.addTo(targetMap);

          // 経度180度での切れ目防止
          const shiftedData = JSON.parse(JSON.stringify(data));
          shiftedData.features.forEach((f: any) => {
            if (f.geometry) {
              const shiftCoords = (coords: any[]) => {
                if (typeof coords[0] === 'number') coords[0] += 360;
                else coords.forEach(shiftCoords);
              };
              shiftCoords(f.geometry.coordinates);
            }
          });
          const bgLayerRight = L.geoJSON(shiftedData, { style, pane: 'bgPane' });
          (bgLayerRight as any).isBaseMap = true;
          bgLayerRight.eachLayer((l: any) => (l.isBaseMap = true));
          bgLayerRight.addTo(targetMap);
        })
        .catch(e => console.error('Failed to load world geojson', e));
    }

    const trackPoints = drawTyphoon(map, typhoon, { isObs: false, use24HourFormat });
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
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>更新: {new Date(typhoon.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
      </div>

      {/* 地図 */}
      <div ref={mapRef} style={{ width: '100%', height: '480px', backgroundColor: '#87cefa' }} />

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

