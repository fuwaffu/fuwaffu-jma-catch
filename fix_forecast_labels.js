const fs = require('fs');
let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');

// We need maxCurRadius earlier, so let's move its calculation up, before drawing forecasts.
content = content.replace(
  /  const trackPoints: \[number, number\]\[\] = \[\[lat, lon\]\];/,
  `  const trackPoints: [number, number][] = [[lat, lon]];\n  const maxCurRadius = Math.max(...(cur.stormRadii||[]).map((r: any)=>r.radiusKm), ...(cur.galeRadii||[]).map((r: any)=>r.radiusKm), 0);`
);

content = content.replace(
  /    const labelOffsetKm = \(fc\.circleRadiusKm \|\| 50\) \+ \(isObs \? 160 : 90\);[\s\S]*?const labelLon = fc\.lon \+ \(labelOffsetKm \/ \(111 \* Math\.cos\(fc\.lat \* Math\.PI \/ 180\)\)\) \* Math\.sin\(rad\);/,
  `    let labelOffsetKm = (fc.circleRadiusKm || 50) + (isObs ? 160 : 90); 
    const rad = angle * Math.PI / 180;
    let labelLat = fc.lat + (labelOffsetKm / 111) * Math.cos(rad);
    let labelLon = fc.lon + (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);

    // ponytail: Ensure forecast label does not enter the CURRENT typhoon circle
    let distToCur = Math.sqrt(Math.pow((labelLat - lat) * 111, 2) + Math.pow((labelLon - lon) * 111 * Math.cos((lat + labelLat) / 2 * Math.PI / 180), 2));
    let attempts = 0;
    while (distToCur < maxCurRadius + 40 && attempts < 20) {
      labelOffsetKm += 30;
      labelLat = fc.lat + (labelOffsetKm / 111) * Math.cos(rad);
      labelLon = fc.lon + (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);
      distToCur = Math.sqrt(Math.pow((labelLat - lat) * 111, 2) + Math.pow((labelLon - lon) * 111 * Math.cos((lat + labelLat) / 2 * Math.PI / 180), 2));
      attempts++;
    }`
);

// Remove the old maxCurRadius definition
content = content.replace(
  /  const maxCurRadius = Math\.max\(\.\.\.\(cur\.stormRadii\|\|\[\]\)\.map\(\(r: any\)=>r\.radiusKm\), \.\.\.\(cur\.galeRadii\|\|\[\]\)\.map\(\(r: any\)=>r\.radiusKm\), 0\);\r?\n/,
  ''
);

fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
console.log('Fixed forecast label offset');
