import React, { useState, useEffect } from 'react';

const API_BASE = 'https://jma-dashboard-backend.fuwaffu.workers.dev';

export default function App() {
  const [activeTab, setActiveTab] = useState<'warnings' | 'earthquakes' | 'typhoons'>('warnings');
  const [warnings, setWarnings] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [typhoons, setTyphoons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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
                  {activeTab === 'typhoons' && (
                    <tr style={{ color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>台風番号</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>名前</th>
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
                  {activeTab === 'typhoons' && typhoons.map((ty, index) => (
                    <tr key={ty.tcNumber || index} className="slide-in-row fade-update" style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                    >
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{ty.tcNumber}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1e293b' }}>{ty.name}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(ty.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  
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

