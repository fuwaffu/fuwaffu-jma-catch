# L字テロップシステム 技術仕様書

> **Version**: 1.0  
> **Date**: 2026-08-24  
> **技術スタック**: HTML / CSS / JavaScript (Web技術)  
> **管理画面**: Vite + React  
> **配信連携**: OBS等配信ソフトのブラウザソースオーバーレイ

---

## 1. システム概要

### 1.1 目的

気象庁防災情報XMLフォーマット（PULL型）のデータを取得・解析し、テレビ放送で使用されるL字テロップとして表示するWebベースのシステム。OBS Studio等の配信ソフトウェアのブラウザソースとしてオーバーレイ表示される。

### 1.2 システム構成

```
┌─────────────────────────────────────────────────────┐
│                    管理パネル                          │
│              (Vite + React SPA)                       │
│  ┌──────────┬──────────┬──────────┬─────────────────┐ │
│  │表示情報   │カラー    │レイアウト │データビューア    │ │
│  │設定      │設定      │設定(D&D) │& プレビュー     │ │
│  └──────────┴──────────┴──────────┴─────────────────┘ │
│            │ 設定JSON保存・配信                        │
│            ▼                                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │        設定ストレージ (localStorage / JSON)       │ │
│  └─────────────────────────────────────────────────┘ │
│            │                                         │
│            ▼                                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │     L字テロップ表示画面 (OBSブラウザソース)        │ │
│  │     overlay.html - 透明背景                       │ │
│  └─────────────────────────────────────────────────┘ │
│            ▲                                         │
│            │                                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │     データ取得エンジン (Fetch + XMLパーサー)        │ │
│  │     気象庁 Atom Feed → 個別XML電文取得             │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 1.3 画面一覧

| 画面 | URL | 用途 |
|---|---|---|
| L字テロップ表示 | `/overlay.html` | OBSブラウザソースとして読み込む |
| 管理パネル | `/admin/` | 設定・データ確認・プレビュー |

---

## 2. データ取得仕様

### 2.1 Atomフィード

気象庁は更新サイクルの異なる2種類のAtomフィードを提供する。L字テロップでは**高頻度フィード**を使用する。

#### 高頻度フィード（毎分更新、直近10分以上の入電を掲載）

| フィード | URL | 内容 |
|---|---|---|
| 定時 | `https://www.data.jma.go.jp/developer/xml/feed/regular.xml` | 天気概況・天気予報等 |
| 随時 | `https://www.data.jma.go.jp/developer/xml/feed/extra.xml` | 警報・注意報・台風情報等 |
| 地震火山 | `https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml` | 地震・津波・火山情報 |
| その他 | `https://www.data.jma.go.jp/developer/xml/feed/other.xml` | 上記以外 |

#### 長期フィード（毎時更新、数日間の全入電）

| フィード | URL | 内容 |
|---|---|---|
| 定時 | `https://www.data.jma.go.jp/developer/xml/feed/regular_l.xml` | 天気概況・天気予報等 |
| 随時 | `https://www.data.jma.go.jp/developer/xml/feed/extra_l.xml` | 警報・注意報・台風情報等 |
| 地震火山 | `https://www.data.jma.go.jp/developer/xml/feed/eqvol_l.xml` | 地震・津波・火山情報 |
| その他 | `https://www.data.jma.go.jp/developer/xml/feed/other_l.xml` | 上記以外 |

### 2.2 Atomフィードのエントリ構造

```xml
<entry>
  <title>気象警報・注意報（Ｈ２７）</title>
  <id>https://www.data.jma.go.jp/developer/xml/data/YYYYMMDDHHMMSS_0_VPWW54_XXXXXX.xml</id>
  <updated>2026-08-23T18:48:04Z</updated>
  <author>
    <name>函館地方気象台</name>
  </author>
  <link type="application/xml" href="https://www.data.jma.go.jp/developer/xml/data/...xml"/>
  <content type="text">【渡島・檜山地方気象警報・注意報】...</content>
</entry>
```

