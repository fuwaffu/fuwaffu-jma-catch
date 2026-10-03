const fs = require('fs');

let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');

const checkCollisionRegex = /  const checkCollision = \(lLat: number, lLon: number\) => \{\r?\n    let maxDist = 0;/;
const newCheckCollision = `  const placedLabels: {lat: number, lon: number}[] = [];
  const checkCollision = (lLat: number, lLon: number) => {
    let hasCollision = false;
    for (const pl of placedLabels) {
      const d = Math.sqrt(Math.pow((lLat - pl.lat) * 111, 2) + Math.pow((lLon - pl.lon) * 111 * Math.cos((pl.lat + lLat) / 2 * Math.PI / 180), 2));
      if (d < 100) hasCollision = true;
    }
    
    let maxDist = 0;`;
content = content.replace(checkCollisionRegex, newCheckCollision);

const checkCollisionReturnRegex = /return maxDist > 0;\r?\n  \};/;
content = content.replace(checkCollisionReturnRegex, "return hasCollision || maxDist > 0;\n  };");

content = content.replace(/L\.polyline\(\[\[fc\.lat, fc\.lon\], \[labelLat, labelLon\]\]/g, "placedLabels.push({lat: labelLat, lon: labelLon});\n      L.polyline([[fc.lat, fc.lon], [labelLat, labelLon]]");
content = content.replace(/L\.polyline\(\[\[lat, lon\], \[curLabelLat, curLabelLon\]\]/g, "placedLabels.push({lat: curLabelLat, lon: curLabelLon});\n    L.polyline([[lat, lon], [curLabelLat, curLabelLon]]");

const oldHtml1 = "padding:4px 10px;font-size:16px;font-weight:700";
const newHtml1 = "padding:3px 7px;font-size:12px;font-weight:700";
content = content.replace(new RegExp(oldHtml1, 'g'), newHtml1);

fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
console.log('Fixed label overlapping and sizes');
