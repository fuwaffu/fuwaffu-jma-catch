const fs = require('fs');

let content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

// 1. Info area top/left
content = content.replace(/top: '50px',\s*left: '50px',/m, "top: '30px',\n        left: '30px',");

// 2. Bounds extension logic
const newBoundsCode = `    // 予報円を含むすべての円を考慮してバウンズを拡張
    const extendBoundsForPoint = (lat: number, lon: number, r: number) => {
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
    }`;

const boundsRegex = /\s*\/\/ 現在の強風域・暴風域の最大半径を考慮してバウンズを拡張[\s\S]*?bounds\.extend\(\[lat, lon - dLonBound\]\);\s*\}/m;
content = content.replace(boundsRegex, `\n` + newBoundsCode);

fs.writeFileSync('frontend/src/ObsApp.tsx', content);
console.log('Fixed info panel position and bounds extending logic in ObsApp.tsx');
