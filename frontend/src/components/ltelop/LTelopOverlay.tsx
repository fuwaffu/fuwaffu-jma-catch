import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { drawTyphoon } from '../../utils/drawTyphoon';
import { formatIntensity } from '../../EarthquakeDetailView';
import { formatRegionName } from '../../utils/lTelopEngine';
import type { LTelopConfig, TelopItem, TickerBadgeInfo } from '../../types/lTelopTypes';

export type LayoutBoxKey =
  | 'sidebar'
  | 'ticker'
  | 'typhoonMap'
  | 'earthquakePanel'
  | 'clock'
  | 'attribution';

interface LTelopOverlayProps {
  config: LTelopConfig;
  items: TelopItem[];
  isObs?: boolean;
  scale?: number;
  backgroundMode?: 'transparent' | 'checker' | 'sample_stream' | 'dark_grid';
  editableLayout?: boolean;
  selectedBox?: LayoutBoxKey | null;
  onSelectBox?: (key: LayoutBoxKey) => void;
  onUpdateBox?: (key: LayoutBoxKey, patch: { x?: number; y?: number; width?: number; height?: number }) => void;
  snapGrid?: boolean;
  showSafeArea?: boolean;
}

const BOX_LABELS: Record<LayoutBoxKey, string> = {
  sidebar: '左サイドバー (16:9連動)',
  ticker: '下部ティッカー (16:9連動)',
  typhoonMap: '台風MAP',
  earthquakePanel: '地震情報パネル',
  clock: '時計表示',
  attribution: '出典表示',
};

/**
 * 下部ティッカー左端の警報・情報種別ボックス（クロスディゾルブ切替）
 */
function CrossDissolveTickerBadge({
  badge,
  fontSize,
  width,
  borderRightWidth,
  borderRightColor,
}: {
  badge: TickerBadgeInfo;
  fontSize: number;
  width: number;
  borderRightWidth: number;
  borderRightColor: string;
}) {
  const [layers, setLayers] = useState<{
    prev: TickerBadgeInfo | null;
    current: TickerBadgeInfo;
    fadingIn: boolean;
    key: number;
  }>({
    prev: null,
    current: badge,
    fadingIn: false,
    key: 0,
  });

  const badgeSig = `${badge.label}|${badge.subLabel || ''}|${badge.bgColor}|${badge.textColor}`;
  const lastSigRef = useRef(badgeSig);

  useEffect(() => {
    if (badgeSig === lastSigRef.current) return;
    lastSigRef.current = badgeSig;

    setLayers(prevState => ({
      prev: prevState.current,
      current: badge,
      fadingIn: false,
      key: prevState.key + 1,
    }));

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        setLayers(prevState => ({ ...prevState, fadingIn: true }));
      });
      return () => cancelAnimationFrame(raf2);
    });

    const cleanupTimer = setTimeout(() => {
      setLayers(prevState => ({ ...prevState, prev: null, fadingIn: true }));
    }, 680);

    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(cleanupTimer);
    };
  }, [badgeSig, badge]);

  const renderBadgeContent = (b: TickerBadgeInfo) => {
    const innerAvailW = Math.max(48, width - 12);
    const charCount = Math.max(1, (b.label || '').length);
    const maxFitFont = Math.floor(innerAvailW / charCount);
    const baseMainFont = Math.round(fontSize * (b.subLabel ? 0.68 : 0.78));
    const computedMainFont = Math.max(11, Math.min(baseMainFont, maxFitFont));
    const computedSubFont = Math.max(9, Math.min(Math.round(fontSize * 0.38), Math.floor(innerAvailW / Math.max(4, (b.subLabel || '').length))));

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: b.bgColor,
          color: b.textColor,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 6px',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {b.subLabel && (
          <span
            style={{
              fontSize: `${computedSubFont}px`,
              fontWeight: 800,
              lineHeight: 1.1,
              opacity: 0.92,
              marginBottom: '2px',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {b.subLabel}
          </span>
        )}
        <span
          style={{
            fontSize: `${computedMainFont}px`,
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '0px',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {b.label}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        zIndex: 5,
        height: '100%',
        width: `${width}px`,
        borderRight: borderRightWidth > 0 ? `${borderRightWidth}px solid ${borderRightColor}` : 'none',
        boxSizing: 'border-box',
        position: 'relative',
        boxShadow: '4px 0 12px rgba(0,0,0,0.45)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* 前の表示（クロスディゾルブでフェードアウト） */}
      {layers.prev && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: layers.fadingIn ? 0 : 1,
            transition: 'opacity 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'opacity',
          }}
        >
          {renderBadgeContent(layers.prev)}
        </div>
      )}

      {/* 現在の表示（クロスディゾルブでフェードイン） */}
      <div
        key={layers.key}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: layers.prev ? (layers.fadingIn ? 1 : 0) : 1,
          transition: layers.prev ? 'opacity 0.65s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          willChange: 'opacity',
        }}
      >
        {renderBadgeContent(layers.current)}
      </div>
    </div>
  );
}

