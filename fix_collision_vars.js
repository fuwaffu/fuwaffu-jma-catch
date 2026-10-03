const fs = require('fs');
let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');

const regex = /    if \(curGaleCircle\) checkCircle\(curGaleCircle\.lat, curGaleCircle\.lon, curGaleCircle\.radius\);\r?\n    if \(curStormCircle\) checkCircle\(curStormCircle\.lat, curStormCircle\.lon, curStormCircle\.radius\);/m;

const newCollisionCode = `    const curGaleCircleForCol = getTrueCircleFromRadii(lat, lon, cur.galeRadii);
    const curStormCircleForCol = getTrueCircleFromRadii(lat, lon, cur.stormRadii);
    if (curGaleCircleForCol) checkCircle(curGaleCircleForCol.lat, curGaleCircleForCol.lon, curGaleCircleForCol.radius);
    if (curStormCircleForCol) checkCircle(curStormCircleForCol.lat, curStormCircleForCol.lon, curStormCircleForCol.radius);`;

content = content.replace(regex, newCollisionCode);

fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
console.log('Fixed collision check variables');
