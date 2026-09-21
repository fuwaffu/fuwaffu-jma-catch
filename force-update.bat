@echo off
echo データベース(Cloudflare KV)の情報を強制リセット・更新しています...
powershell -Command "Invoke-RestMethod -Uri 'https://jma-dashboard-backend.fuwaffu.workers.dev/api/sync-initial'"
echo 強制更新のリクエストが完了しました。
pause