#### データ取得ルール

1. **ポーリング間隔**: 管理画面で設定（デフォルト60秒、最小60秒）
2. **重複排除**: `<id>`要素をキーとして既取得エントリを管理。一度取得したXMLは再取得しない
3. **差分取得**: フィードの`<updated>`と前回取得時刻を比較。新しいエントリのみ個別XMLを取得
4. **通信量制限**: 1日10GB未満に抑える（IP遮断防止）
5. **エラーハンドリング**: フィード取得失敗時はログ出力し、次回ポーリングでリトライ

### 2.3 個別XML電文の共通構造

すべてのXML電文は以下の3層構造を持つ：

```xml
<Report xmlns="http://xml.kishou.go.jp/jmaxml1/">
  <Control>           <!-- 管理部 -->
    <Title/>          <!-- 電文タイトル -->
    <DateTime/>       <!-- 発表日時（UTC） -->
    <Status/>         <!-- 通常 / 訓練 / 試験 -->
    <EditorialOffice/><!-- 編集官署 -->
    <PublishingOffice/><!-- 発表官署 -->
  </Control>
  <Head>              <!-- ヘッダ部 -->
    <Title/>          <!-- 情報名称 -->
    <ReportDateTime/> <!-- 発表日時（JST） -->
    <TargetDateTime/> <!-- 対象日時 -->
    <InfoType/>       <!-- 発表 / 訂正 / 取消 -->
    <InfoKind/>       <!-- 情報種別 -->
    <Headline>        <!-- 見出し -->
      <Text/>         <!-- 見出し文 -->
      <Information/>  <!-- 構造化見出し -->
    </Headline>
  </Head>
  <Body>              <!-- 本体部（電文種別により異なる） -->
    ...
  </Body>
</Report>
```

#### Status判定ルール

| Status値 | 処理 |
|---|---|
| `通常` | 本番表示に使用 |
| `訓練` | **表示しない**（テストモード時のみ表示可） |
| `試験` | **表示しない**（テストモード時のみ表示可） |

#### InfoType判定ルール

| InfoType | 処理 |
|---|---|
| `発表` | 新規情報として表示 |
| `訂正` | 既存表示を訂正内容で差し替え |
| `取消` | 既存表示を消去 |

---

## 3. 情報種別ごとのXML電文マッピング

### 3.1 気象警報・注意報

| 電文コード | 情報名 | 主要フィールド |
|---|---|---|
| VPWW53 | 気象特別警報・警報・注意報 | `Head/Headline/Text`, `Head/Headline/Information` |
| VPWW54 | 気象警報・注意報（H27） | `Body/Warning`, `Kind/Name`, `Kind/Code`, `Kind/Status` |
| VPWW56 | 土砂災害 | `Body/Warning` |
| VPWW58 | 暴風 | `Body/Warning` |
| VPWW59 | 波浪 | `Body/Warning` |
| VPWW61 | その他注意報 | `Body/Warning` |

#### L字テロップ表示への変換

- **左サイドバー**: 「気象警報」「注意報」等のカテゴリ名を縦書き表示
- **下部ティッカー**: `Head/Headline/Text`の内容をスクロール表示
- **色分け**: `Kind/Code`に基づく（後述カラーコード表参照）

#### 警報・注意報コード表

| Code | 名称 | デフォルト色 | レベル |
|---|---|---|---|
| 33 | 大雨特別警報 | `#8B008B` (紫) | 特別警報 |
| 35 | 暴風特別警報 | `#8B008B` | 特別警報 |
| 03 | 大雨警報 | `#FF2800` (赤) | 警報 |
| 04 | 洪水警報 | `#FF2800` | 警報 |
| 05 | 暴風警報 | `#FF2800` | 警報 |
| 10 | 大雨注意報 | `#FFD700` (黄) | 注意報 |
| 14 | 雷注意報 | `#FFD700` | 注意報 |
| 18 | 濃霧注意報 | `#FFD700` | 注意報 |
| 20 | 強風注意報 | `#FFD700` | 注意報 |

