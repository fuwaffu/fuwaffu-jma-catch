import React, { useEffect, useMemo, useRef, useState } from 'react';
import LTelopOverlay, { type LayoutBoxKey } from './LTelopOverlay';
import {
  ALL_REGIONS,
  DEFAULT_LTELOP_CONFIG,
  REGION_PREFECTURES,
  compute16By9LFrame,
  encodeConfigForUrl,
  loadLTelopConfig,
  saveLTelopConfig,
  type LTelopConfig,
} from '../../types/lTelopTypes';
import { buildTelopQueue } from '../../utils/lTelopEngine';

interface LTelopAdminToolProps {
  warnings: any[];
  earthquakes: any[];
  typhoons: any[];
  lastUpdated: string | null;
  loading: boolean;
  onRefresh: () => void;
  onBackToDb: () => void;
}

type AdminTabId =
  | 'preview'
  | 'info'
  | 'layout'
  | 'colors'
  | 'areaColors'
  | 'dataViewer'
  | 'advanced';

interface LogEntry {
  time: string;
  message: string;
}

export default function LTelopAdminTool({
  warnings,
  earthquakes,
  typhoons,
  lastUpdated,
  loading,
  onRefresh,
  onBackToDb,
}: LTelopAdminToolProps) {
  const [config, setConfig] = useState<LTelopConfig>(() => loadLTelopConfig());
  const [activeTab, setActiveTab] = useState<AdminTabId>('preview');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedLightweightUrl, setCopiedLightweightUrl] = useState(false);
  const [bgMode, setBgMode] = useState<'sample_stream' | 'checker' | 'dark_grid'>('sample_stream');
  const [selectedBox, setSelectedBox] = useState<LayoutBoxKey>('sidebar');
  const [snapGrid, setSnapGrid] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      time: new Date().toLocaleTimeString('ja-JP'),
      message: '[INFO] L字テロップ管理パネルを起動しました（DBライブ連携）',
    },
  ]);

  // カスタムメッセージ追加入力ステート
  const [newCustomCat, setNewCustomCat] = useState('お知らせ');
  const [newCustomText, setNewCustomText] = useState('');
  const [newCustomBg, setNewCustomBg] = useState('#2563EB');

  // データビューア用フィルタ
  const [viewerFilter, setViewerFilter] = useState<'all' | 'warning' | 'earthquake' | 'typhoon'>('all');
  const [viewerSearch, setViewerSearch] = useState('');
  const [selectedViewerItemId, setSelectedViewerItemId] = useState<string | null>(null);

  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('ja-JP');
    setLogs(prev => [{ time, message: msg }, ...prev.slice(0, 39)]);
  };

  // 設定変更時にlocalStorageへ自動保存（OBSブラウザソースと500ms同期）
  useEffect(() => {
    saveLTelopConfig(config);
  }, [config]);

  // プレビュー領域の幅に合わせて 1920x1080 を自動スケーリング
  useEffect(() => {
    const updateScale = () => {
      if (!previewWrapperRef.current) return;
      const w = previewWrapperRef.current.clientWidth || 960;
      setPreviewScale(Math.min(1, Math.max(0.2, w / 1920)));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [activeTab]);

  const telopQueue = useMemo(
    () => buildTelopQueue(warnings, earthquakes, typhoons, config),
    [warnings, earthquakes, typhoons, config]
  );

  // OBS用URL（設定パラメータ埋め込み版 & ローカル同期シンプル版）
  const obsFullUrl = useMemo(() => {
    const encoded = encodeConfigForUrl(config);
    return `${window.location.origin}/?mode=obs&type=ltelop${encoded ? `&cfg=${encoded}` : ''}`;
  }, [config]);

  const obsLocalSyncUrl = `${window.location.origin}/?mode=obs&type=ltelop`;

  const handleCopyObsUrl = (includeConfigParam: boolean) => {
    const targetUrl = includeConfigParam ? obsFullUrl : obsLocalSyncUrl;
    navigator.clipboard.writeText(targetUrl).then(() => {
      if (includeConfigParam) {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 3000);
        addLog('[INFO] OBSブラウザソース用URL（設定埋込）をコピーしました');
      } else {
        setCopiedLightweightUrl(true);
        setTimeout(() => setCopiedLightweightUrl(false), 3000);
        addLog('[INFO] OBSブラウザソース用URL（標準）をコピーしました');
      }
    });
  };

  const updateLayoutBox = (
    key: LayoutBoxKey,
    patch: { x?: number; y?: number; width?: number; height?: number }
  ) => {
    setConfig(prev => {
      // 左サイドバーまたは下部ティッカーのサイズ変更時は、中の映像画面が必ず16:9になるよう連動更新
      if (key === 'sidebar' && patch.width !== undefined) {
        const frame = compute16By9LFrame({ sidebarWidth: patch.width });
        return {
          ...prev,
          layout: {
            ...prev.layout,
            sidebar: {
              ...prev.layout.sidebar,
              x: 0,
              y: 0,
              width: frame.sidebarWidth,
              height: frame.sidebarHeight,
            },
            ticker: {
              ...prev.layout.ticker,
              x: 0,
              y: frame.tickerY,
              width: 1920,
              height: frame.tickerHeight,
            },
          },
        };
      }
      if (key === 'ticker' && patch.height !== undefined) {
        const frame = compute16By9LFrame({ tickerHeight: patch.height });
        return {
          ...prev,
          layout: {
            ...prev.layout,
            sidebar: {
              ...prev.layout.sidebar,
              x: 0,
              y: 0,
              width: frame.sidebarWidth,
              height: frame.sidebarHeight,
            },
            ticker: {
              ...prev.layout.ticker,
              x: 0,
              y: frame.tickerY,
              width: 1920,
              height: frame.tickerHeight,
            },
          },
        };
      }
      return {
        ...prev,
        layout: {
          ...prev.layout,
          [key]: {
            ...prev.layout[key],
            ...patch,
          },
        },
      };
    });
  };

  const applyColorPreset = (preset: 'jma' | 'high_contrast' | 'dark') => {
    if (preset === 'jma') {
      setConfig(prev => ({
        ...prev,
        colors: DEFAULT_LTELOP_CONFIG.colors,
        areaColors: DEFAULT_LTELOP_CONFIG.areaColors,
      }));
      addLog('[INFO] カラープリセット「気象庁標準配色」を適用しました');
    } else if (preset === 'high_contrast') {
      setConfig(prev => ({
        ...prev,
        colors: {
          ...prev.colors,
          warningLevels: {
            special: { bg: '#6B006B', text: '#FFFF00' },
            level4: { bg: '#7E22CE', text: '#FFFFFF' },
            warning: { bg: '#DC2626', text: '#FFFFFF' },
            advisory: { bg: '#FACC15', text: '#000000' },
            cleared: { bg: '#475569', text: '#FFFFFF' },
          },
        },
        areaColors: {
          ...prev.areaColors,
          sidebar: {
            ...prev.areaColors.sidebar,
            bgStart: '#000000',
            bgEnd: '#1E293B',
            borderRightColor: '#FFFF00',
            borderRightWidth: 4,
            opacity: 0.98,
          },
          ticker: {
            ...prev.areaColors.ticker,
            bgStart: '#000000',
            bgEnd: '#0F172A',
            borderTopColor: '#FFFF00',
            borderTopWidth: 4,
            opacity: 0.98,
          },
        },
      }));
      addLog('[INFO] カラープリセット「高コントラスト」を適用しました');
    } else {
      setConfig(prev => ({
        ...prev,
        areaColors: {
          ...prev.areaColors,
          sidebar: {
            ...prev.areaColors.sidebar,
            bgStart: '#0F172A',
            bgEnd: '#1E293B',
            borderRightColor: '#38BDF8',
            borderRightWidth: 2,
            opacity: 0.92,
          },
          ticker: {
            ...prev.areaColors.ticker,
            bgStart: '#090D16',
            bgEnd: '#111827',
            borderTopColor: '#38BDF8',
            borderTopWidth: 2,
            opacity: 0.92,
          },
        },
      }));
      addLog('[INFO] カラープリセット「ダーク」を適用しました');
    }
  };

  const handleTriggerTestPreset = (presetKey: string, label: string) => {
    setConfig(prev => ({
      ...prev,
      advanced: {
        ...prev.advanced,
        dataSourceMode: 'test',
        activeTestPreset: presetKey,
      },
    }));
    addLog(`[TEST] テストデータ「${label}」を送信・反映しました`);
  };

  const handleAddCustomMessage = () => {
    if (!newCustomText.trim()) return;
    const msg = {
      id: String(Date.now()),
      categoryLabel: newCustomCat.trim() || 'お知らせ',
      text: newCustomText.trim(),
      color: newCustomBg,
      textColor: '#FFFFFF',
      enabled: true,
    };
    setConfig(prev => ({
      ...prev,
      info: {
        ...prev.info,
        enableCustomMessages: true,
        customMessages: [msg, ...prev.info.customMessages],
      },
      advanced: {
        ...prev.advanced,
        dataSourceMode: 'live',
        activeTestPreset: null,
      },
    }));
    setNewCustomText('');
    addLog(`[INFO] カスタムテロップ「${msg.categoryLabel}: ${msg.text}」を追加しました`);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `l-telop-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('[INFO] 設定JSONファイルをエクスポートしました');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setConfig({ ...DEFAULT_LTELOP_CONFIG, ...parsed });
        addLog('[INFO] 設定JSONファイルをインポートしました');
      } catch {
        alert('JSONファイルの形式が正しくありません。');
      }
    };
    reader.readAsText(file);
  };

  const TABS: { id: AdminTabId; label: string; icon: string }[] = [
    { id: 'preview', label: 'プレビュー & OBS出力', icon: 'fa-tv' },
    { id: 'info', label: '表示情報設定', icon: 'fa-sliders' },
    { id: 'layout', label: 'レイアウト設定(D&D)', icon: 'fa-up-down-left-right' },
    { id: 'colors', label: 'カラー設定', icon: 'fa-palette' },
    { id: 'areaColors', label: 'エリアカラー設定', icon: 'fa-fill-drip' },
    { id: 'dataViewer', label: 'データビューア', icon: 'fa-database' },
    { id: 'advanced', label: '詳細設定', icon: 'fa-gear' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 上部OBS連携バー */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
          color: '#fff',
          padding: '18px 22px',
          borderRadius: '10px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 6px 20px rgba(15, 23, 42, 0.2)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
              }}
            >
              OBS 1920×1080
            </span>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              L字テロップ生成・管理スタジオ
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
            データベースの気象警報・地震・台風情報を自動取得し、OBSのブラウザソース（幅1920×高さ1080・背景透過）へリアルタイム配信します。
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => handleCopyObsUrl(true)}
            style={{
              padding: '9px 16px',
              backgroundColor: copiedUrl ? '#16a34a' : '#2563eb',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
            title="現在の全設定を含んだOBSブラウザソース用URLをコピーします"
          >
            <i className={`fa-solid ${copiedUrl ? 'fa-check' : 'fa-copy'}`}></i>
            {copiedUrl ? 'OBS用URLをコピーしました！' : 'OBS貼付用URLをコピー'}
          </button>

          <a
            href={obsFullUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '9px 14px',
              backgroundColor: 'rgba(255,255,255,0.14)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.85rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fa-solid fa-up-right-from-square"></i>
            別タブでオーバーレイを開く
          </a>

          <button
            onClick={onBackToDb}
            style={{
              padding: '9px 14px',
              backgroundColor: '#fff',
              color: '#1e293b',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            ← データベース一覧に戻る
          </button>
        </div>
      </div>

      {/* メインカード */}
      <div
        style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* 7タブナビゲーション */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
          }}
        >
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: '1 1 auto',
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: active ? '3px solid #2563eb' : '3px solid transparent',
                  backgroundColor: active ? '#ffffff' : 'transparent',
                  color: active ? '#1d4ed8' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  transition: 'all 0.15s',
                }}
              >
                <i className={`fa-solid ${tab.icon}`}></i>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* タブコンテンツ */}
        <div style={{ padding: '20px' }}>
          {/* ================= タブ: プレビュー & OBS出力 ================= */}
          {activeTab === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* コントロールバー */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    データソース:
                  </span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                    <input
                      type="radio"
                      checked={config.advanced.dataSourceMode === 'live'}
                      onChange={() => {
                        setConfig(prev => ({
                          ...prev,
                          advanced: { ...prev.advanced, dataSourceMode: 'live', activeTestPreset: null },
                        }));
                        addLog('[INFO] 実データ（データベースライブ連動）モードに切り替えました');
                      }}
                    />
                    🟢 実データ（DBライブ: 現在 {telopQueue.length} 件表示中）
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                    <input
                      type="radio"
                      checked={config.advanced.dataSourceMode === 'test'}
                      onChange={() => {
                        setConfig(prev => ({
                          ...prev,
                          advanced: {
                            ...prev.advanced,
                            dataSourceMode: 'test',
                            activeTestPreset: prev.advanced.activeTestPreset || 'warning',
                          },
                        }));
                        addLog('[TEST] テストデータ表示モードに切り替えました');
                      }}
                    />
                    🧪 テストデータ
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>プレビュー背景:</span>
                  {[
                    { id: 'sample_stream', label: '配信画面イメージ' },
                    { id: 'checker', label: '透過チェッカー' },
                    { id: 'dark_grid', label: '暗色グリッド' },
                  ].map(b => (
                    <button
                      key={b.id}
                      onClick={() => setBgMode(b.id as any)}
                      style={{
                        padding: '5px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        borderRadius: '5px',
                        border: '1px solid',
                        borderColor: bgMode === b.id ? '#2563eb' : '#cbd5e1',
                        backgroundColor: bgMode === b.id ? '#eff6ff' : '#fff',
                        color: bgMode === b.id ? '#1d4ed8' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1920x1080 縮小リアルタイムプレビュー */}
              <div
                ref={previewWrapperRef}
                style={{
                  width: '100%',
                  height: `${Math.round(1080 * previewScale)}px`,
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '2px solid #cbd5e1',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
                  backgroundColor: '#0f172a',
                }}
              >
                <LTelopOverlay
                  config={config}
                  items={telopQueue}
                  scale={previewScale}
                  backgroundMode={bgMode}
                />
              </div>

              {/* 左サイドバータイトル設定 & 16:9 L字サイズ調整 & 1h〜72h 時間フィルタ（プレビュー直下クイック調整） */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '16px',
                }}
              >
                {/* 左サイドバー タイトル文字・位置 & 16:9枠サイズ */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                      🏷️ 左サイドバー タイトル文字・位置 & 16:9枠調整
                    </h3>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                      }}
                    >
                      中の画面: {1920 - config.layout.sidebar.width}×{1080 - config.layout.ticker.height}px (16:9)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>
                      タイトル文字（左サイドバー）
                      <input
                        type="text"
                        value={config.layout.sidebar.titleText}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            layout: {
                              ...prev.layout,
                              sidebar: { ...prev.layout.sidebar, titleText: e.target.value },
                            },
                          }))
                        }
                        placeholder="例: 気象・防災情報"
                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                      />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>
                      サブタイトル（任意）
                      <input
                        type="text"
                        value={config.layout.sidebar.subTitleText || ''}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            layout: {
                              ...prev.layout,
                              sidebar: { ...prev.layout.sidebar, subTitleText: e.target.value },
                            },
                          }))
                        }
                        placeholder="例: 気象庁発表"
                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                      />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>
                      <span>タイトル左右位置 X ({config.layout.sidebar.titleOffsetX || 0}px)</span>
                      <input
                        type="range"
                        min={-120}
                        max={120}
                        step={2}
                        value={config.layout.sidebar.titleOffsetX || 0}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            layout: {
                              ...prev.layout,
                              sidebar: { ...prev.layout.sidebar, titleOffsetX: Number(e.target.value) },
                            },
                          }))
                        }
                      />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>
                      <span>タイトル上下位置 Y ({config.layout.sidebar.titleOffsetY || 0}px)</span>
                      <input
                        type="range"
                        min={-420}
                        max={420}
                        step={4}
                        value={config.layout.sidebar.titleOffsetY || 0}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            layout: {
                              ...prev.layout,
                              sidebar: { ...prev.layout.sidebar, titleOffsetY: Number(e.target.value) },
                            },
                          }))
                        }
                      />
                    </label>

                    <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>
                      <span>
                        L字枠サイズ（16:9連動）: サイドバー幅 {config.layout.sidebar.width}px / 下部ティッカー高さ {config.layout.ticker.height}px
                      </span>
                      <input
                        type="range"
                        min={45}
                        max={180}
                        step={9}
                        value={config.layout.ticker.height}
                        onChange={e => updateLayoutBox('ticker', { height: Number(e.target.value) })}
                      />
                    </label>

                    <div
                      style={{
                        gridColumn: '1 / -1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid #e2e8f0',
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>
                        下部ティッカー左端（クロスディゾルブ見出し）配色:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          背景色
                          <input
                            type="color"
                            value={config.areaColors.headerBadge.bgColor}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                areaColors: {
                                  ...prev.areaColors,
                                  headerBadge: { ...prev.areaColors.headerBadge, bgColor: e.target.value },
                                },
                              }))
                            }
                          />
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          文字色
                          <input
                            type="color"
                            value={config.areaColors.headerBadge.textColor}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                areaColors: {
                                  ...prev.areaColors,
                                  headerBadge: { ...prev.areaColors.headerBadge, textColor: e.target.value },
                                },
                              }))
                            }
                          />
                        </label>
                        <button
                          onClick={() =>
                            setConfig(prev => ({
                              ...prev,
                              areaColors: {
                                ...prev.areaColors,
                                headerBadge: {
                                  ...prev.areaColors.headerBadge,
                                  bgColor: '#000000',
                                  textColor: '#FFFFFF',
                                },
                              },
                            }))
                          }
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#000000',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                          }}
                        >
                          黒(#000000)に戻す
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 地震・警報の最新1時間〜72時間 表示期間フィルタ */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                    ⏱️ 警報の表示単位 & 地震・警報の表示期間フィルタ（最新 1時間 〜 72時間）
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.82rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontWeight: 700, flexWrap: 'wrap', gap: '6px' }}>
                        <span>📍 警報・注意報の地域表示単位:</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {[
                            { id: 'prefecture', label: '都道府県ごと (東京都)' },
                            { id: 'region', label: '地方ごと (東京都　東京地方)' },
                            { id: 'municipality', label: '市区町村ごと (東京都・千代田区)' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() =>
                                setConfig(prev => ({
                                  ...prev,
                                  info: { ...prev.info, warningAreaLevel: opt.id as any },
                                }))
                              }
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                border: '1px solid',
                                borderColor: config.info.warningAreaLevel === opt.id ? '#2563eb' : '#cbd5e1',
                                backgroundColor: config.info.warningAreaLevel === opt.id ? '#eff6ff' : '#fff',
                                color: config.info.warningAreaLevel === opt.id ? '#1d4ed8' : '#475569',
                                cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontWeight: 700 }}>
                        <span>⚠️ 気象警報・注意報の表示範囲:</span>
                        <span style={{ color: '#2563eb' }}>最新 {config.info.warningMaxAgeHours} 時間以内</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={72}
                        step={1}
                        value={config.info.warningMaxAgeHours}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            info: { ...prev.info, warningMaxAgeHours: Number(e.target.value) },
                          }))
                        }
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {[1, 3, 6, 12, 24, 48, 72].map(h => (
                          <button
                            key={h}
                            onClick={() =>
                              setConfig(prev => ({
                                ...prev,
                                info: { ...prev.info, warningMaxAgeHours: h },
                              }))
                            }
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: '1px solid',
                              borderColor: config.info.warningMaxAgeHours === h ? '#2563eb' : '#cbd5e1',
                              backgroundColor: config.info.warningMaxAgeHours === h ? '#eff6ff' : '#fff',
                              color: config.info.warningMaxAgeHours === h ? '#1d4ed8' : '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            {h}時間
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontWeight: 700 }}>
                        <span>🔵 地震情報の表示範囲:</span>
                        <span style={{ color: '#2563eb' }}>最新 {config.info.earthquakeMaxAgeHours} 時間以内</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={72}
                        step={1}
                        value={config.info.earthquakeMaxAgeHours}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            info: { ...prev.info, earthquakeMaxAgeHours: Number(e.target.value) },
                          }))
                        }
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {[1, 3, 6, 12, 24, 48, 72].map(h => (
                          <button
                            key={h}
                            onClick={() =>
                              setConfig(prev => ({
                                ...prev,
                                info: { ...prev.info, earthquakeMaxAgeHours: h },
                              }))
                            }
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: '1px solid',
                              borderColor: config.info.earthquakeMaxAgeHours === h ? '#2563eb' : '#cbd5e1',
                              backgroundColor: config.info.earthquakeMaxAgeHours === h ? '#eff6ff' : '#fff',
                              color: config.info.earthquakeMaxAgeHours === h ? '#1d4ed8' : '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            {h}時間
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* テストデータワンクリック送信 & カスタムテロップ送信 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                      🧪 ワンクリック・テストデータ送信
                    </h3>
                    {config.advanced.dataSourceMode === 'test' && (
                      <button
                        onClick={() =>
                          setConfig(prev => ({
                            ...prev,
                            advanced: { ...prev.advanced, dataSourceMode: 'live', activeTestPreset: null },
                          }))
                        }
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#16a34a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        実データ（DBライブ）に戻す
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                      { key: 'typhoon', label: '🌀 台風情報(MAP付)' },
                      { key: 'warning', label: '⚠️ 警報(東京都)' },
                      { key: 'special_warning', label: '🔴 特別警報' },
                      { key: 'eq_4', label: '🔵 地震(震度4)' },
                      { key: 'eq_6plus', label: '🔵 地震(震度6強)' },
                      { key: 'tsunami', label: '🌊 津波警報' },
                      { key: 'volcano', label: '🌋 噴火警報' },
                      { key: 'tornado', label: '⛈️ 竜巻注意' },
                    ].map(btn => {
                      const isCurrent =
                        config.advanced.dataSourceMode === 'test' &&
                        config.advanced.activeTestPreset === btn.key;
                      return (
                        <button
                          key={btn.key}
                          onClick={() => handleTriggerTestPreset(btn.key, btn.label)}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '6px',
                            border: isCurrent ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            backgroundColor: isCurrent ? '#dbeafe' : '#ffffff',
                            color: '#1e293b',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* カスタムテキスト即時追加 */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                    💬 カスタムテロップ追加（ティッカーへ挿入）
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={newCustomCat}
                      onChange={e => setNewCustomCat(e.target.value)}
                      placeholder="カテゴリ(例: お知らせ)"
                      style={{
                        width: '110px',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                      }}
                    />
                    <input
                      type="color"
                      value={newCustomBg}
                      onChange={e => setNewCustomBg(e.target.value)}
                      title="バッジ背景色"
                      style={{ width: '38px', height: '36px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={newCustomText}
                      onChange={e => setNewCustomText(e.target.value)}
                      placeholder="スクロール表示するテキストを入力..."
                      style={{
                        flex: 1,
                        minWidth: '180px',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleAddCustomMessage()}
                    />
                    <button
                      onClick={handleAddCustomMessage}
                      style={{
                        padding: '7px 14px',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                      }}
                    >
                      追加
                    </button>
                  </div>
                  {config.info.customMessages.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {config.info.customMessages.map(m => (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            background: '#fff',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.8rem',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                backgroundColor: m.color,
                                color: '#fff',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            >
                              {m.categoryLabel}
                            </span>
                            <span>{m.text}</span>
                          </span>
                          <button
                            onClick={() =>
                              setConfig(prev => ({
                                ...prev,
                                info: {
                                  ...prev.info,
                                  customMessages: prev.info.customMessages.filter(x => x.id !== m.id),
                                },
                              }))
                            }
                            style={{
                              border: 'none',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                            }}
                          >
                            削除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* OBS接続URL案内 & 表示ログ */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 700, color: '#1e3a8a' }}>
                    📡 OBS Studio ブラウザソース設定方法
                  </h3>
                  <ol style={{ margin: '0 0 12px', paddingLeft: '20px', fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.7 }}>
                    <li>OBSの「ソース」→「＋」→「<strong>ブラウザ</strong>」を追加します。</li>
                    <li>下の「<strong>OBS貼付用URL</strong>」をコピーしてURL欄に貼り付けます。</li>
                    <li>幅を <code>1920</code>、高さを <code>1080</code> に設定します（カスタムCSS不要、自動で背景透過されます）。</li>
                  </ol>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      value={obsFullUrl}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1px solid #93c5fd',
                        backgroundColor: '#fff',
                        fontSize: '0.78rem',
                        color: '#334155',
                      }}
                    />
                    <button
                      onClick={() => handleCopyObsUrl(true)}
                      style={{
                        padding: '7px 12px',
                        backgroundColor: copiedUrl ? '#16a34a' : '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {copiedUrl ? 'コピー完了' : 'URLコピー'}
                    </button>
                    <button
                      onClick={() => handleCopyObsUrl(false)}
                      style={{
                        padding: '7px 12px',
                        backgroundColor: copiedLightweightUrl ? '#16a34a' : '#475569',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      title="同一PCのブラウザとlocalStorageで自動同期する短いURLをコピーします"
                    >
                      {copiedLightweightUrl ? '短縮URLコピー済' : '短縮URL'}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#0f172a',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    maxHeight: '175px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>
                    📋 テロップ動作ログ (最新 {logs.length} 件)
                  </div>
                  {logs.map((l, idx) => (
                    <div key={idx} style={{ padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ color: '#94a3b8', marginRight: '8px' }}>{l.time}</span>
                      <span>{l.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= タブ1: 表示情報設定 (InfoSelector) ================= */}
          {activeTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* 1. 情報種別選択 */}
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                  📋 表示する防災情報の選択（データベース連携）
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  {[
                    { key: 'enableSpecialWarning', label: '🔴 気象特別警報 (レベル5)', desc: '大雨・暴風・高潮・波浪・大雪・暴風雪特別警報' },
                    { key: 'enableWarning', label: '🟠 気象警報 (レベル3〜4)', desc: '大雨・洪水・暴風・波浪・高潮・大雪警報など' },
                    { key: 'enableAdvisory', label: '🟡 気象注意報 (レベル2)', desc: '大雨・雷・強風・濃霧・乾燥・波浪注意報など' },
                    { key: 'enableEarthquake', label: '🔵 地震情報 (震度速報・震源震度)', desc: '震源地・マグニチュード・最大震度・深さ' },
                    { key: 'enableTyphoon', label: '🌀 台風情報 (実況・予報・MAP)', desc: '中心気圧・最大風速・進行方向・進路予想図' },
                    { key: 'enableCustomMessages', label: '💬 カスタムお知らせ文', desc: '配信者任意のテロップメッセージをスクロール' },
                  ].map(item => (
                    <label
                      key={item.key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '12px',
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={(config.info as any)[item.key]}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            info: { ...prev.info, [item.key]: e.target.checked },
                          }))
                        }
                        style={{ marginTop: '3px', transform: 'scale(1.2)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>{item.label}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>{item.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* 地震の最小震度・最大表示件数フィルタ & 警報の地域表示単位 */}
                <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>警報・注意報の地域表示単位:</span>
                    <select
                      value={config.info.warningAreaLevel}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          info: { ...prev.info, warningAreaLevel: e.target.value as any },
                        }))
                      }
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                    >
                      <option value="prefecture">都道府県ごと（例: 東京都 大雨警報）</option>
                      <option value="region">都道府県内の地方ごと（例: 東京都　東京地方 大雨警報）</option>
                      <option value="municipality">市区町村ごと（例: 東京都・千代田区 大雨警報）</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>地震の表示対象（最小最大震度）:</span>
                    <select
                      value={config.info.minSeismicIntensity}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          info: { ...prev.info, minSeismicIntensity: e.target.value as any },
                        }))
                      }
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                    >
                      {['1', '2', '3', '4', '5弱', '5強', '6弱', '6強', '7'].map(int => (
                        <option key={int} value={int}>
                          震度 {int} 以上
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>地震ティッカー最大表示件数:</span>
                    <select
                      value={config.info.maxEarthquakeItems}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          info: { ...prev.info, maxEarthquakeItems: Number(e.target.value) },
                        }))
                      }
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                    >
                      {[1, 2, 3, 5, 10].map(n => (
                        <option key={n} value={n}>
                          最新 {n} 件
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 最新 1時間〜72時間 の表示期間フィルタ */}
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.84rem', fontWeight: 700 }}>
                      <span>⚠️ 気象警報・注意報の表示期間 (1〜72時間)</span>
                      <span style={{ color: '#2563eb' }}>最新 {config.info.warningMaxAgeHours} 時間</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="range"
                        min={1}
                        max={72}
                        step={1}
                        value={config.info.warningMaxAgeHours}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            info: { ...prev.info, warningMaxAgeHours: Number(e.target.value) },
                          }))
                        }
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        min={1}
                        max={72}
                        value={config.info.warningMaxAgeHours}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            info: {
                              ...prev.info,
                              warningMaxAgeHours: Math.max(1, Math.min(72, Number(e.target.value) || 1)),
                            },
                          }))
                        }
                        style={{ width: '56px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.84rem', fontWeight: 700 }}>
                      <span>🔵 地震情報の表示期間 (1〜72時間)</span>
                      <span style={{ color: '#2563eb' }}>最新 {config.info.earthquakeMaxAgeHours} 時間</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="range"
                        min={1}
                        max={72}
                        step={1}
                        value={config.info.earthquakeMaxAgeHours}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            info: { ...prev.info, earthquakeMaxAgeHours: Number(e.target.value) },
                          }))
                        }
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        min={1}
                        max={72}
                        value={config.info.earthquakeMaxAgeHours}
                        onChange={e =>
                          setConfig(prev => ({
                            ...prev,
                            info: {
                              ...prev.info,
                              earthquakeMaxAgeHours: Math.max(1, Math.min(72, Number(e.target.value) || 1)),
                            },
                          }))
                        }
                        style={{ width: '56px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. 対象地域フィルタ */}
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                    🗺️ 対象地域フィルタ
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { id: 'all', label: '全国すべて' },
                      { id: 'regions', label: '地方単位で選択' },
                      { id: 'prefectures', label: '都道府県・地方単位で選択' },
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() =>
                          setConfig(prev => ({
                            ...prev,
                            info: { ...prev.info, regionScope: mode.id as any },
                          }))
                        }
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: config.info.regionScope === mode.id ? '#2563eb' : '#cbd5e1',
                          backgroundColor: config.info.regionScope === mode.id ? '#2563eb' : '#fff',
                          color: config.info.regionScope === mode.id ? '#fff' : '#334155',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {config.info.regionScope === 'regions' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {ALL_REGIONS.map(reg => {
                      const checked = config.info.selectedRegions.includes(reg);
                      return (
                        <label
                          key={reg}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${checked ? '#2563eb' : '#cbd5e1'}`,
                            backgroundColor: checked ? '#eff6ff' : '#fff',
                            fontWeight: 600,
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              const next = e.target.checked
                                ? [...config.info.selectedRegions, reg]
                                : config.info.selectedRegions.filter(r => r !== reg);
                              setConfig(prev => ({
                                ...prev,
                                info: { ...prev.info, selectedRegions: next },
                              }));
                            }}
                          />
                          {reg}
                        </label>
                      );
                    })}
                  </div>
                )}

                {config.info.regionScope === 'prefectures' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() =>
                          setConfig(prev => ({
                            ...prev,
                            info: {
                              ...prev.info,
                              selectedPrefectures: Object.values(REGION_PREFECTURES).flat(),
                            },
                          }))
                        }
                        style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                      >
                        すべて選択
                      </button>
                      <button
                        onClick={() =>
                          setConfig(prev => ({
                            ...prev,
                            info: { ...prev.info, selectedPrefectures: [] },
                          }))
                        }
                        style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                      >
                        すべて解除
                      </button>
                    </div>
                    {ALL_REGIONS.map(reg => (
                      <div key={reg} style={{ background: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', marginBottom: '6px' }}>{reg}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(REGION_PREFECTURES[reg] || []).slice(0, 10).map(pref => {
                            const checked = config.info.selectedPrefectures.includes(pref);
                            return (
                              <label key={pref} style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => {
                                    const next = e.target.checked
                                      ? [...config.info.selectedPrefectures, pref]
                                      : config.info.selectedPrefectures.filter(p => p !== pref);
                                    setConfig(prev => ({
                                      ...prev,
                                      info: { ...prev.info, selectedPrefectures: next },
                                    }));
                                  }}
                                />
                                {pref}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. 表示優先度 & 表示時間設定 */}
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                  📊 表示優先度と自動消去タイマー（上が高優先）
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...config.info.priorities]
                    .sort((a, b) => a.priority - b.priority)
                    .map((rule, idx, arr) => (
                      <div
                        key={rule.category}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '10px 14px',
                          backgroundColor: '#fff',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
                            {rule.label}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>発表からの表示期間:</span>
                          <select
                            value={rule.durationSec}
                            onChange={e => {
                              const sec = Number(e.target.value);
                              setConfig(prev => ({
                                ...prev,
                                info: {
                                  ...prev.info,
                                  priorities: prev.info.priorities.map(p =>
                                    p.category === rule.category ? { ...p, durationSec: sec } : p
                                  ),
                                },
                              }));
                            }}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          >
                            <option value={0}>消去まで常時表示</option>
                            <option value={300}>5分 (300秒)</option>
                            <option value={600}>10分 (600秒)</option>
                            <option value={1800}>30分 (1800秒)</option>
                            <option value={3600}>1時間 (3600秒)</option>
                            <option value={21600}>6時間</option>
                            <option value={86400}>24時間</option>
                          </select>

                          <button
                            disabled={idx === 0}
                            onClick={() => {
                              const sorted = [...config.info.priorities].sort((a, b) => a.priority - b.priority);
                              const prevItem = sorted[idx - 1];
                              if (!prevItem) return;
                              setConfig(prev => ({
                                ...prev,
                                info: {
                                  ...prev.info,
                                  priorities: prev.info.priorities.map(p => {
                                    if (p.category === rule.category) return { ...p, priority: prevItem.priority };
                                    if (p.category === prevItem.category) return { ...p, priority: rule.priority };
                                    return p;
                                  }),
                                },
                              }));
                            }}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                            title="優先度を上げる"
                          >
                            ▲
                          </button>
                          <button
                            disabled={idx === arr.length - 1}
                            onClick={() => {
                              const sorted = [...config.info.priorities].sort((a, b) => a.priority - b.priority);
                              const nextItem = sorted[idx + 1];
                              if (!nextItem) return;
                              setConfig(prev => ({
                                ...prev,
                                info: {
                                  ...prev.info,
                                  priorities: prev.info.priorities.map(p => {
                                    if (p.category === rule.category) return { ...p, priority: nextItem.priority };
                                    if (p.category === nextItem.category) return { ...p, priority: rule.priority };
                                    return p;
                                  }),
                                },
                              }));
                            }}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: idx === arr.length - 1 ? 'not-allowed' : 'pointer' }}
                            title="優先度を下げる"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= タブ3: レイアウト設定 (LayoutEditor D&D) ================= */}
          {activeTab === 'layout' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                    🖱️ L字レイアウト ビジュアルD&Dエディタ (1920×1080)
                  </span>
                  <label style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={snapGrid} onChange={e => setSnapGrid(e.target.checked)} />
                    10pxグリッドスナップ
                  </label>
                  <label style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showSafeArea} onChange={e => setShowSafeArea(e.target.checked)} />
                    放送セーフエリア(5%)・中心線ガイド表示
                  </label>
                </div>

                <button
                  onClick={() => {
                    setConfig(prev => ({ ...prev, layout: DEFAULT_LTELOP_CONFIG.layout }));
                    addLog('[INFO] レイアウト配置を初期状態にリセットしました');
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#e2e8f0',
                    color: '#1e293b',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  レイアウトを初期配置に戻す
                </button>
              </div>

              {/* D&D キャンバス */}
              <div
                ref={previewWrapperRef}
                style={{
                  width: '100%',
                  height: `${Math.round(1080 * previewScale)}px`,
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '2px solid #2563eb',
                  backgroundColor: '#0f172a',
                }}
              >
                <LTelopOverlay
                  config={config}
                  items={telopQueue}
                  scale={previewScale}
                  backgroundMode="dark_grid"
                  editableLayout={true}
                  selectedBox={selectedBox}
                  onSelectBox={setSelectedBox}
                  onUpdateBox={updateLayoutBox}
                  snapGrid={snapGrid}
                  showSafeArea={showSafeArea}
                />
              </div>

              {/* 要素選択＆数値プロパティ調整パネル */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* 要素一覧 */}
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700 }}>📦 配置要素の選択・表示切替</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(
                      [
                        { key: 'sidebar', label: '左サイドバー' },
                        { key: 'ticker', label: '下部ティッカー' },
                        { key: 'typhoonMap', label: '台風MAP' },
                        { key: 'earthquakePanel', label: '地震情報パネル' },
                        { key: 'clock', label: '時計表示' },
                        { key: 'attribution', label: '出典表示（気象庁発表）' },
                      ] as { key: LayoutBoxKey; label: string }[]
                    ).map(el => {
                      const box = config.layout[el.key];
                      const isSel = selectedBox === el.key;
                      return (
                        <div
                          key={el.key}
                          onClick={() => setSelectedBox(el.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: isSel ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            backgroundColor: isSel ? '#eff6ff' : '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>{el.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                            <label style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={box.visible}
                                disabled={el.key === 'attribution'}
                                onChange={e =>
                                  setConfig(prev => ({
                                    ...prev,
                                    layout: {
                                      ...prev.layout,
                                      [el.key]: { ...prev.layout[el.key], visible: e.target.checked },
                                    },
                                  }))
                                }
                              />
                              表示
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 選択中要素の座標・サイズ・個別プロパティ */}
                {selectedBox && (
                  <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700 }}>
                      📐 選択中の要素プロパティ: {selectedBox}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {(['x', 'y', 'width', 'height'] as const).map(prop => (
                        <label key={prop} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          {prop === 'x' ? 'X座標 (px)' : prop === 'y' ? 'Y座標 (px)' : prop === 'width' ? '幅 (px)' : '高さ (px)'}
                          <input
                            type="number"
                            value={config.layout[selectedBox][prop]}
                            onChange={e => updateLayoutBox(selectedBox, { [prop]: Number(e.target.value) })}
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </label>
                      ))}
                    </div>

                    {selectedBox === 'sidebar' && (
                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                        <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          タイトル文字列（左サイドバー表示）
                          <input
                            type="text"
                            value={config.layout.sidebar.titleText}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  sidebar: { ...prev.layout.sidebar, titleText: e.target.value },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </label>
                        <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          サブタイトル文字列（任意）
                          <input
                            type="text"
                            value={config.layout.sidebar.subTitleText || ''}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  sidebar: { ...prev.layout.sidebar, subTitleText: e.target.value },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          タイトル左右位置 X ({config.layout.sidebar.titleOffsetX || 0}px)
                          <input
                            type="range"
                            min={-120}
                            max={120}
                            value={config.layout.sidebar.titleOffsetX || 0}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  sidebar: { ...prev.layout.sidebar, titleOffsetX: Number(e.target.value) },
                                },
                              }))
                            }
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          タイトル上下位置 Y ({config.layout.sidebar.titleOffsetY || 0}px)
                          <input
                            type="range"
                            min={-420}
                            max={420}
                            value={config.layout.sidebar.titleOffsetY || 0}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  sidebar: { ...prev.layout.sidebar, titleOffsetY: Number(e.target.value) },
                                },
                              }))
                            }
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          文字方向
                          <select
                            value={config.layout.sidebar.direction}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  sidebar: { ...prev.layout.sidebar, direction: e.target.value as any },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          >
                            <option value="vertical">縦書き</option>
                            <option value="horizontal">横書き</option>
                          </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          文字サイズ (px)
                          <input
                            type="number"
                            min={24}
                            max={72}
                            value={config.layout.sidebar.fontSize}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  sidebar: { ...prev.layout.sidebar, fontSize: Number(e.target.value) },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </label>
                      </div>
                    )}

                    {selectedBox === 'ticker' && (
                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          スクロール速度 (px/秒)
                          <input
                            type="number"
                            min={40}
                            max={240}
                            value={config.layout.ticker.scrollSpeed}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  ticker: { ...prev.layout.ticker, scrollSpeed: Number(e.target.value) },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          文字サイズ (px)
                          <input
                            type="number"
                            min={18}
                            max={48}
                            value={config.layout.ticker.fontSize}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  ticker: { ...prev.layout.ticker, fontSize: Number(e.target.value) },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </label>
                      </div>
                    )}

                    {selectedBox === 'typhoonMap' && (
                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          表示タイミング
                          <select
                            value={config.layout.typhoonMap.displayMode}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  typhoonMap: { ...prev.layout.typhoonMap, displayMode: e.target.value as any },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          >
                            <option value="auto">台風情報発表時のみ自動表示</option>
                            <option value="always">常時表示</option>
                            <option value="manual">非表示</option>
                          </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          地図タイル
                          <select
                            value={config.layout.typhoonMap.tileType}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  typhoonMap: { ...prev.layout.typhoonMap, tileType: e.target.value as any },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          >
                            <option value="osm">OpenStreetMap</option>
                            <option value="gsi">国土地理院（淡色地図）</option>
                            <option value="carto">CartoDB Light</option>
                          </select>
                        </label>
                      </div>
                    )}

                    {selectedBox === 'clock' && (
                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                        <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          フォント種類
                          <select
                            value={config.layout.clock.fontFamily}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  clock: { ...prev.layout.clock, fontFamily: e.target.value },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          >
                            <option value="'Open Sans', sans-serif">Open Sans (Google Fonts / 推奨)</option>
                            <option value="'LINE Seed JP', sans-serif">LINE Seed JP</option>
                            <option value="'Lato', sans-serif">Lato</option>
                            <option value="'Noto Sans JP', sans-serif">Noto Sans JP</option>
                            <option value="sans-serif">システム標準 (sans-serif)</option>
                            <option value="'monospace', monospace">等幅フォント (monospace)</option>
                          </select>
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          時刻文字サイズ ({config.layout.clock.timeFontSize}px)
                          <input
                            type="number"
                            min={18}
                            max={56}
                            value={config.layout.clock.timeFontSize}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  clock: { ...prev.layout.clock, timeFontSize: Number(e.target.value) },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          時刻ウェイト
                          <select
                            value={config.layout.clock.timeFontWeight}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  clock: { ...prev.layout.clock, timeFontWeight: Number(e.target.value) },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          >
                            <option value={900}>900 (Black / 超極太)</option>
                            <option value={800}>800 (ExtraBold / 極太 - 推奨)</option>
                            <option value={700}>700 (Bold / 太字)</option>
                            <option value={600}>600 (SemiBold / 中太)</option>
                            <option value={400}>400 (Regular / 標準)</option>
                          </select>
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          日付文字サイズ ({config.layout.clock.dateFontSize}px)
                          <input
                            type="number"
                            min={10}
                            max={28}
                            value={config.layout.clock.dateFontSize}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  clock: { ...prev.layout.clock, dateFontSize: Number(e.target.value) },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          日付ウェイト
                          <select
                            value={config.layout.clock.dateFontWeight}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  clock: { ...prev.layout.clock, dateFontWeight: Number(e.target.value) },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          >
                            <option value={800}>800 (ExtraBold / 極太)</option>
                            <option value={700}>700 (Bold / 太字 - 推奨)</option>
                            <option value={600}>600 (SemiBold / 中太)</option>
                            <option value={400}>400 (Regular / 標準)</option>
                          </select>
                        </label>

                        <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          日付・曜日の表示形式
                          <select
                            value={config.layout.clock.dateFormatMode || 'alternate'}
                            onChange={e =>
                              setConfig(prev => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  clock: { ...prev.layout.clock, dateFormatMode: e.target.value as any },
                                },
                              }))
                            }
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          >
                            <option value="alternate">定期交互切替 (M月D日(曜日) ⇄ MM/DD (曜日・英字) - 推奨)</option>
                            <option value="ja">日本語表記固定 (例: 11月6日(金))</option>
                            <option value="en">英字表記固定 (例: 11/06(FRI))</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= タブ2: カラー設定 (ColorSettings) ================= */}
          {activeTab === 'colors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🎨 カラープリセット一括適用</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => applyColorPreset('jma')}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    気象庁標準配色
                  </button>
                  <button
                    onClick={() => applyColorPreset('high_contrast')}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#0f172a', color: '#facc15', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    高コントラスト
                  </button>
                  <button
                    onClick={() => applyColorPreset('dark')}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#1e293b', color: '#38bdf8', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    ダークテーマ
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {/* 警報レベル別カラー */}
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '0.92rem', fontWeight: 700 }}>⚠️ 警報・注意報レベル別カラー</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(
                      [
                        { key: 'special', label: '特別警報 (レベル5)' },
                        { key: 'level4', label: '危険警報 (レベル4)' },
                        { key: 'warning', label: '警報 (レベル3)' },
                        { key: 'advisory', label: '注意報 (レベル2)' },
                      ] as const
                    ).map(lv => {
                      const pair = config.colors.warningLevels[lv.key];
                      return (
                        <div key={lv.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span
                            style={{
                              backgroundColor: pair.bg,
                              color: pair.text,
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                            }}
                          >
                            {lv.label}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              背景
                              <input
                                type="color"
                                value={pair.bg}
                                onChange={e =>
                                  setConfig(prev => ({
                                    ...prev,
                                    colors: {
                                      ...prev.colors,
                                      warningLevels: {
                                        ...prev.colors.warningLevels,
                                        [lv.key]: { ...pair, bg: e.target.value },
                                      },
                                    },
                                  }))
                                }
                              />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              文字
                              <input
                                type="color"
                                value={pair.text}
                                onChange={e =>
                                  setConfig(prev => ({
                                    ...prev,
                                    colors: {
                                      ...prev.colors,
                                      warningLevels: {
                                        ...prev.colors.warningLevels,
                                        [lv.key]: { ...pair, text: e.target.value },
                                      },
                                    },
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 震度別カラー */}
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '0.92rem', fontWeight: 700 }}>🔵 震度別カラー (震度1〜7)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {['1', '2', '3', '4', '5弱', '5強', '6弱', '6強', '7'].map(intKey => {
                      const pair = config.colors.seismic[intKey] || { bg: '#2563EB', text: '#FFFFFF' };
                      return (
                        <div key={intKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span
                            style={{
                              backgroundColor: pair.bg,
                              color: pair.text,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                            }}
                          >
                            震度{intKey}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="color"
                              value={pair.bg}
                              title="背景色"
                              onChange={e =>
                                setConfig(prev => ({
                                  ...prev,
                                  colors: {
                                    ...prev.colors,
                                    seismic: {
                                      ...prev.colors.seismic,
                                      [intKey]: { ...pair, bg: e.target.value },
                                    },
                                  },
                                }))
                              }
                            />
                            <input
                              type="color"
                              value={pair.text}
                              title="文字色"
                              onChange={e =>
                                setConfig(prev => ({
                                  ...prev,
                                  colors: {
                                    ...prev.colors,
                                    seismic: {
                                      ...prev.colors.seismic,
                                      [intKey]: { ...pair, text: e.target.value },
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= タブ4: エリアカラー設定 (AreaColorSettings) ================= */}
          {activeTab === 'areaColors' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {/* 左サイドバー配色 */}
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700 }}>🎨 左サイドバー配色設定</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>背景開始色:</span>
                    <input
                      type="color"
                      value={config.areaColors.sidebar.bgStart}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            sidebar: { ...prev.areaColors.sidebar, bgStart: e.target.value },
                          },
                        }))
                      }
                    />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>グラデーション終了色:</span>
                    <input
                      type="color"
                      value={config.areaColors.sidebar.bgEnd}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            sidebar: { ...prev.areaColors.sidebar, bgEnd: e.target.value },
                          },
                        }))
                      }
                    />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>文字色:</span>
                    <input
                      type="color"
                      value={config.areaColors.sidebar.textColor}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            sidebar: { ...prev.areaColors.sidebar, textColor: e.target.value },
                          },
                        }))
                      }
                    />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>右ボーダーライン色:</span>
                    <input
                      type="color"
                      value={config.areaColors.sidebar.borderRightColor}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            sidebar: { ...prev.areaColors.sidebar, borderRightColor: e.target.value },
                          },
                        }))
                      }
                    />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>不透明度 ({Math.round(config.areaColors.sidebar.opacity * 100)}%):</span>
                    <input
                      type="range"
                      min={0.3}
                      max={1}
                      step={0.05}
                      value={config.areaColors.sidebar.opacity}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            sidebar: { ...prev.areaColors.sidebar, opacity: Number(e.target.value) },
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              {/* 下部ティッカー配色 */}
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700 }}>🎨 下部ティッカーバー配色設定</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>背景開始色:</span>
                    <input
                      type="color"
                      value={config.areaColors.ticker.bgStart}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            ticker: { ...prev.areaColors.ticker, bgStart: e.target.value },
                          },
                        }))
                      }
                    />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>グラデーション終了色:</span>
                    <input
                      type="color"
                      value={config.areaColors.ticker.bgEnd}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            ticker: { ...prev.areaColors.ticker, bgEnd: e.target.value },
                          },
                        }))
                      }
                    />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>文字色:</span>
                    <input
                      type="color"
                      value={config.areaColors.ticker.textColor}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            ticker: { ...prev.areaColors.ticker, textColor: e.target.value },
                          },
                        }))
                      }
                    />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>上ボーダーライン色:</span>
                    <input
                      type="color"
                      value={config.areaColors.ticker.borderTopColor}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            ticker: { ...prev.areaColors.ticker, borderTopColor: e.target.value },
                          },
                        }))
                      }
                    />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>不透明度 ({Math.round(config.areaColors.ticker.opacity * 100)}%):</span>
                    <input
                      type="range"
                      min={0.3}
                      max={1}
                      step={0.05}
                      value={config.areaColors.ticker.opacity}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            ticker: { ...prev.areaColors.ticker, opacity: Number(e.target.value) },
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              {/* 下部ティッカー左端（クロスディゾルブ見出しエリア）配色 */}
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700 }}>
                  🎨 下部ティッカー左端（情報種類見出し）配色設定
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem' }}>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569' }}>
                    「警報・注意報」「地震情報」「台風情報」などをクロスディゾルブ表示する左端エリアの配色を設定します（デフォルト: 黒 #000000）。
                  </p>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>背景色 (デフォルト #000000):</span>
                    <input
                      type="color"
                      value={config.areaColors.headerBadge.bgColor}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            headerBadge: { ...prev.areaColors.headerBadge, bgColor: e.target.value },
                          },
                        }))
                      }
                    />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>文字色 (デフォルト #FFFFFF):</span>
                    <input
                      type="color"
                      value={config.areaColors.headerBadge.textColor}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          areaColors: {
                            ...prev.areaColors,
                            headerBadge: { ...prev.areaColors.headerBadge, textColor: e.target.value },
                          },
                        }))
                      }
                    />
                  </label>
                  <button
                    onClick={() =>
                      setConfig(prev => ({
                        ...prev,
                        areaColors: {
                          ...prev.areaColors,
                          headerBadge: {
                            ...prev.areaColors.headerBadge,
                            bgColor: '#000000',
                            textColor: '#FFFFFF',
                          },
                        },
                      }))
                    }
                    style={{
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#000000',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    デフォルト（黒 #000000 / 白文字）に戻す
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= タブ5: データビューア (DataViewer) ================= */}
          {activeTab === 'dataViewer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: `すべて (${telopQueue.length})` },
                    { id: 'warning', label: '気象警報・注意報' },
                    { id: 'earthquake', label: '地震情報' },
                    { id: 'typhoon', label: '台風情報' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setViewerFilter(f.id as any)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: viewerFilter === f.id ? '#2563eb' : '#cbd5e1',
                        backgroundColor: viewerFilter === f.id ? '#eff6ff' : '#fff',
                        color: viewerFilter === f.id ? '#1d4ed8' : '#334155',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={viewerSearch}
                    onChange={e => setViewerSearch(e.target.value)}
                    placeholder="地域・見出しテキストで検索..."
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', minWidth: '220px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {lastUpdated && (
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      DB最終更新: {new Date(lastUpdated).toLocaleString('ja-JP')}
                    </span>
                  )}
                  <button
                    onClick={onRefresh}
                    disabled={loading}
                    style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    {loading ? '更新中...' : 'DB再取得'}
                  </button>
                </div>
              </div>

              {/* テロップ変換済みエントリ一覧 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto' }}>
                {telopQueue
                  .filter(item => {
                    if (viewerFilter !== 'all' && item.rawType !== viewerFilter) return false;
                    if (viewerSearch.trim()) {
                      const q = viewerSearch.trim().toLowerCase();
                      return (
                        item.headlineText.toLowerCase().includes(q) ||
                        (item.areaName || '').toLowerCase().includes(q) ||
                        item.categoryLabel.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map(item => {
                    const isExpanded = selectedViewerItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '12px 16px',
                          backgroundColor: '#fff',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              style={{
                                backgroundColor: item.bgColor,
                                color: item.textColor,
                                padding: '3px 10px',
                                borderRadius: '4px',
                                fontWeight: 800,
                                fontSize: '0.78rem',
                              }}
                            >
                              {item.badgeText || item.categoryLabel}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                              {item.areaName || item.categoryLabel}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              優先度: {item.priority} | {new Date(item.timestamp).toLocaleString('ja-JP')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => setSelectedViewerItemId(isExpanded ? null : item.id)}
                              style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}
                            >
                              {isExpanded ? '詳細を閉じる' : '詳細JSONを表示'}
                            </button>
                            <button
                              onClick={() => setActiveTab('preview')}
                              style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: '4px', border: 'none', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontWeight: 700 }}
                            >
                              テロッププレビューで確認
                            </button>
                          </div>
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#334155', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                          ▶ {item.headlineText}
                        </div>
                        {isExpanded && (
                          <pre
                            style={{
                              marginTop: '10px',
                              padding: '10px',
                              backgroundColor: '#0f172a',
                              color: '#e2e8f0',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              overflowX: 'auto',
                            }}
                          >
                            {JSON.stringify(item.rawData || item, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ================= タブ7: 詳細設定 (AdvancedSettings) ================= */}
          {activeTab === 'advanced' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700 }}>⚙️ フォント・出典表示設定</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>
                    フォントファミリー
                    <select
                      value={config.advanced.fontFamily}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          advanced: { ...prev.advanced, fontFamily: e.target.value },
                        }))
                      }
                      style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="'LINE Seed JP', 'Noto Sans JP', sans-serif">LINE Seed JP (標準)</option>
                      <option value="'Noto Sans JP', sans-serif">Noto Sans JP</option>
                      <option value="'Zen Kaku Gothic New', sans-serif">Zen Kaku Gothic</option>
                      <option value="'BIZ UDPGothic', sans-serif">BIZ UDPゴシック</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>
                    出典表示テキスト（気象業務法に基づき「気象庁発表」を含めます）
                    <input
                      type="text"
                      value={config.advanced.attributionText}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          advanced: { ...prev.advanced, attributionText: e.target.value },
                        }))
                      }
                      style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </label>

                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                    <span>出典フォントサイズ ({config.advanced.attributionFontSize}px):</span>
                    <input
                      type="number"
                      min={12}
                      max={32}
                      value={config.advanced.attributionFontSize}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          advanced: { ...prev.advanced, attributionFontSize: Number(e.target.value) },
                        }))
                      }
                      style={{ width: '80px', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700 }}>💾 プリセット・設定JSON管理</h4>
                <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: '#64748b' }}>
                  現在のL字テロップ設定（地域フィルタ・配色・レイアウト座標）をJSONファイルとして保存・復元できます。
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <button
                    onClick={handleExportJson}
                    style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-download" style={{ marginRight: '6px' }}></i>
                    設定JSONをエクスポート
                  </button>

                  <label
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#fff',
                      color: '#1e293b',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fa-solid fa-upload" style={{ marginRight: '6px' }}></i>
                    設定JSONをインポート
                    <input type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
                  </label>

                  <button
                    onClick={() => {
                      setConfig(DEFAULT_LTELOP_CONFIG);
                      addLog('[INFO] 全てのL字テロップ設定を初期値にリセットしました');
                    }}
                    style={{ padding: '8px 14px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    全設定を初期値にリセット
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

