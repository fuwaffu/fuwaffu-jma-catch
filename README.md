# 気象庁防災情報ダッシュボード (JMA Dashboard)

このプロジェクトは、気象庁（JMA）が配信する防災情報XML（PULL型）を定期的に取得・解析し、Cloudflare WorkersとKVを用いて高速に配信、Reactによるフロントエンドで分かりやすく表示するWebアプリケーションです。

## 主な機能

- **気象警報・注意報の表示**: 各都道府県・地域ごとに発令されている警報・注意報をレベル別に色分けして表示します。
- **地震情報の表示**: 最新の震源・震度情報を一覧表示します。
- **高速な配信**: Cloudflare WorkersとKVを使用し、トラフィック増加時にも安定した高速レスポンスを実現します。
- **モダンなUI**: LINE Seed JP フォントやグラスモーフィズムデザインを取り入れた、見やすく洗練されたユーザーインターフェースを提供します。新着データのスライドアニメーションにも対応しています。

## アーキテクチャ

1. **バックエンド (`backend/`)**:
   - Cloudflare Workers上で稼働し、CRONトリガー（5分間隔）で気象庁のXMLフィード (`extra.xml` / `extra_l.xml`) を監視します。
   - JMAルール（1日10GB）を厳守するため、一度取得したXMLはキャッシュし重複ダウンロードを防止しています。
   - 取得したXMLデータは `fast-xml-parser` でJSONにパースされます。警報（VPWW）受信時は、XMLを「正」として地域単位で古いデータを破棄し、新しいXMLの内容で完全置換（上書き）します。これにより「解除」された警報も正確に消去されます。
   - フロントエンドからのAPIリクエストに対して、KV上のデータをキャッシュしつつ超高速に返却します。

2. **フロントエンド (`frontend/`)**:
   - React + Vite で構築されたシングルページアプリケーション（SPA）です。
   - バックエンドのAPIからデータを取得し、状態に応じて警報や地震のリストをレンダリングします。
   - Cloudflare Pages にデプロイされています。

## ローカル開発環境のセットアップ

### 前提条件
- Node.js (v18以上推奨)
- npm または yarn
- Cloudflare アカウント（Wrangler CLI）

### バックエンドの起動
1. `backend` ディレクトリに移動します。
   ```bash
   cd backend
   npm install
   ```2. （初回のみ）Cloudflareにログインし、KV名前空間を作成します。
   ```bash
   npx wrangler login
   npx wrangler kv:namespace create WEATHER_DATA_STORE
   ```   作成されたIDを `wrangler.toml` の `id` フィールドに設定してください。
3. ローカルサーバーを起動します。
   ```bash
   npm start
   ```
### フロントエンドの起動
1. `frontend` ディレクトリに移動します。
   ```bash
   cd frontend
   npm install
   ```2. 開発用サーバーを起動します。
   ```bash
   npm run dev
   ```3. ブラウザで `http://localhost:5173` にアクセスします。

## デプロイ

### バックエンド (Cloudflare Workers)
```bash
cd backend
npx wrangler deploy
```
### フロントエンド (Cloudflare Pages)
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=jma-dashboard-viewer --branch=main
```
## ライセンス
MIT License

