const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.tsx', 'utf8');
content = content.replace(/const curStormRaw = getStormCircleForPoint\(lat, lon, cur\.stormRadii\);/g, '// const curStormRaw = getStormCircleForPoint(lat, lon, cur.stormRadii);');
fs.writeFileSync('frontend/src/App.tsx', content);
console.log("Success");