### 3.2 地震情報

| 電文コード | 情報名 | 主要フィールド |
|---|---|---|
| VXSE51 | 震度速報 | `Body/Intensity/Observation/MaxInt` |
| VXSE52 | 震源に関する情報 | `Body/Earthquake/Hypocenter`, `jmx_eb:Magnitude` |
| VXSE53 | 震源・震度に関する情報 | 上記を統合 + `Body/Intensity/Observation/Pref/Area/City` |
| VXSE62 | 長周期地震動に関する観測情報 | `Body/LongPeriodGroundMotion` |

#### L字テロップ表示への変換

```
地震XML → 抽出データ:
  - 発生日時: Body/Earthquake/OriginTime
  - 震源地名: Body/Earthquake/Hypocenter/Area/Name
  - 深さ:    Body/Earthquake/Hypocenter/Area/jmx_eb:Coordinate → depth
  - M値:     Body/Earthquake/jmx_eb:Magnitude
  - 最大震度: Body/Intensity/Observation/MaxInt
  - 各地震度: Body/Intensity/Observation/Pref/Area/City/Int
  - 津波注意文: Body/Comments/ForecastComment/Text
```

#### 震度別カラーコード

| 震度 | デフォルト色 | 背景色 |
|---|---|---|
| 1 | `#F2F2FF` | 薄灰 |
| 2 | `#00AAFF` | 水色 |
| 3 | `#0041FF` | 青 |
| 4 | `#FAE696` | 黄 |
| 5弱 | `#FFE600` | 濃黄 |
| 5強 | `#FF9900` | 橙 |
| 6弱 | `#FF2800` | 赤 |
| 6強 | `#A50021` | 深赤 |
| 7 | `#B40068` | 紫 |

### 3.3 津波警報・注意報

| 電文コード | 情報名 | 主要フィールド |
|---|---|---|
| VTSE41 | 津波警報・注意報・予報 | `Body/Tsunami/Forecast/Item` |
| VTSE51 | 津波情報 | `Body/Tsunami/Observation/Item` |
| VTSE52 | 沖合の津波観測に関する情報 | `Body/Tsunami/Observation/Item` |

### 3.4 台風情報

| 電文コード | 情報名 | 主要フィールド |
|---|---|---|
| VPTI50 | 全般台風情報（総合情報） | `Body/MeteorologicalInfos` |
| VPTI51 | 全般台風情報（位置） | `Body/MeteorologicalInfos` |
| VPTI52 | 全般台風情報（位置詳細） | `Body/MeteorologicalInfos` |
| VPTW60〜65 | 台風解析・予報情報（5日予報） | `Body/MeteorologicalInfos/MeteorologicalInfo` |
| VPTA50〜55 | 台風の暴風域に入る確率 | `Body/MeteorologicalInfos` |

#### 台風XMLから抽出するデータ

```
台風XML (VPTW6x) → 抽出データ:
  - TC番号
  - 台風名称
  - 中心位置: jmx_eb:Coordinate → "+lat+lon-depth/"
  - 移動方向・速度
  - 中心気圧
  - 最大風速・最大瞬間風速
  - 暴風域半径・強風域半径
  - 予報データ(24h,48h,72h,96h,120h):
    - 予報円中心・半径
    - 暴風警戒域
```

### 3.5 火山情報

| 電文コード | 情報名 |
|---|---|
| VFVO50 | 噴火警報・予報 |
| VFVO51 | 火山の状況に関する解説情報 |
| VFVO52 | 噴火に関する火山観測報 |
| VFVO53 | 降灰予報 |

### 3.6 その他の情報

| 電文コード | 情報名 |
|---|---|
| VPZJ50, VPCJ50 | 気象情報（全般/地方） |
| VPHW50, VPHW51 | 竜巻注意情報 |
| VPOA50 | 記録的短時間大雨情報 |
| VXWW50 | 土砂災害警戒情報 |
| VXKOii | 指定河川洪水予報 |

