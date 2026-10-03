const fs = require('fs');
let content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

const boundsRegex = /    \/\/ 予報円を含むすべての円を考慮してバウンズを拡張[\s\S]*?map\.fitBounds\(bounds, \{ padding: \[54, 54\], maxZoom: 6 \}\);/m;

const newBoundsCode = `    // 予報円と現在位置全体を当たり判定として四角形の範囲(バウンズ)を生成
    const extendBoundsForPoint = (lat: number, lon: number, r: number) => {
      // 半径(km)を緯度経度の度に変換してバウンズを拡張
      const dLatBound = r / 111;
      const dLonBound = r / (111 * Math.cos(lat * Math.PI / 180));
      bounds.extend([lat + dLatBound, lon]);
      bounds.extend([lat - dLatBound, lon]);
      bounds.extend([lat, lon + dLonBound]);
      bounds.extend([lat, lon - dLonBound]);
    };

    if (activeTyphoon.current) {
      const cur = activeTyphoon.current;
      const curR = Math.max(...(cur.stormRadii||[]).map((r: any)=>r.radiusKm), ...(cur.galeRadii||[]).map((r: any)=>r.radiusKm), 0);
      extendBoundsForPoint(cur.lat || 30, cur.lon || 135, curR);
    }
    if (activeTyphoon.forecasts) {
      activeTyphoon.forecasts.forEach((f: any) => {
        const fR = (f.circleRadiusKm || 0) + Math.max(...(f.stormRadii||[]).map((r:any)=>r.radiusKm), 0);
        if (f.lat && f.lon) extendBoundsForPoint(f.lat, f.lon, fR);
      });
    }
    
    // 生成した四角形の範囲に対して、外側15%を余白として確保する計算ロジック
    // bounds.pad(0.15) はバウンズの縦横の幅の15%分を外側に拡張します
    const paddedBounds = bounds.isValid() ? bounds.pad(0.15) : bounds;
    map.fitBounds(paddedBounds, { padding: [0, 0], maxZoom: 6 });`;

content = content.replace(boundsRegex, newBoundsCode);

fs.writeFileSync('frontend/src/ObsApp.tsx', content);
console.log('Fixed ObsApp bounds padding logic');
