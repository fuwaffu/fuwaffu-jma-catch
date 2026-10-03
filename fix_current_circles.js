const fs = require('fs');

function updateCircles(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Update curGaleCircle to be weight: 3
  content = content.replace(
    /L\.circle\(\[curGaleCircle\.lat, curGaleCircle\.lon\], \{ radius: curGaleCircle\.radius \* 1000, color: '#FFFF00', fillColor: '#FFFF00', fillOpacity: 0\.3, weight: 2 \}\)\.addTo\(map\);/g,
    `L.circle([curGaleCircle.lat, curGaleCircle.lon], { radius: curGaleCircle.radius * 1000, color: '#FFFF00', fillColor: '#FFFF00', fillOpacity: 0.3, weight: 3 }).addTo(map);`
  );

  // Update curStormCircle to be weight: 3 and remove dashArray
  content = content.replace(
    /L\.circle\(\[curStormCircle\.lat, curStormCircle\.lon\], \{ radius: curStormCircle\.radius \* 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0\.3, weight: 1, dashArray: '5,5' \}\)\.addTo\(map\);/g,
    `L.circle([curStormCircle.lat, curStormCircle.lon], { radius: curStormCircle.radius * 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.3, weight: 3 }).addTo(map);`
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed current circles in', filePath);
}

updateCircles('./frontend/src/App.tsx');
updateCircles('./frontend/src/ObsApp.tsx');
