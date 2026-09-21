# 気象庁防災情報データベース — システム仕様書

## 概要

気象庁が公開するXML形式の防災情報（PULL型）を定期的に取得・パースし、Webダッシュボードとして表示するシステム。  
OBS Studio向けの配信オーバーレイ表示にも対応。

---

## アーキテクチャ

```
気象庁 XML Feed (PULL型) → [5分間隔] → Cloudflare Worker (バックエンド)
                                              ↕ KV読み書き
                                        Cloudflare KV (データストア)
                                              ↓ JSON API
                                        Cloudflare Pages (フロントエンド)
                                              ↓ 表示
                                        ブラウザ / OBS Studio
```

| レイヤー | 技術スタック |
|---|---|
| **フロントエンド** | React 19 + Vite 8 + TypeScript + Leaflet |
| **バックエンド** | Cloudflare Workers + KV Namespace |
| **地図タイル** | CartoDB Positron (no labels) |
| **フォント** | LINE Seed JP (日本語), Lato Black 900 (数字) |
| **デプロイ** | Cloudflare Pages (frontend), Cloudflare Workers (backend) |

---

## データソース（気象庁XMLフィード）

| フィードURL | 用途 |
|---|---|
| `extra.xml` | 気象警報・注意報、台風情報（速報系） |
| `extra_l.xml` | 気象警報・注意報、台風情報（長期保持系） |
| `eqvol.xml` | 地震・火山情報 |

### 対象電文コード

| 電文コード | 情報種別 |
|---|---|
| `VPWW53` ~ `VPWW61` | 気象警報・注意報 |
| `VXSE51`, `VXSE52`, `VXSE53` | 震度速報・震源情報・各地の震度 |
| `VPTW6x` | 台風情報（実況・予報） |
| `VPTI5x` | 台風情報（補足） |

---

## 更新頻度・キャッシュ時間

### バックエンド（データ取得）

| 項目 | 値 | 説明 |
|---|---|---|
| **Cron スケジュール** | `*/5 * * * *` | **5分間隔**で気象庁XMLフィードをポーリング |
| **サブリクエスト上限** | 45件/回 | Cloudflare Workersの50件制限に対する安全マージン |
| **処理済みフィード履歴** | 最新1,000件 | 重複処理防止のためKVに保持 |
| **地震データ上限** | 200件 | 古いデータから順に削除 |
| **台風データ上限** | 20件 | 同一台風番号は最新情報で上書き |

### APIキャッシュ

| 項目 | 値 | 説明 |
|---|---|---|
| **Cache API TTL** | **600秒（10分）** | Cloudflare Cache APIによるエッジキャッシュ |
| **Cache-Control ヘッダー** | `public, max-age=600` | ブラウザ・CDNキャッシュ指示 |
| **キャッシュ無効化** | データ更新時に自動実行 | `invalidateApiCaches()` で4キー分を一括削除 |

### フロントエンド（データ取得）

| 項目 | 値 | 説明 |
|---|---|---|
| **ポーリング間隔** | **300,000ms（5分）** | `setInterval` による定期再取得 |
| **OBS用ポーリング** | **300,000ms（5分）** | ObsApp も同一間隔 |

### データ鮮度の最大遅延

```
気象庁発表 → 最大5分 → Worker取得・KV書込 → 最大10分 → APIキャッシュ期限切れ → 最大5分 → フロント再取得
```

> **NOTE**: 最悪ケースでは発表から約 **20分** の遅延が発生しうるが、通常はCron実行時にキャッシュも無効化されるため、実質的な遅延は **5〜10分** 程度。

---

## APIエンドポイント