---

## 4. L字テロップ画面レイアウト仕様

### 4.1 基本レイアウト

OBSブラウザソース（1920×1080）での基本レイアウト。

```
┌──────────────────────────────────────────────────────────┐
│┌─────┐                                                   │
││     │                                                   │
││ 左  │           映像表示エリア                            │
││ サ  │          （透過：映像はOBSの別レイヤー）              │
││ イ  │                                                   │
││ ド  │                                                   │
││ バ  │                                                   │
││ ー  │                                                   │
││     │                                                   │
│├─────┼───────────────────────────────────────────────────┤
││     │         下部スクロールバー（ティッカー）              │
│└─────┴───────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────┘
```

### 4.2 デフォルトサイズ値

| 要素 | デフォルト | 設定可能範囲 |
|---|---|---|
| 全体サイズ | 1920 × 1080 px | OBSに依存 |
| 左サイドバー幅 | 100px | 60〜200px |
| 下部バー高さ | 60px | 40〜120px |
| サイドバー文字サイズ | 48px | 24〜72px |
| 下部バー文字サイズ | 32px | 18〜48px |
| フォントファミリー | `"Noto Sans JP", sans-serif` | 選択可能 |
| スクロール速度 | 80px/秒 | 40〜200px/秒 |

### 4.3 表示エリア別デフォルトカラー

| エリア | 背景 | 文字色 | 備考 |
|---|---|---|---|
| 左サイドバー | `linear-gradient(135deg, #8B0000, #C41E3A)` | `#FFFFFF` | ダークレッド |
| 下部バー | `linear-gradient(to bottom, #1a1a2e, #16213e)` | `#FFFFFF` | ダークブルー |
| 情報ヘッダ部 | `#C41E3A` | `#FFFFFF` | サイドバー上部 |
| 下部バーボーダー上 | `linear-gradient(to right, #FFD700, #FFA500)` | — | ゴールドライン |

### 4.4 OBSブラウザソース仕様

| 項目 | 値 |
|---|---|
| URL | `http://localhost:5173/overlay.html` |
| 幅 | 1920 |
| 高さ | 1080 |
| カスタムCSS | 不要（透明背景を内蔵） |

#### overlay.htmlの要件

- `body { background: transparent; }` で透明背景
- CSS `pointer-events: none;` でクリック透過
- レンダリングパフォーマンス: 60fps維持

---

## 5. 台風MAP表示仕様

### 5.1 技術構成

