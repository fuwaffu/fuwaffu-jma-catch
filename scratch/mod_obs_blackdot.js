const fs = require('fs');
let content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

content = content.replace(
    /\/\/ 黒点（fcIcon）は非表示にするよう修正\r?\n\s*if \(fc\.circleRadiusKm > 0\) \{/,
    `// 予報円の中心に黒点を表示
      L.circleMarker([fc.lat, fc.lon], {
        radius: 3,
        color: '#000',
        fillColor: '#000',
        fillOpacity: 1,
        weight: 1
      }).addTo(map);

      if (fc.circleRadiusKm > 0) {`
);

// One more fix: App.tsx double className
content = content.replace(/className: '', className: ''/g, "className: ''");

fs.writeFileSync('frontend/src/ObsApp.tsx', content);
console.log("Success");