**ベースURL**: `https://jma-dashboard-backend.fuwaffu.workers.dev`

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/warnings` | 気象警報・注意報の一覧 |
| GET | `/api/earthquakes` | 地震情報の一覧 |
| GET | `/api/typhoons` | 台風情報の一覧 |
| GET | `/api/status` | 最終更新日時 |
| GET | `/api/trigger-update` | 手動でデータ更新を実行 |
| GET | `/api/sync-initial` | 初期データ同期（地震はJMA直接API、その他はXMLフィード再構築） |
| GET | `/api/clear-cache` | KVキャッシュ + Cache APIの完全クリア |

全エンドポイントで `Access-Control-Allow-Origin: *` が設定済み（CORS対応）。

---

## データ構造

### 気象警報 (`/api/warnings`)

```json
{
  "xmlId": "...",
  "reportDateTime": "2026-09-21T06:00:00+09:00",
  "region": "東京地方",
  "prefecture": "東京都",
  "areaType": "prefecture | region | subregion | municipality",
  "warningCode": "03",
  "warningName": "レベル3 大雨警報",
  "warningLevel": "level_3",
  "infoType": "発表",
  "status": "通常"
}
```

**警戒レベル付与ルール**:
- 特別警報 → レベル5
- 警報（大雨・洪水）→ レベル3、警報（高潮）→ レベル4
- 注意報 → レベル2

### 地震情報 (`/api/earthquakes`)

```json
{
  "xmlId": "...",
  "originTime": "2026-09-21T06:00:00+09:00",
  "hypocenterName": "千葉県北西部",
  "magnitude": "4.2",
  "maxIntensity": "3",
  "depth": 0
}
```

### 台風情報 (`/api/typhoons`)

```json
{
  "xmlId": "...",
  "tcNumber": "2614",
  "name": "シャンシャン",
  "nameEn": "SHANSHAN",
  "headlineText": "...",
  "updatedAt": "2026-09-21T06:00:00+09:00",
  "current": {
    "lat": 30.333,
    "lon": 137.583,
    "location": "フィリピンの東",
    "direction": "北北西",
    "speedKmh": 20,
    "pressure": 960,
    "maxWind": 40,
    "gustWind": 55,
    "typhoonClass": "台風",
    "intensityClass": "強い",
    "areaClass": "大型",
    "stormRadii": [{ "direction": "全域", "radiusKm": 110 }],
    "galeRadii": [{ "direction": "北東", "radiusKm": 390 }]
  },
  "forecasts": [
    {
      "dateTime": "2026-09-22T06:00:00+09:00",
      "forecastType": "24時間後",
      "lat": 32.5,
      "lon": 135.0,
      "circleRadiusKm": 150,
      "pressure": 955,
      "maxWind": 42,
      "gustWind": 58,
      "stormRadii": [],
      "galeRadii": []
    }
  ]
}
```

**座標パース**: 気象庁XMLの「度分」形式を優先パースし、分単位の精度（1/60度 ≒ 約1.85km）でデータを取得。

---

## フロントエンド仕様

### 通常表示 (`/`)

- **3タブ構成**: 警報・注意報 / 地震 / 台風
- **警報表示**: 都道府県 / 地域 / 市区町村の3段階ドリルダウン
  - 北海道の振興局は「北海道」に統合
  - 沖縄の離島地域は「沖縄県」に統合
- **地震表示**: 発生日時、震源地、マグニチュード、最大震度を一覧表示
- **台風表示**: 一覧 → 詳細マップ（Leafletによる予報円・暴風域・予報コーン表示）

### OBS配信用表示 (`/?mode=obs`)

| 項目 | 仕様 |
|---|---|
| **解像度** | 1920×1080px（フルHD固定） |
| **背景** | 透過対応（OBSブラウザソースのクロマキー不要） |
| **地図** | CartoDB Positron (no labels) — 文字なし、境界線・海岸線表示 |
| **操作** | ズーム / ドラッグ / スクロール全て無効（固定表示） |
| **情報パネル** | 左側にフロート配置（グラデーションオーバーレイ付き） |
| **出典表示** | 右下に「出典：気象庁」を常時表示 |

#### OBS情報パネルの内容

1. **台風タイトル**: 台風○号（英名）、日本名、発表日時
2. **現在の情報**: 強さ・大きさ、中心気圧、最大風速、最大瞬間風速
3. **予想図**: 予報円（破線円）、予報コーン（扇形ポリゴン）、暴風警戒域（赤色扇形）、強風域（黄色円）

---

## 台風地図上の描画要素

| 要素 | 色 | スタイル | 説明 |
|---|---|---|---|
| 現在位置マーカー | `#ef4444` (赤) | 丸点 + 白縁 | 台風の現在中心位置 |
| 軌跡線 | `#333` | 実線 | 現在位置〜各予報点をつなぐ |
| 予報円 | `#555` | 破線円 | 各予報時刻の到達可能範囲 |
| 予報コーン | `#555` / `#888` | 破線ポリゴン | 予報円を接線で結んだ扇形 |
| 暴風域（実況） | `#FF2800` | 実線円、塗り20% | 現在の暴風域 |
| 暴風警戒域 | `#FF2800` | 破線ポリゴン | 暴風域の予報コーン |
| 強風域（実況） | `#FFD700` | 破線円、塗り15% | 現在の強風域 |
| 強風域（予報） | `#FFD700` | 破線円 | 各予報時刻の強風域 |
| 時刻ラベル | `#1e293b` | 太字 + 白影 | 引出し線付き |

---

## デプロイ情報

| 項目 | 値 |
|---|---|
| **本番URL (Frontend)** | https://weather.fuwaffu.me/ |
| **Pages URL** | https://jma-dashboard-viewer.pages.dev/ |
| **OBS用URL** | https://weather.fuwaffu.me/?mode=obs |
| **Backend URL** | https://jma-dashboard-backend.fuwaffu.workers.dev |
| **GitHub** | https://github.com/fuwaffu/fuwaffu-jma-catch |
| **KV Namespace ID** | `3c3c76bfd3c148b2bd669bcec2abd660` |

---

## ディレクトリ構成

```
weather_Lterop/
├── backend/              # Cloudflare Worker（バックエンド）
│   ├── index.ts          # メインロジック（XMLパース・API・Cron）
│   └── wrangler.toml     # Workers設定（Cron・KVバインディング）
├── frontend/             # Cloudflare Pages（フロントエンド）
│   ├── src/
│   │   ├── main.tsx      # エントリポイント（通常/OBSモード切替）
│   │   ├── App.tsx       # 通常表示コンポーネント
│   │   ├── ObsApp.tsx    # OBS配信用コンポーネント
│   │   └── index.css     # グローバルスタイル
│   ├── index.html        # HTMLテンプレート（フォント読込）
│   └── package.json      # 依存関係
└── .agents/skills/       # エージェントスキル定義
```

---

## 法的遵守事項

- 気象庁データは「気象業務法」に基づく公開情報を利用
- OBS表示を含む全画面に「出典：気象庁」を明記
- 地図タイルは CartoDB (OpenStreetMap) のライセンスに準拠