export default function LTelopOverlay({
  config,
  items,
  isObs = false,
  scale = 1,
  backgroundMode = 'transparent',
  editableLayout = false,
  selectedBox = null,
  onSelectBox,
  onUpdateBox,
  snapGrid = true,
  showSafeArea = false,
}: LTelopOverlayProps) {
  const activeTyphoonItem = items.find(i => i.rawType === 'typhoon' && i.rawData);
  const activeEarthquakeItem = items.find(i => i.rawType === 'earthquake' && i.rawData);

  // 時計ステート
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // 時計の日付表示切替ステート（「M月D日(曜日)」と「MM/DD (曜日・英字)」の定期切替）
  const [dateToggle, setDateToggle] = useState<'ja' | 'en'>('ja');
  useEffect(() => {
    const timer = setInterval(() => {
      setDateToggle(prev => (prev === 'ja' ? 'en' : 'ja'));
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // アイテムから情報種類見出し名を算出するヘルパー
  const getItemHeadingLabel = (item: TelopItem): string => {
    if (
      item.rawType === 'warning' ||
      item.category === 'warning' ||
      item.category === 'advisory' ||
      item.category === 'special_warning'
    ) {
      return '警報・注意報';
    }
    if (item.rawType === 'earthquake' || item.category === 'earthquake') {
      return '地震情報';
    }
    if (item.rawType === 'typhoon' || item.category === 'typhoon') {
      return '台風情報';
    }
    if (item.category === 'tsunami_warning' || item.category === 'tsunami_advisory') {
      return '津波情報';
    }
    if (item.category === 'volcano') {
      return '噴火情報';
    }
    if (item.category === 'tornado') {
      return '竜巻注意情報';
    }
    if (item.category === 'heavy_rain') {
      return '記録的短時間大雨情報';
    }
    if (item.category === 'landslide') {
      return '土砂災害警戒情報';
    }
    return item.categoryLabel || '防災・気象情報';
  };

  // 各情報種類ごとにグループ化（同じ見出しの情報を出し切ってから次の見出しへ切り替える）
  const categoryGroups = useMemo<{ headingLabel: string; items: TelopItem[] }[]>(() => {
    const map = new Map<string, TelopItem[]>();
    for (const item of items) {
      const heading = getItemHeadingLabel(item);
      const list = map.get(heading);
      if (list) {
        list.push(item);
      } else {
        map.set(heading, [item]);
      }
    }
    return Array.from(map.entries()).map(([headingLabel, groupItems]) => ({
      headingLabel,
      items: groupItems,
    }));
  }, [items]);

  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const hasSwitchedOnceRef = useRef(false);

  const safeGroupIdx = categoryGroups.length > 0 ? activeGroupIdx % categoryGroups.length : 0;
  const activeGroup = categoryGroups[safeGroupIdx] || null;
  const activeGroupItems = activeGroup ? activeGroup.items : [];

  // 現在表示すべき下部ティッカー左端のバッジ情報を算出（情報の種類名を原則黒・別途設定色でクロスディゾルブ表示）
  const currentTickerBadge = useMemo<TickerBadgeInfo>(() => {
    return {
      label: activeGroup ? activeGroup.headingLabel : '防災・気象情報',
      bgColor: config.areaColors.headerBadge.bgColor,
      textColor: config.areaColors.headerBadge.textColor,
    };
  }, [activeGroup, config.areaColors.headerBadge]);

  // ティッカー60fps requestAnimationFrame スクロール（現在の情報種類を出し切ったら次の情報種類見出しへ切り替え）
  const tickerContainerRef = useRef<HTMLDivElement>(null);
  const tickerViewportRef = useRef<HTMLDivElement>(null);
  const tickerTrackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<number>(0);

  const activeGroupSignature = activeGroup
    ? `${activeGroup.headingLabel}::${activeGroup.items.map(i => `${i.id}:${i.headlineText}`).join('||')}`
    : 'empty';

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    // 情報種類見出しが切り替わった直後はクロスディゾルブが完了するまでスクロール開始を待機 (700ms)
    const holdUntil =
      hasSwitchedOnceRef.current && categoryGroups.length > 1 ? performance.now() + 700 : 0;

    const viewportEl = tickerViewportRef.current;
    const trackEl = tickerTrackRef.current;
    if (!viewportEl || !trackEl) return;

    const containerWidth = viewportEl.clientWidth || 1600;
    const dir = config.layout.ticker.scrollDirection;
    offsetRef.current = dir === 'rtl' ? containerWidth : -trackEl.scrollWidth;
    trackEl.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;

    let switched = false;

    const step = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      if (time < holdUntil) {
        animId = requestAnimationFrame(step);
        return;
      }

      const speed = Math.max(20, config.layout.ticker.scrollSpeed || 80);
      const trackWidth = trackEl.scrollWidth || 800;
      const cw = viewportEl.clientWidth || 1600;

      if (dir === 'rtl') {
        offsetRef.current -= speed * dt;
        if (offsetRef.current < -trackWidth) {
          if (categoryGroups.length > 1 && !switched) {
            switched = true;
            hasSwitchedOnceRef.current = true;
            setActiveGroupIdx(prev => (prev + 1) % categoryGroups.length);
            return;
          }
          offsetRef.current = cw;
        }
      } else {
        offsetRef.current += speed * dt;
        if (offsetRef.current > cw) {
          if (categoryGroups.length > 1 && !switched) {
            switched = true;
            hasSwitchedOnceRef.current = true;
            setActiveGroupIdx(prev => (prev + 1) % categoryGroups.length);
            return;
          }
          offsetRef.current = -trackWidth;
        }
      }

      trackEl.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [
    activeGroupSignature,
    safeGroupIdx,
    categoryGroups.length,
    config.layout.ticker.scrollSpeed,
    config.layout.ticker.scrollDirection,
  ]);

  // 台風ミニマップ描画 (Leaflet)
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const shouldShowTyphoonMap =
    config.layout.typhoonMap.visible &&
    (editableLayout ||
      config.layout.typhoonMap.displayMode === 'always' ||
      (config.layout.typhoonMap.displayMode === 'auto' && Boolean(activeTyphoonItem)));

  useEffect(() => {
    if (!shouldShowTyphoonMap || !mapContainerRef.current) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false,
      }).setView([31.5, 136.0], 5);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    map.invalidateSize();

    map.eachLayer(layer => {
      map.removeLayer(layer);
    });

    const tileUrl =
      config.layout.typhoonMap.tileType === 'gsi'
        ? 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
        : config.layout.typhoonMap.tileType === 'carto'
        ? 'https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl, { maxZoom: 12 }).addTo(map);

    if (activeTyphoonItem?.rawData) {
      const ty = activeTyphoonItem.rawData;
      const trackPoints = drawTyphoon(map, ty, { isObs: true, use24HourFormat: true });
      if (trackPoints.length > 1) {
        map.fitBounds(L.latLngBounds(trackPoints).pad(0.25), { maxZoom: 6 });
      } else if (ty.current?.lat && ty.current?.lon) {
        map.setView([ty.current.lat, ty.current.lon], 5);
      }
    } else {
      map.setView([33.0, 136.0], 4);
    }
  }, [
    shouldShowTyphoonMap,
    activeTyphoonItem,
    config.layout.typhoonMap.tileType,
    config.layout.typhoonMap.width,
    config.layout.typhoonMap.height,
  ]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // D&D 移動・リサイズハンドラ（レイアウトエディタ用）
  const dragStateRef = useRef<{
    key: LayoutBoxKey;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const handlePointerDown = (
    e: React.PointerEvent,
    key: LayoutBoxKey,
    mode: 'move' | 'resize'
  ) => {
    if (!editableLayout || !onUpdateBox) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectBox?.(key);
    const box = config.layout[key];
    if (box.locked) return;
    // 左サイドバーと下部ティッカーは16:9枠として固定位置のため移動(move)は無効化し、選択とリサイズのみ許可
    if ((key === 'sidebar' || key === 'ticker') && mode === 'move') return;

    dragStateRef.current = {
      key,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: box.x,
      origY: box.y,
      origW: box.width,
      origH: box.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st || !editableLayout || !onUpdateBox) return;
    const dx = (e.clientX - st.startX) / (scale || 1);
    const dy = (e.clientY - st.startY) / (scale || 1);
    const snap = (v: number) => (snapGrid ? Math.round(v / 10) * 10 : Math.round(v));

    if (st.mode === 'move') {
      const nextX = Math.max(0, Math.min(1920 - st.origW, snap(st.origX + dx)));
      const nextY = Math.max(0, Math.min(1080 - st.origH, snap(st.origY + dy)));
      onUpdateBox(st.key, { x: nextX, y: nextY });
    } else {
      if (st.key === 'sidebar') {
        const nextW = Math.max(64, Math.min(480, Math.round(st.origW + dx)));
        onUpdateBox('sidebar', { width: nextW });
      } else if (st.key === 'ticker') {
        // 下部ティッカーのリサイズハンドルは上下ドラッグで高さを変更可能に
        const nextH = Math.max(36, Math.min(270, Math.round(st.origH - dy)));
        onUpdateBox('ticker', { height: nextH });
      } else {
        const nextW = Math.max(60, Math.min(1920 - st.origX, snap(st.origW + dx)));
        const nextH = Math.max(36, Math.min(1080 - st.origY, snap(st.origH + dy)));
        onUpdateBox(st.key, { width: nextW, height: nextH });
      }
    }
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
  };

  const renderEditableFrame = (key: LayoutBoxKey, children: React.ReactNode) => {
    const box = config.layout[key];
    if (!box.visible && !editableLayout) return null;

    const isSelected = editableLayout && selectedBox === key;
    const isLFrame = key === 'sidebar' || key === 'ticker';

    return (
      <div
        key={key}
        onPointerDown={e => handlePointerDown(e, key, 'move')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'absolute',
          left: `${box.x}px`,
          top: `${box.y}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
          opacity: box.visible ? 1 : 0.35,
          cursor: editableLayout ? (isLFrame ? 'pointer' : box.locked ? 'not-allowed' : 'move') : 'default',
          outline: editableLayout
            ? isSelected
              ? '3px solid #38bdf8'
              : '1.5px dashed rgba(255,255,255,0.55)'
            : 'none',
          zIndex: isSelected ? 50 : isLFrame ? 20 : 30,
          boxSizing: 'border-box',
          userSelect: 'none',
        }}
      >
        {children}
        {editableLayout && (
          <>
            <div
              style={{
                position: 'absolute',
                top: key === 'sidebar' ? '6px' : '-24px',
                left: key === 'sidebar' ? '6px' : 0,
                background: isSelected ? '#0284c7' : 'rgba(15,23,42,0.85)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 65,
              }}
            >
              {BOX_LABELS[key]} ({box.width}×{box.height})
              {!box.visible ? ' [非表示]' : ''}
            </div>
            {!box.locked && (
              <div
                onPointerDown={e => handlePointerDown(e, key, 'resize')}
                style={{
                  position: 'absolute',
                  right: key === 'ticker' ? '24px' : '-6px',
                  top: key === 'ticker' ? '-8px' : undefined,
                  bottom: key === 'ticker' ? undefined : '-6px',
                  width: '18px',
                  height: '18px',
                  backgroundColor: '#38bdf8',
                  border: '2px solid #ffffff',
                  borderRadius: '4px',
                  cursor: key === 'sidebar' ? 'ew-resize' : key === 'ticker' ? 'ns-resize' : 'nwse-resize',
                  zIndex: 60,
                }}
                title={
                  isLFrame
                    ? 'ドラッグしてサイズ変更（中の画面16:9比率を自動維持）'
                    : 'ドラッグしてサイズ変更'
                }
              />
            )}
          </>
        )}
      </div>
    );
  };

  // 背景スタイル（プレビュー用 / OBS時は完全透過）
  const getCanvasBackground = (): React.CSSProperties => {
    if (isObs || backgroundMode === 'transparent') {
      return { backgroundColor: 'transparent' };
    }
    if (backgroundMode === 'checker') {
      return {
        backgroundImage:
          'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
        backgroundSize: '32px 32px',
        backgroundPosition: '0 0, 0 16px, 16px -16px, -16px 0',
        backgroundColor: '#f8fafc',
      };
    }
    if (backgroundMode === 'sample_stream') {
      return {
        background: 'radial-gradient(circle at 60% 40%, #1e3a8a 0%, #0f172a 65%, #020617 100%)',
      };
    }
    return {
      backgroundColor: '#0f172a',
      backgroundImage:
        'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    };
  };

  const sbColor = config.areaColors.sidebar;
  const tkColor = config.areaColors.ticker;
  const innerWidth = 1920 - config.layout.sidebar.width;
  const innerHeight = 1080 - config.layout.ticker.height;

  return (
    <div
      style={{
        width: '1920px',
        height: '1080px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: config.advanced.fontFamily,
        pointerEvents: isObs ? 'none' : 'auto',
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top left',
        border:
          config.areaColors.frameBorder.width > 0
            ? `${config.areaColors.frameBorder.width}px solid ${config.areaColors.frameBorder.color}`
            : undefined,
        boxSizing: 'border-box',
        ...getCanvasBackground(),
      }}
    >
      {/* 中の画面（16:9 映像表示エリア）プレースホルダー */}
      {!isObs && (backgroundMode === 'sample_stream' || editableLayout) && (
        <div
          style={{
            position: 'absolute',
            left: `${config.layout.sidebar.width}px`,
            top: 0,
            width: `${innerWidth}px`,
            height: `${innerHeight}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.22)',
            border: editableLayout ? '2px dashed rgba(56, 189, 248, 0.5)' : 'none',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <i className="fa-solid fa-video" style={{ fontSize: '84px', marginBottom: '16px' }}></i>
          <div style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '3px' }}>
            映像表示エリア ({innerWidth} × {innerHeight} px / 16:9 比率維持)
          </div>
          <div style={{ fontSize: '19px', marginTop: '8px' }}>
            本番のOBSブラウザソースではこの領域が完全透過されます
          </div>
        </div>
      )}

      {/* 放送セーフエリア & 中心線ガイド */}
      {editableLayout && showSafeArea && (
        <>
          <div
            style={{
              position: 'absolute',
              left: '5%',
              top: '5%',
              width: '90%',
              height: '90%',
              border: '2px dashed rgba(250, 204, 21, 0.55)',
              pointerEvents: 'none',
              zIndex: 45,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              borderLeft: '1px dashed rgba(56, 189, 248, 0.4)',
              pointerEvents: 'none',
              zIndex: 45,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              borderTop: '1px dashed rgba(56, 189, 248, 0.4)',
              pointerEvents: 'none',
              zIndex: 45,
            }}
          />
        </>
      )}

      {/* 1. 左サイドバー（タイトル専用表示エリア・文字と位置を自由に調整可能） */}
      {renderEditableFrame(
        'sidebar',
        <div
          style={{
            width: '100%',
            height: '100%',
            background: sbColor.useGradient
              ? `linear-gradient(${sbColor.gradientDeg}deg, ${sbColor.bgStart}, ${sbColor.bgEnd})`
              : sbColor.bgStart,
            color: sbColor.textColor,
            opacity: sbColor.opacity,
            borderRight:
              sbColor.borderRightWidth > 0
                ? `${sbColor.borderRightWidth}px solid ${sbColor.borderRightColor}`
                : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 8px',
            boxSizing: 'border-box',
            boxShadow: '4px 0 20px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* ユーザー設定タイトル & 位置オフセット */}
          <div
            style={{
              transform: `translate3d(${config.layout.sidebar.titleOffsetX || 0}px, ${config.layout.sidebar.titleOffsetY || 0}px, 0)`,
              display: 'flex',
              flexDirection: config.layout.sidebar.direction === 'vertical' ? 'row-reverse' : 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                writingMode:
                  config.layout.sidebar.direction === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                textOrientation: 'upright',
                fontSize: `${config.layout.sidebar.fontSize}px`,
                fontWeight: 900,
                letterSpacing: `${config.layout.sidebar.letterSpacing}px`,
                lineHeight: 1.2,
                textShadow: '0 3px 8px rgba(0,0,0,0.55)',
                whiteSpace: 'pre-wrap',
                textAlign: 'center',
              }}
            >
              {config.layout.sidebar.titleText || '気象・防災情報'}
            </div>

            {config.layout.sidebar.subTitleText && (
              <div
                style={{
                  writingMode:
                    config.layout.sidebar.direction === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                  textOrientation: 'upright',
                  fontSize: `${Math.max(14, Math.round(config.layout.sidebar.fontSize * 0.45))}px`,
                  fontWeight: 700,
                  letterSpacing: '2px',
                  opacity: 0.9,
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  whiteSpace: 'pre-wrap',
                  textAlign: 'center',
                }}
              >
                {config.layout.sidebar.subTitleText}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. 下部スクロールティッカー */}
      {renderEditableFrame(
        'ticker',
        <div
          ref={tickerContainerRef}
          style={{
            width: '100%',
            height: '100%',
            background: tkColor.useGradient
              ? `linear-gradient(to bottom, ${tkColor.bgStart}, ${tkColor.bgEnd})`
              : tkColor.bgStart,
            color: tkColor.textColor,
            opacity: tkColor.opacity,
            borderTop:
              tkColor.borderTopWidth > 0
                ? `${tkColor.borderTopWidth}px solid ${tkColor.borderTopColor}`
                : 'none',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            position: 'relative',
            boxSizing: 'border-box',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {/* 左端：左サイドバーと同じ幅で、警報・情報内容に合わせてクロスディゾルブで切り替わるラベルボックス */}
          <CrossDissolveTickerBadge
            badge={currentTickerBadge}
            fontSize={config.layout.ticker.fontSize}
            width={config.layout.sidebar.width}
            borderRightWidth={sbColor.borderRightWidth}
            borderRightColor={sbColor.borderRightColor}
          />

          {/* スクロールトラック */}
          <div
            ref={tickerViewportRef}
            style={{
              flex: 1,
              height: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              ref={tickerTrackRef}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '64px',
                whiteSpace: 'nowrap',
                willChange: 'transform',
                fontSize: `${config.layout.ticker.fontSize}px`,
                fontWeight: 700,
                paddingLeft: '24px',
              }}
            >
              {activeGroupItems.length > 0 ? (
                activeGroupItems.map(item => {
                  const prefText = item.prefectureName || item.areaName;
                  const subArea =
                    item.subAreaName && item.subAreaName !== prefText ? item.subAreaName : '';
                  let areaDisplayText = prefText;
                  if (subArea) {
                    const isRegion =
                      item.areaLevel === 'region' || config.info.warningAreaLevel === 'region';
                    if (isRegion) {
                      const formattedRegion = formatRegionName(subArea);
                      areaDisplayText = `${prefText}　${formattedRegion}`;
                    } else {
                      areaDisplayText = `${prefText}・${subArea}`;
                    }
                  }
                  return (
                    <span
                      key={item.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      {item.inlineBadges && item.inlineBadges.length > 0 ? (
                        <>
                          <span style={{ fontWeight: 900 }}>
                            {areaDisplayText}
                          </span>
                          {item.inlineBadges.map((wb, wbIdx) => (
                            <span
                              key={`${item.id}-wb-${wbIdx}`}
                              style={{
                                backgroundColor: wb.bgColor,
                                color: wb.textColor,
                                padding: '3px 12px',
                                borderRadius: '6px',
                                fontSize: `${Math.max(16, Math.round(config.layout.ticker.fontSize * 0.75))}px`,
                                fontWeight: 900,
                              }}
                            >
                              {wb.label}
                            </span>
                          ))}
                        </>
                      ) : (
                        <>
                          {(item.badgeText || item.categoryLabel) && (
                            <span
                              style={{
                                backgroundColor: item.bgColor,
                                color: item.textColor,
                                padding: '3px 12px',
                                borderRadius: '6px',
                                fontSize: `${Math.max(16, Math.round(config.layout.ticker.fontSize * 0.75))}px`,
                                fontWeight: 900,
                              }}
                            >
                              {item.badgeText || item.categoryLabel}
                            </span>
                          )}
                          <span>{item.headlineText}</span>
                        </>
                      )}
                    </span>
                  );
                })
              ) : (
                <span>
                  現在、表示対象の特別警報・警報・地震・台風情報はありません（気象庁発表）
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. 台風ミニMAP */}
      {shouldShowTyphoonMap &&
        renderEditableFrame(
          'typhoonMap',
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.25)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            <div
              style={{
                padding: '6px 14px',
                background: 'linear-gradient(90deg, #0284c7, #1e3a8a)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10,
              }}
            >
              <span>
                🌀{' '}
                {activeTyphoonItem
                  ? `${activeTyphoonItem.badgeText || activeTyphoonItem.categoryLabel} 進路予想図`
                  : '台風進路マップ（待機中）'}
              </span>
              <span style={{ fontSize: '12px', opacity: 0.9 }}>気象庁発表</span>
            </div>
            <div ref={mapContainerRef} style={{ flex: 1, width: '100%', minHeight: 0 }} />
          </div>
        )}

      {/* 4. 地震情報パネル */}
      {(editableLayout || (config.layout.earthquakePanel.visible && activeEarthquakeItem)) &&
        renderEditableFrame(
          'earthquakePanel',
          (() => {
            const eq = activeEarthquakeItem?.rawData;
            const maxInt = eq ? formatIntensity(eq.maxIntensity) : '—';
            const intColor = config.colors.seismic[maxInt] || { bg: '#2563eb', text: '#fff' };
            return (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'rgba(15, 23, 42, 0.9)',
                  borderLeft: `8px solid ${intColor.bg}`,
                  borderRadius: '0 12px 12px 0',
                  padding: '14px 20px',
                  color: '#fff',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#93c5fd' }}>
                    震源・震度情報
                  </span>
                  <span
                    style={{
                      backgroundColor: intColor.bg,
                      color: intColor.text,
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '20px',
                      fontWeight: 900,
                    }}
                  >
                    最大震度 {maxInt}
                  </span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, lineHeight: 1.2 }}>
                  {eq?.hypocenterName || '地震情報パネル（自動表示）'}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '17px',
                    color: '#cbd5e1',
                    borderTop: '1px solid rgba(255,255,255,0.12)',
                    paddingTop: '8px',
                  }}
                >
                  <span>
                    規模: <strong style={{ color: '#38bdf8' }}>{eq?.magnitude ? `M${eq.magnitude}` : '—'}</strong>
                    {' / '}
                    深さ:{' '}
                    <strong style={{ color: '#fbbf24' }}>
                      {eq?.depth != null ? (eq.depth === 0 ? 'ごく浅い' : `約${eq.depth}km`) : '—'}
                    </strong>
                  </span>
                  <span style={{ fontSize: '13px', opacity: 0.85 }}>気象庁発表</span>
                </div>
              </div>
            );
          })()
        )}

      {/* 5. 時計表示 */}
      {renderEditableFrame(
        'clock',
        (() => {
          const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
          const WEEKDAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          const weekdayIdx = now.getDay();
          const weekdayJa = WEEKDAYS_JA[weekdayIdx];
          const weekdayEn = WEEKDAYS_EN[weekdayIdx];
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          const month = now.getMonth() + 1;
          const date = now.getDate();

          const clockCfg = config.layout.clock;
          const clockFontFamily = clockCfg?.fontFamily || "'Open Sans', sans-serif";
          const timeWeight = clockCfg?.timeFontWeight ?? 800;
          const timeSize = clockCfg?.timeFontSize ?? 32;
          const dateWeight = clockCfg?.dateFontWeight ?? 700;
          const dateSize = clockCfg?.dateFontSize ?? 13;
          const formatMode = clockCfg?.dateFormatMode || 'alternate';
          const isEn = formatMode === 'en' || (formatMode === 'alternate' && dateToggle === 'en');

          return (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'rgba(15, 23, 42, 0.88)',
                color: '#ffffff',
                borderRadius: '12px',
                border: '1.5px solid rgba(255,255,255,0.22)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 8px',
                boxSizing: 'border-box',
                boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
                userSelect: 'none',
              }}
            >
              {/* 上段: 時計 (時:分、秒数なし、設定フォント・ウェイト・サイズ) */}
              <div
                style={{
                  fontFamily: `${clockFontFamily}, 'Lato', sans-serif`,
                  fontWeight: timeWeight,
                  fontSize: `${timeSize}px`,
                  lineHeight: 1,
                  letterSpacing: '0.5px',
                  color: '#ffffff',
                  textShadow: '0 2px 8px rgba(0,0,0,0.55)',
                }}
              >
                {hours}:{minutes}
              </div>

              {/* 区切り線 ----- */}
              <div
                style={{
                  width: '80%',
                  height: '1px',
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  margin: '7px 0 6px 0',
                }}
              />

              {/* 下段: 日付(曜日) (「M月D日(曜日)」と「MM/DD (曜日・英字)」の定期切替) */}
              <div
                key={isEn ? 'date-en' : 'date-ja'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: `${dateSize}px`,
                  lineHeight: 1,
                  fontWeight: dateWeight,
                  color: '#e2e8f0',
                  gap: '1px',
                  whiteSpace: 'nowrap',
                }}
              >
                {isEn ? (
                  <>
                    <span
                      style={{
                        fontFamily: `${clockFontFamily}, 'Lato', sans-serif`,
                        fontWeight: dateWeight,
                        color: '#ffffff',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {String(month).padStart(2, '0')}/{String(date).padStart(2, '0')}
                    </span>
                    <span
                      style={{
                        marginLeft: '3px',
                        fontFamily: `${clockFontFamily}, 'Lato', sans-serif`,
                        fontSize: `${Math.max(10, Math.round(dateSize * 0.88))}px`,
                        fontWeight: dateWeight,
                        color: weekdayJa === '日' ? '#f87171' : weekdayJa === '土' ? '#60a5fa' : '#cbd5e1',
                        letterSpacing: '0.5px',
                      }}
                    >
                      ({weekdayEn})
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        fontFamily: `${clockFontFamily}, 'Lato', sans-serif`,
                        fontWeight: dateWeight,
                        color: '#ffffff',
                      }}
                    >
                      {month}
                    </span>
                    <span style={{ fontSize: `${Math.max(10, Math.round(dateSize * 0.85))}px`, opacity: 0.9 }}>月</span>
                    <span
                      style={{
                        fontFamily: `${clockFontFamily}, 'Lato', sans-serif`,
                        fontWeight: dateWeight,
                        color: '#ffffff',
                      }}
                    >
                      {date}
                    </span>
                    <span style={{ fontSize: `${Math.max(10, Math.round(dateSize * 0.85))}px`, opacity: 0.9 }}>日</span>
                    <span
                      style={{
                        marginLeft: '2px',
                        fontSize: `${Math.max(10, Math.round(dateSize * 0.92))}px`,
                        fontWeight: dateWeight,
                        color: weekdayJa === '日' ? '#f87171' : weekdayJa === '土' ? '#60a5fa' : '#cbd5e1',
                      }}
                    >
                      ({weekdayJa})
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* 6. 出典表示（R1: 気象庁発表の常時明示） */}
      {renderEditableFrame(
        'attribution',
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'rgba(15, 23, 42, 0.82)',
            color: '#ffffff',
            opacity: config.advanced.attributionOpacity,
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 14px',
            boxSizing: 'border-box',
            fontSize: `${config.advanced.attributionFontSize}px`,
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          }}
        >
          出典：{config.advanced.attributionText.includes('気象庁')
            ? config.advanced.attributionText
            : `${config.advanced.attributionText}（気象庁発表）`}
        </div>
      )}
    </div>
  );
}
