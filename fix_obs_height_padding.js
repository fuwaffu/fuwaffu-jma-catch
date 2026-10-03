const fs = require('fs');
let content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

const boundsRegex = /    \/\/ 生成した四角形の範囲に対して、外側15%を余白として確保する計算ロジック[\s\S]*?map\.fitBounds\(paddedBounds, \{ padding: \[0, 0\], maxZoom: 6 \}\);/m;

const newBoundsCode = `    // 生成した四角形の上限・下限位置(縦幅)を取り、外側8%を高さの余白として確保
    if (bounds.isValid()) {
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const east = bounds.getEast();
      const west = bounds.getWest();
      
      const dLat = north - south;
      const padLat = dLat * 0.08; // 縦幅の8%
      
      // 横幅についてはそのままか、アスペクト比で自然に決まる
      const newBounds = L.latLngBounds(
        [south - padLat, west],
        [north + padLat, east]
      );
      map.fitBounds(newBounds, { padding: [0, 0], maxZoom: 6 });
    } else {
      map.fitBounds(bounds, { padding: [0, 0], maxZoom: 6 });
    }`;

content = content.replace(boundsRegex, newBoundsCode);

fs.writeFileSync('frontend/src/ObsApp.tsx', content);
console.log('Fixed ObsApp bounds height padding logic to 8%');
