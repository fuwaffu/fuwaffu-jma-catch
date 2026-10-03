const fs = require('fs');

function applyFillColor(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 強風域 (Gale) の fillColor を 'transparent' から '#FFFF00', fillOpacity: 0.3 に変更
  content = content.replace(
    /L\.circle\(\[curGaleCircle\.lat, curGaleCircle\.lon\], \{ radius: curGaleCircle\.radius \* 1000, color: '#FFFF00', fillColor: 'transparent', weight: 2 \}\)\.addTo\(map\);/g,
    `L.circle([curGaleCircle.lat, curGaleCircle.lon], { radius: curGaleCircle.radius * 1000, color: '#FFFF00', fillColor: '#FFFF00', fillOpacity: 0.3, weight: 2 }).addTo(map);`
  );

  // 暴風域 (Storm) の fillColor を 'transparent' から '#FF2800', fillOpacity: 0.3 に変更
  content = content.replace(
    /L\.circle\(\[curStormCircle\.lat, curStormCircle\.lon\], \{ radius: curStormCircle\.radius \* 1000, color: '#FF2800', fillColor: 'transparent', weight: 1, dashArray: '5,5' \}\)\.addTo\(map\);/g,
    `L.circle([curStormCircle.lat, curStormCircle.lon], { radius: curStormCircle.radius * 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.3, weight: 1, dashArray: '5,5' }).addTo(map);`
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed fill color for', filePath);
}

applyFillColor('./frontend/src/App.tsx');
applyFillColor('./frontend/src/ObsApp.tsx');