- **地図ライブラリ**: Leaflet.js v1.9+
- **地図タイル**: OpenStreetMap / 国土地理院タイル（選択可能）
- **GISデータ**: 気象庁[予報区等GISデータ](https://www.data.jma.go.jp/developer/gis.html)

### 5.2 台風MAP描画仕様

```
描画要素:
  1. 台風中心マーカー（台風アイコン）
  2. 現在の暴風域（赤色半透明円）
  3. 現在の強風域（黄色半透明円）
  4. 予報進路ライン（点線）
  5. 予報円（24h/48h/72h/96h/120h）
  6. 暴風警戒域（赤色半透明ポリゴン）
```

### 5.3 座標パース仕様

```
jmx_eb:Coordinate format: "+lat+lon-depth/"
例: "+42.2+142.9-60000/" → { lat: 42.2, lon: 142.9, depth: 60000 }
```

---

## 6. 表示優先度

| 優先度 | 情報種別 | 表示時間(デフォルト) |
|---|---|---|
| 1（最高） | 緊急地震速報 | 消去まで表示 |
| 2 | 津波警報・大津波警報 | 消去まで表示 |
| 3 | 特別警報 | 消去まで表示 |
| 4 | 震度速報・震源震度情報 | 300秒 |
| 5 | 津波注意報 | 消去まで表示 |
| 6 | 気象警報 | 600秒 |
| 7 | 台風情報 | 600秒 |
| 8 | 噴火警報 | 600秒 |
| 9 | 土砂災害警戒情報 | 600秒 |
| 10 | 竜巻注意情報 | 300秒 |
| 11 | 記録的短時間大雨情報 | 300秒 |
| 12 | 気象注意報 | 600秒 |
| 13 | 天気予報 | 300秒 |

---

## 7. 法的遵守事項

### 7.1 絶対遵守ルール

1. **気象業務法の遵守**: 予報値の独自編集・改変は禁止。発表された情報をそのまま表示
2. **出典明示**: 「気象庁発表」の出典を常時表示
3. **Status確認**: `<Status>通常</Status>`以外は本番画面に表示しない
4. **InfoType処理**: `取消`電文で該当情報を速やかに消去
5. **アクセス制限**: 1日のダウンロード量を10GB未満に
6. **キャッシュ実装**: IDベースの重複排除で再取得防止
7. **免責認識**: 配信停止・遅延があり得ることを運用者に周知

### 7.2 推奨事項

- 利用規約リンク配置: https://www.jma.go.jp/jma/kishou/info/coment.html
- 最終取得日時をオーバーレイ上に表示
- データ取得失敗時の代替表示
- 確実な配信が必要な場合: [気象業務支援センター](http://www.jmbsc.or.jp/jp/)

### 7.3 技術資料参照先

| 資料 | URL |
|---|---|
| XML電文仕様書 | https://xml.kishou.go.jp/jmaxml_20221209_format_v1_3.pdf |
| 運用指針 | https://xml.kishou.go.jp/jmaxml_guide_20130412.pdf |
| コード管理表 | https://xml.kishou.go.jp/jmaxml_20260806_code.xlsx |
| サンプルデータ | https://xml.kishou.go.jp/jmaxml_20260723_Samples.zip |
| 解説資料 | https://xml.kishou.go.jp/jmaxml_20260707_Manual(pdf).zip |
| GISデータ | https://www.data.jma.go.jp/developer/gis.html |
| 留意事項 | https://xml.kishou.go.jp/considerationforxml.pdf |

---

## 8. プロジェクト構成

```
weather_Lterop/
├── docs/
│   ├── L_TELOP_SPEC.md           # 本仕様書
│   └── L_TELOP_ADMIN_SPEC.md     # 管理画面仕様書
├── .agents/skills/l-telop/
│   └── SKILL.md                   # Agentスキル
├── public/
│   └── overlay.html               # OBSオーバーレイ用HTML
├── src/
│   ├── main.tsx                   # Reactエントリポイント
│   ├── App.tsx                    # 管理パネルルーター
│   ├── components/
│   │   ├── admin/                 # 管理パネル
│   │   │   ├── InfoSelector.tsx   # 表示情報設定
│   │   │   ├── ColorSettings.tsx  # カラー設定
│   │   │   ├── LayoutEditor.tsx   # レイアウトD&Dエディタ
│   │   │   ├── AreaColorSettings.tsx
│   │   │   ├── DataViewer.tsx     # データビューア
│   │   │   ├── Preview.tsx        # プレビュー画面
│   │   │   └── AdvancedSettings.tsx
│   │   └── overlay/               # オーバーレイ
│   │       ├── LTelop.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Ticker.tsx
│   │       └── TyphoonMap.tsx
│   ├── hooks/
│   │   ├── useJmaFeed.ts
│   │   ├── useXmlParser.ts
│   │   └── useTelopConfig.ts
│   ├── lib/
│   │   ├── feedParser.ts
│   │   ├── xmlParser.ts
│   │   ├── priorityEngine.ts
│   │   └── configStore.ts
│   ├── types/
│   │   ├── jmaTypes.ts
│   │   └── configTypes.ts
│   └── styles/
│       ├── overlay.css
│       └── admin.css
├── package.json
├── vite.config.ts
└── tsconfig.json
```
