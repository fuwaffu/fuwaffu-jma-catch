---
name: l-telop
description: >
  気象庁防災情報XMLフォーマット（PULL型）を活用したL字テロップシステムの構築・修正・拡張を行う際のルールと手順。
  データ取得、XMLパース、表示ロジック、法的遵守事項を含む。
---

# L字テロップシステム 構築スキル

## 概要

このスキルは、気象庁防災情報XMLを使ったL字テロップシステムを構築・修正する際に従うべきルールと手順を定義する。

## 参照ドキュメント

実装の前に、以下の仕様書を必ず確認すること：

- [L_TELOP_SPEC.md](file:///d:/dev-space/weather_Lterop/docs/L_TELOP_SPEC.md) - システム技術仕様書
- [L_TELOP_ADMIN_SPEC.md](file:///d:/dev-space/weather_Lterop/docs/L_TELOP_ADMIN_SPEC.md) - 管理画面仕様書

## 技術スタック

| 項目 | 技術 |
|---|---|
| オーバーレイ表示 | HTML / CSS / JavaScript（OBSブラウザソース） |
| 管理画面 | Vite + React + TypeScript |
| 台風MAP | Leaflet.js v1.9+ |
| 状態管理 | localStorage（管理画面 ↔ オーバーレイ間同期） |

---

## ルール

### R1: 法的遵守（最重要）

以下は**絶対に遵守**しなければならない：

1. **予報値の独自編集禁止**: 気象庁が発表した情報をそのまま表示する。テキストの要約・言い換え・省略はしない
2. **Status確認**: `<Status>通常</Status>`の電文のみ本番表示する。`訓練`・`試験`は表示しない
3. **InfoType処理**: `取消`電文を受信したら該当情報を即座に消去する
4. **出典明示**: 「気象庁発表」の出典を常にオーバーレイ上に表示する
5. **アクセス制限**: 1日10GB未満のダウンロード量に抑える。一度取得したXMLは再取得しない

### R2: データ取得

1. **Atomフィードのポーリング**: 最小60秒間隔
2. **重複排除**: `<id>`要素をキーとしてSet管理。既知のIDはスキップ
3. **差分取得**: `<updated>`タイムスタンプで新着判定
4. **CORSプロキシ**: ブラウザから直接アクセスできない場合はCORSプロキシを経由。プロキシURLは管理画面の詳細設定で指定可能にする
5. **エラーハンドリング**: ネットワークエラー時はコンソールログ + 次回リトライ。画面にはフォールバック表示

### R3: XMLパース

1. **名前空間の考慮**: 気象庁XMLは複数の名前空間を持つ。`DOMParser`でパース後、`getElementsByTagNameNS`を使うか、名前空間プレフィックスを除去してパースする
2. **座標のパース**: `jmx_eb:Coordinate`は`"+lat+lon-depth/"`形式。正規表現`/([+-]\d+\.?\d*)([+-]\d+\.?\d*)([+-]\d+\.?\d*)\//`でパースする
3. **日時の変換**: `<DateTime>`はUTC、`<ReportDateTime>`はJST（+09:00）。表示にはJSTを使用する
4. **電文コードの判別**: URLのファイル名から`VPWW54`等のコードを抽出する。パターン: `/_0_([A-Z]{4}\d{2})_/`

### R4: 表示ロジック

1. **優先度順表示**: 高優先度の情報が先に表示される（仕様書の優先度表に従う）
2. **自動消去**: 各情報種別ごとの設定時間後に自動消去（設定画面で変更可能）
3. **訂正対応**: `InfoType=訂正`の電文を受信したら、同じ`EventID`の既存表示を新しい内容で差し替える
4. **複数情報の共存**: 同時に複数の情報が入電した場合、サイドバーは最高優先度の情報を表示し、ティッカーは全情報をキュー順にスクロール

### R5: overlay.html（OBSオーバーレイ）

1. **透明背景**: `body { background: transparent; }`を必ず設定
2. **クリック透過**: CSS `pointer-events: none;` を設定（OBSでの操作を妨げない）
3. **パフォーマンス**: 60fpsを維持。`requestAnimationFrame`でスクロールアニメーション。`will-change: transform`でGPUアクセラレーション
4. **サイズ**: 1920×1080固定。レスポンシブ不要
5. **設定同期**: `localStorage`を500ms間隔で監視し、設定変更をリアルタイム反映

### R6: 管理画面（Vite + React）

1. **コンポーネント設計**: 仕様書に記載された7つのタブを個別コンポーネントとして実装
2. **D&Dエディタ**: `react-dnd`または`@dnd-kit/core`を使用。要素の位置・サイズをピクセル単位で管理
3. **設定の永続化**: 全設定はlocalStorageに`l-telop-config`キーでJSON保存
4. **プレビュー**: Preview コンポーネントは overlay.html と同じレンダリングロジックを内包する（iframe不要、同一コンポーネントを使用）

### R7: 台風MAP

1. **Leaflet.js使用**: `<link>`タグと`<script>`タグで読み込み、またはnpmパッケージを使用
2. **座標パース**: 台風XML（VPTW60〜65）から中心位置・予報円・暴風域を抽出
3. **描画要素**: 台風マーカー、暴風域（赤半透明円）、強風域（黄半透明円）、予報進路（点線）、予報円（白点線円）、暴風警戒域（赤半透明ポリゴン）
4. **地図タイル**: OpenStreetMapをデフォルトとし、国土地理院タイルに切替可能

---

## 実装手順

### Step 1: プロジェクト初期化

```bash
# Vite + React + TypeScript でプロジェクトを初期化
npx -y create-vite@latest ./ --template react-ts

# 依存パッケージをインストール
npm install
npm install leaflet @types/leaflet
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Step 2: 型定義の作成

`src/types/jmaTypes.ts` に気象庁データの型定義を作成：

```typescript
// 主要な型
interface JmaFeedEntry {
  id: string;           // フィードエントリID (XML URL)
  title: string;        // 電文タイトル
  updated: Date;        // 更新日時
  author: string;       // 発表官署
  link: string;         // 個別XML URL
  content: string;      // 見出しテキスト
  telegramCode: string; // 電文コード (VPWW54等)
}

interface JmaReport {
  control: {
    title: string;
    dateTime: Date;
    status: '通常' | '訓練' | '試験';
    editorialOffice: string;
    publishingOffice: string;
  };
  head: {
    title: string;
    reportDateTime: Date;
    targetDateTime: Date;
    infoType: '発表' | '訂正' | '取消';
    infoKind: string;
    headlineText: string;
  };
  body: any; // 電文種別により異なる
}
```

### Step 3: データ取得エンジンの実装

`src/lib/feedParser.ts` でAtomフィードのパースロジックを実装。ルールR2〜R4に従う。

### Step 4: overlay.html の実装

`public/overlay.html` にOBSオーバーレイを実装。ルールR5に従う。

### Step 5: 管理画面の実装

`src/components/admin/` 以下に7つのタブコンポーネントを実装。ルールR6に従う。

### Step 6: 台風MAPの実装

`src/components/overlay/TyphoonMap.tsx` にLeaflet.jsベースの台風MAP描画を実装。ルールR7に従う。

---

## 警報・注意報コード一覧（実装用クイックリファレンス）

```typescript
const WARNING_CODES: Record<string, { name: string; level: string; color: string }> = {
  '33': { name: '大雨特別警報', level: 'special', color: '#8B008B' },
  '35': { name: '暴風特別警報', level: 'special', color: '#8B008B' },
  '32': { name: '暴風雪特別警報', level: 'special', color: '#8B008B' },
  '36': { name: '大雪特別警報', level: 'special', color: '#8B008B' },
  '37': { name: '波浪特別警報', level: 'special', color: '#8B008B' },
  '38': { name: '高潮特別警報', level: 'special', color: '#8B008B' },
  '03': { name: '大雨警報', level: 'warning', color: '#FF2800' },
  '04': { name: '洪水警報', level: 'warning', color: '#FF2800' },
  '05': { name: '暴風警報', level: 'warning', color: '#FF2800' },
  '06': { name: '暴風雪警報', level: 'warning', color: '#FF2800' },
  '07': { name: '大雪警報', level: 'warning', color: '#FF2800' },
  '08': { name: '波浪警報', level: 'warning', color: '#FF2800' },
  '09': { name: '高潮警報', level: 'warning', color: '#FF2800' },
  '10': { name: '大雨注意報', level: 'advisory', color: '#FFD700' },
  '13': { name: '洪水注意報', level: 'advisory', color: '#FFD700' },
  '14': { name: '雷注意報', level: 'advisory', color: '#FFD700' },
  '15': { name: '強風注意報', level: 'advisory', color: '#FFD700' },
  '16': { name: '風雪注意報', level: 'advisory', color: '#FFD700' },
  '17': { name: '大雪注意報', level: 'advisory', color: '#FFD700' },
  '18': { name: '濃霧注意報', level: 'advisory', color: '#FFD700' },
  '19': { name: '波浪注意報', level: 'advisory', color: '#FFD700' },
  '20': { name: '高潮注意報', level: 'advisory', color: '#FFD700' },
  '21': { name: 'なだれ注意報', level: 'advisory', color: '#FFD700' },
  '22': { name: '着氷注意報', level: 'advisory', color: '#FFD700' },
  '23': { name: '着雪注意報', level: 'advisory', color: '#FFD700' },
  '24': { name: '融雪注意報', level: 'advisory', color: '#FFD700' },
  '25': { name: '霜注意報', level: 'advisory', color: '#FFD700' },
  '26': { name: '低温注意報', level: 'advisory', color: '#FFD700' },
  '27': { name: '乾燥注意報', level: 'advisory', color: '#FFD700' },
};
```

## 震度カラー一覧

```typescript
const SEISMIC_COLORS: Record<string, string> = {
  '1': '#F2F2FF',
  '2': '#00AAFF',
  '3': '#0041FF',
  '4': '#FAE696',
  '5-': '#FFE600', // 5弱
  '5+': '#FF9900', // 5強
  '6-': '#FF2800', // 6弱
  '6+': '#A50021', // 6強
  '7': '#B40068',
};
```

## Atomフィード一覧

```typescript
const JMA_FEEDS = {
  highFrequency: {
    regular: 'https://www.data.jma.go.jp/developer/xml/feed/regular.xml',
    extra: 'https://www.data.jma.go.jp/developer/xml/feed/extra.xml',
    eqvol: 'https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml',
    other: 'https://www.data.jma.go.jp/developer/xml/feed/other.xml',
  },
  longTerm: {
    regular: 'https://www.data.jma.go.jp/developer/xml/feed/regular_l.xml',
    extra: 'https://www.data.jma.go.jp/developer/xml/feed/extra_l.xml',
    eqvol: 'https://www.data.jma.go.jp/developer/xml/feed/eqvol_l.xml',
    other: 'https://www.data.jma.go.jp/developer/xml/feed/other_l.xml',
  },
} as const;
```

## 座標パースユーティリティ

```typescript
function parseCoordinate(coord: string): { lat: number; lon: number; depth: number } | null {
  const match = coord.match(/([+-]\d+\.?\d*)([+-]\d+\.?\d*)([+-]\d+\.?\d*)\//);
  if (!match) return null;
  return {
    lat: parseFloat(match[1]),
    lon: parseFloat(match[2]),
    depth: Math.abs(parseFloat(match[3])),
  };
}
```
