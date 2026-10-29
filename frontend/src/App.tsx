import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import EarthquakeDetailView, { formatIntensity, getSeismicIntensityColor } from './EarthquakeDetailView';
import { drawTyphoon } from './utils/drawTyphoon';
import { getRegionFromHypocenter, getRegionOrder, deduplicateEarthquakes, REGIONS } from './utils/earthquakeUtils';

const API_BASE = 'https://jma-dashboard-backend.fuwaffu.workers.dev';
const EXPIRE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// 気象警報の地方表示に準拠した共通リンクスタイル
const LINK_STYLE: React.CSSProperties = {
  fontWeight: 500,
  color: '#1e293b',
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationColor: '#93c5fd',
  textUnderlineOffset: '4px',
};

interface HistoryState {
  tab: 'warnings' | 'earthquakes' | 'typhoons';
  viewMode?: 'prefecture' | 'region' | 'municipality';
  selectedParentArea?: string | null;
  quakeId?: string | null;
  typhoonNumber?: string | null;
  isInitial?: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'warnings' | 'earthquakes' | 'typhoons'>('warnings');
  const [warnings, setWarnings] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [typhoons, setTyphoons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [flapEpoch, setFlapEpoch] = useState(0);
  const [selectedTyphoon, setSelectedTyphoon] = useState<any | null>(null);
  const [selectedEarthquake, setSelectedEarthquake] = useState<any | null>(null);

  const [viewMode, setViewMode] = useState<'prefecture' | 'region' | 'municipality'>('prefecture');
  const [selectedParentArea, setSelectedParentArea] = useState<string | null>(null);
  const [use24HourFormat, setUse24HourFormat] = useState(true);

  // 地震情報のソートモード
  const [quakeSortMode, setQuakeSortMode] = useState<'time_desc' | 'time_asc' | 'region' | 'intensity'>('time_desc');

  // Refで最新データを保持（popstate時の検索用）
  const earthquakesRef = useRef<any[]>([]);
  const typhoonsRef = useRef<any[]>([]);
  earthquakesRef.current = earthquakes;
  typhoonsRef.current = typhoons;

  // ナビゲーション状態更新ヘルパー（pushState）
  const pushNavState = (updates: Partial<HistoryState>) => {
    const currentState: HistoryState = {
      tab: updates.tab ?? activeTab,
      viewMode: updates.viewMode ?? viewMode,
      selectedParentArea: updates.selectedParentArea !== undefined ? updates.selectedParentArea : selectedParentArea,
      quakeId: updates.quakeId !== undefined ? updates.quakeId : (selectedEarthquake?.xmlId || selectedEarthquake?.eventId || null),
      typhoonNumber: updates.typhoonNumber !== undefined ? updates.typhoonNumber : (selectedTyphoon ? String(selectedTyphoon.tcNumber) : null),
    };
    window.history.pushState(currentState, '');
  };

  // 初回ロード時: 履歴のルート（初期状態）を replaceState で登録（push ではないので外部サイトへの「戻る」が維持される）
  useEffect(() => {
    if (!window.history.state || !window.history.state.tab) {
      const initialState: HistoryState = {
        tab: 'warnings',
        viewMode: 'prefecture',
        selectedParentArea: null,
        quakeId: null,
        typhoonNumber: null,
        isInitial: true,
      };
      window.history.replaceState(initialState, '');
    }
  }, []);

  // マウスの戻るボタン（popstate）のリスナー
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as HistoryState | null;
      if (state && state.tab) {
        // サイト内履歴が存在する場合はその状態を復元
        setActiveTab(state.tab);
        if (state.viewMode) setViewMode(state.viewMode);
        setSelectedParentArea(state.selectedParentArea || null);

        if (state.quakeId) {
          const match = earthquakesRef.current.find(eq => eq.xmlId === state.quakeId || eq.eventId === state.quakeId);
          setSelectedEarthquake(match || null);
        } else {
          setSelectedEarthquake(null);
        }

        if (state.typhoonNumber) {
          const match = typhoonsRef.current.find(t => String(t.tcNumber) === state.typhoonNumber);
          setSelectedTyphoon(match || null);
        } else {
          setSelectedTyphoon(null);
        }
      }
      // stateがない場合（初期アクセスより前の履歴）は、ブラウザ標準で直前の別サイトへ戻る
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 画面上の戻るボタンハンドラー
  const handleNavBack = () => {
    window.history.back();
  };

  // 初回データ読み込み
  const fetchData = async (bustCache = false, skipTrigger = false) => {
    setLoading(true);
    setError('');
    try {
      if (bustCache && !skipTrigger) {
        await fetch(`${API_BASE}/api/trigger-update`).catch(() => {});
      }
      const cacheBuster = bustCache ? `?_t=${Date.now()}` : '';
      const [warningsRes, earthquakesRes, typhoonsRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/warnings${cacheBuster}`),
        fetch(`${API_BASE}/api/earthquakes${cacheBuster}`),
        fetch(`${API_BASE}/api/typhoons${cacheBuster}`),
        fetch(`${API_BASE}/api/status${cacheBuster}`)
      ]);

      if (!warningsRes.ok || !earthquakesRes.ok || !typhoonsRes.ok) {
        throw new Error('Failed to fetch one or more APIs');
      }

      setWarnings(await warningsRes.json());
      const eqData = await earthquakesRes.json();
      setEarthquakes(eqData);

      // 続報が取得できた場合、開いている詳細情報も最新値で上書き同期する
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
      setSelectedTyphoon((prev: any) => {
        if (!prev) return null;
        const updated = activeTyphoons.find((t: any) => String(t.tcNumber) === String(prev.tcNumber));
        return updated || prev;
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setLastUpdated(statusData.lastUpdated || null);
      }
      if (bustCache) setFlapEpoch(c => c + 1);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const lastUpdatedRef = useRef<string | null>(null);
  lastUpdatedRef.current = lastUpdated;

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 60000); // 1分ごと自動取得
    return () => clearInterval(interval);
  }, []);

  // バックエンドの最終更新時刻を監視し、新着電文が反映されたら即座に再取得する
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.lastUpdated && lastUpdatedRef.current && data.lastUpdated !== lastUpdatedRef.current) {
          fetchData(true, true);
        }
      } catch (e) {
        console.error('[Status Check Error]', e);
      }
    };
    const intervalId = setInterval(checkStatus, 10000);
    return () => clearInterval(intervalId);
  }, []);

  // 気象警報のフィルタリング
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

  // === 地震情報: 秒単位重複の統合（最新値マージ） ===
  const uniqueEarthquakes = useMemo(() => {
    return deduplicateEarthquakes(earthquakes);
  }, [earthquakes]);

  // === 地震情報: ソート処理 ===
  const sortedEarthquakes = useMemo(() => {
    const list = [...uniqueEarthquakes];
    if (quakeSortMode === 'time_desc') {
      return list.sort((a, b) => new Date(b.originTime).getTime() - new Date(a.originTime).getTime());
    }
    if (quakeSortMode === 'time_asc') {
      return list.sort((a, b) => new Date(a.originTime).getTime() - new Date(b.originTime).getTime());
    }
    if (quakeSortMode === 'intensity') {
      const order = ['7', '6強', '6弱', '5強', '5弱', '4', '3', '2', '1'];
      return list.sort((a, b) => {
        const iA = order.indexOf(formatIntensity(a.maxIntensity));
        const iB = order.indexOf(formatIntensity(b.maxIntensity));
        return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
      });
    }
    if (quakeSortMode === 'region') {
      return list.sort((a, b) => {
        const rA = getRegionOrder(getRegionFromHypocenter(a.hypocenterName));
        const rB = getRegionOrder(getRegionFromHypocenter(b.hypocenterName));
        if (rA !== rB) return rA - rB;
        return new Date(b.originTime).getTime() - new Date(a.originTime).getTime();
      });
    }
    return list;
  }, [uniqueEarthquakes, quakeSortMode]);

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
                  const targetTab = tab.id as any;
                  setActiveTab(targetTab);
                  if (targetTab !== 'earthquakes') setSelectedEarthquake(null);
                  if (targetTab !== 'typhoons') setSelectedTyphoon(null);
                  pushNavState({ tab: targetTab, quakeId: null, typhoonNumber: null });
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
            {/* 警報タブのコントロールバー */}
            {activeTab === 'warnings' && (
              <div style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {selectedParentArea ? (
                  <>
                    <button 
                      onClick={handleNavBack}
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
                        const newMode = e.target.value as any;
                        setViewMode(newMode);
                        setSelectedParentArea(null);
                        pushNavState({ viewMode: newMode, selectedParentArea: null });
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

            {/* 地震タブのコントロールバー（地方別ソート・並び替え） */}
            {activeTab === 'earthquakes' && !selectedEarthquake && (
              <div style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>並び順:</span>
                  {[
                    { id: 'time_desc', label: '発生日時（新しい順）' },
                    { id: 'region', label: '地方別（北から順）' },
                    { id: 'intensity', label: '最大震度順' },
                    { id: 'time_asc', label: '発生日時（古い順）' },
                  ].map(sm => (
                    <button
                      key={sm.id}
                      onClick={() => setQuakeSortMode(sm.id as any)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: quakeSortMode === sm.id ? '#2563eb' : '#cbd5e1',
                        backgroundColor: quakeSortMode === sm.id ? '#eff6ff' : '#ffffff',
                        color: quakeSortMode === sm.id ? '#1d4ed8' : '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {sm.label}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  全 {uniqueEarthquakes.length} 件（秒単位の重複統合済み）
                </span>
              </div>
            )}

            {error && <div style={{ margin: '16px', padding: '12px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', fontSize: '0.875rem' }}>{error}</div>}
            
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
                      <th 
                        style={{ padding: '12px 16px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => setQuakeSortMode(m => m === 'time_desc' ? 'time_asc' : 'time_desc')}
                        title="クリックで日時順を切り替え"
                      >
                        発生日時 {quakeSortMode === 'time_desc' ? '▼' : quakeSortMode === 'time_asc' ? '▲' : ''}
                      </th>
                      <th 
                        style={{ padding: '12px 16px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => setQuakeSortMode('region')}
                        title="クリックで地方別にソート"
                      >
                        震源地 {quakeSortMode === 'region' ? '▼' : ''}
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>規模</th>
                      <th 
                        style={{ padding: '12px 16px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => setQuakeSortMode('intensity')}
                        title="クリックで最大震度順にソート"
                      >
                        最大震度 {quakeSortMode === 'intensity' ? '▼' : ''}
                      </th>
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
                <tbody key={`${activeTab}-${viewMode}-${selectedParentArea || ''}-${quakeSortMode}-${lastUpdated || ''}-${flapEpoch}`}>
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

                    let flapRowCounter = 0;

                    return CATEGORY_ORDER.map(cat => {
                      if (!warningsByCategory[cat] || warningsByCategory[cat].length === 0) return null;
                      const catDelay = Math.min(flapRowCounter++ * 18, 420);
                      return (
                        <React.Fragment key={cat}>
                          <tr className="split-flap-row" style={{ backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1', '--flap-delay': `${catDelay}ms` } as React.CSSProperties}>
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
                                <tr className="split-flap-row" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', '--flap-delay': `${Math.min(flapRowCounter++ * 18, 420)}ms` } as React.CSSProperties}>
                                  <td colSpan={3} style={{ padding: '6px 16px', fontWeight: 600, color: '#475569', fontSize: '0.8rem' }}>
                                    {pref}
                                  </td>
                                </tr>
                              )}
                              {rows.map((row: any, index: number) => {
                                const rowDelay = Math.min(flapRowCounter++ * 18, 420);
                                return (
                                <tr key={row.area || index} className="split-flap-row fade-update" style={{ borderBottom: '1px solid #f1f5f9', '--flap-delay': `${rowDelay}ms` } as React.CSSProperties}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                >
                                  <td style={{ padding: '12px 16px', color: '#64748b', verticalAlign: 'middle' }}>{new Date(row.reportDateTime).toLocaleString()}</td>
                                  <td 
                                    style={{
                                      padding: '12px 16px',
                                      verticalAlign: 'middle',
                                      ...((viewMode === 'prefecture' || viewMode === 'region') ? LINK_STYLE : { fontWeight: 500, color: '#1e293b' })
                                    }}
                                    onClick={() => {
                                      if (viewMode === 'prefecture' || viewMode === 'region') {
                                        const parent = row.prefecture || row.area;
                                        setSelectedParentArea(parent);
                                        setViewMode('municipality');
                                        pushNavState({ viewMode: 'municipality', selectedParentArea: parent });
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
                                            <span key={idx} className="flap-badge" style={{
                                              padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                                              whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                              '--badge-idx': idx,
                                              ...getWarningColor(w.warningLevel)
                                            } as React.CSSProperties}>
                                              {displayName}
                                            </span>
                                          );
                                        })}
                                    </div>
                                  </td>
                                </tr>
                              );
                              })}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      );
                    });
                  })()}

                  {/* 地震情報一覧 */}
                  {activeTab === 'earthquakes' && !selectedEarthquake && (() => {
                    // 地方別ソート時のグループ化
                    if (quakeSortMode === 'region') {
                      const byRegion: Record<string, any[]> = {};
                      sortedEarthquakes.forEach(eq => {
                        const r = getRegionFromHypocenter(eq.hypocenterName);
                        if (!byRegion[r]) byRegion[r] = [];
                        byRegion[r].push(eq);
                      });

                      let eqRegCounter = 0;
                      return REGIONS.map((reg) => {
                        const list = byRegion[reg];
                        if (!list || list.length === 0) return null;
                        const headerDelay = Math.min(eqRegCounter++ * 20, 420);
                        return (
                          <React.Fragment key={reg}>
                            <tr className="split-flap-row" style={{ backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1', '--flap-delay': `${headerDelay}ms` } as React.CSSProperties}>
                              <td colSpan={4} style={{ padding: '8px 16px', fontWeight: 700, color: '#1e293b' }}>
                                📍 {reg} ({list.length}件)
                              </td>
                            </tr>
                            {list.map((eq) => renderEarthquakeRow(eq, eqRegCounter++))}
                          </React.Fragment>
                        );
                      });
                    }

                    // 通常ソート
                    return sortedEarthquakes.map((eq, index) => renderEarthquakeRow(eq, index));
                  })()}

                  {/* 地震詳細ビュー */}
                  {activeTab === 'earthquakes' && selectedEarthquake && (
                    <tr>
                      <td colSpan={4} style={{ padding: 0 }}>
                        <EarthquakeDetailView
                          earthquake={selectedEarthquake}
                          onBack={handleNavBack}
                          onRefresh={() => fetchData(true)}
                        />
                      </td>
                    </tr>
                  )}

                  {/* 台風情報一覧 */}
                  {activeTab === 'typhoons' && !selectedTyphoon && typhoons.map((ty, index) => {
                    const num = String(ty.tcNumber);
                    const typhoonNum = num.length >= 2 ? parseInt(num.slice(-2)) : ty.tcNumber;
                    const displayName = `台風${typhoonNum}号（${ty.name}）`;
                    const intensityText = [ty.current?.intensityClass, ty.current?.areaClass].filter(Boolean).join(' / ') || '—';
                    const delay = Math.min(index * 20, 420);
                    return (
                      <tr 
                        key={ty.tcNumber || index} 
                        className="split-flap-row fade-update" 
                        style={{ borderBottom: '1px solid #f1f5f9', '--flap-delay': `${delay}ms` } as React.CSSProperties}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                      >
                        <td 
                          style={{ padding: '12px 16px', verticalAlign: 'middle', ...LINK_STYLE }}
                          onClick={() => {
                            setSelectedTyphoon(ty);
                            pushNavState({ typhoonNumber: String(ty.tcNumber) });
                          }}
                        >
                          {displayName}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1e293b' }}>{intensityText}</td>
                        <td style={{ padding: '12px 16px', color: '#1e293b' }}>{ty.current?.pressure ? `${ty.current.pressure} hPa` : '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(ty.updatedAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}

                  {/* 台風詳細ビュー */}
                  {activeTab === 'typhoons' && selectedTyphoon && (
                    <tr>
                      <td colSpan={4} style={{ padding: 0 }}>
                        <TyphoonDetailView 
                          typhoon={selectedTyphoon} 
                          onBack={handleNavBack} 
                          use24HourFormat={use24HourFormat}
                          onRefresh={() => fetchData(true)}
                        />
                      </td>
                    </tr>
                  )}
                  
                  {!loading && (
                    (activeTab === 'warnings' && warnings.length === 0) ||
                    (activeTab === 'earthquakes' && uniqueEarthquakes.length === 0) ||
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

  // 地震行レンダリング関数（気象警報の地方リンクスタイルに完全準拠）
  function renderEarthquakeRow(eq: any, index: number) {
    const formattedIntensity = formatIntensity(eq.maxIntensity);
    const regionName = getRegionFromHypocenter(eq.hypocenterName);

    const delay = Math.min(index * 18, 420);
    return (
      <tr
        key={eq.xmlId || eq.eventId || index}
        className="split-flap-row fade-update"
        style={{ borderBottom: '1px solid #f1f5f9', '--flap-delay': `${delay}ms` } as React.CSSProperties}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
      >
        <td style={{ padding: '12px 16px', color: '#64748b' }}>
          {new Date(eq.originTime).toLocaleString()}
        </td>
        <td 
          style={{ padding: '12px 16px', verticalAlign: 'middle', ...LINK_STYLE }}
          onClick={() => {
            setSelectedEarthquake(eq);
            pushNavState({ quakeId: eq.xmlId || eq.eventId });
          }}
          title="クリックして地震詳細・震度マップを表示"
        >
          {eq.hypocenterName}
          {quakeSortMode !== 'region' && (
            <span style={{ fontSize: '0.75rem', color: '#64748b', textDecoration: 'none', marginLeft: '6px', fontWeight: 400 }}>
              ({regionName})
            </span>
          )}
        </td>
        <td style={{ padding: '12px 16px', color: '#1e293b' }}>
          {eq.magnitude ? `M${eq.magnitude}` : '—'}
        </td>
        <td style={{ padding: '12px 16px' }}>
          <span className="flap-badge" style={{
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...getSeismicIntensityColor(formattedIntensity)
          }}>
            震度 {formattedIntensity}
          </span>
        </td>
      </tr>
    );
  }
}

// === 台風詳細ビュー（Leaflet地図＋情報パネル） ===
function TyphoonDetailView({
  typhoon,
  onBack,
  use24HourFormat,
  onRefresh,
}: {
  typhoon: any;
  onBack: () => void;
  use24HourFormat: boolean;
  onRefresh?: () => Promise<void>;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [copiedObs, setCopiedObs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const num = String(typhoon.tcNumber);
  const typhoonNum = num.length >= 2 ? parseInt(num.slice(-2)) : typhoon.tcNumber;
  const displayName = `台風${typhoonNum}号（${typhoon.name}）`;
  const cur = typhoon.current || {};

  const handleRefresh = async () => {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyObsUrl = () => {
    const url = `${window.location.origin}/?mode=obs&type=typhoon&id=${encodeURIComponent(String(typhoon.tcNumber))}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedObs(true);
      setTimeout(() => setCopiedObs(false), 3000);
    });
  };

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
    if (!mapRef.current) return;

    const lat = cur.lat || 30;
    const lon = cur.lon || 135;

    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, { zoomControl: true }).setView([lat, lon], 5);
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
            layer.addTo(mapInstanceRef.current);
          };
          addGeo(data);

          // 経度180度での切れ目防止
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

    const trackPoints = drawTyphoon(map, typhoon, { isObs: false, use24HourFormat });
    if (trackPoints.length > 1) {
      map.fitBounds(L.latLngBounds(trackPoints).pad(0.3), { maxZoom: 6 });
    } else {
      map.setView([lat, lon], 6);
    }
  }, [typhoon, use24HourFormat]);

  useEffect(() => {
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
      <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{ padding: '6px 14px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>← 一覧に戻る</button>
          {onRefresh && (
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
              title="最新の台風情報を再取得します"
            >
              <i className={`fa-solid fa-arrows-rotate${refreshing ? ' fa-spin' : ''}`} style={{ marginRight: '6px' }}></i>
              {refreshing ? '更新中...' : '最新情報に更新'}
            </button>
          )}
          <button
            onClick={handleCopyObsUrl}
            style={{
              padding: '6px 14px',
              backgroundColor: copiedObs ? '#16a34a' : '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.15s ease'
            }}
            title="OBSのブラウザソースに貼り付けるためのURLをコピーします"
          >
            <i className={`fa-solid ${copiedObs ? 'fa-check' : 'fa-link'}`}></i>
            {copiedObs ? 'OBS用URLをコピーしました' : 'OBS貼付用URLをコピー'}
          </button>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>🌀 {displayName}</h2>
        </div>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          実況: {cur.dateTime ? new Date(cur.dateTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—'} / 更新: {new Date(typhoon.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
        </span>
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
        <InfoCard label="進行方向・速さ" value={`${cur.direction || '—'} ${(cur.speedKmh || cur.speed) ? `${cur.speedKmh || cur.speed} km/h` : ''}`} />
        <InfoCard label="位置" value={cur.location || `${cur.lat?.toFixed(1)}°N, ${cur.lon?.toFixed(1)}°E`} />
      </div>

      {/* 進路予報一覧 */}
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
    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{value}</div>
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

// 警戒レベルに応じた色分け（気象庁標準カラーに完全準拠）
function getWarningColor(level: string): React.CSSProperties {
  switch (level) {
    case 'level_5':
    case 'special':
      return { backgroundColor: '#1e003b', color: '#ffffff' }; // レベル5 (特別警報): 黒紫
    case 'level_4':
      return { backgroundColor: '#800080', color: '#ffffff' }; // レベル4 (警報・土砂災害・高潮): 紫
    case 'level_3':
    case 'warning':
      return { backgroundColor: '#ff2800', color: '#ffffff' }; // レベル3 (警報): 赤
    case 'level_2':
    case 'advisory':
      return { backgroundColor: '#f2e700', color: '#333333' }; // レベル2 (注意報): 黄
    default:
      return { backgroundColor: '#f3f4f6', color: '#333333' };
  }
}
