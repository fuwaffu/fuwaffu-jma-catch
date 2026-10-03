const fs = require('fs');

let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');

const oldLabelAngle1 = "      const timeLabel = formatForecastTime(fc.dateTime);\n      const angle = (idx % 2 === 0) ? -90 : 90; // Left or Right\n      let labelOffsetKm = (fc.circleRadiusKm || 50) + (isObs ? 160 : 90); \n      const rad = angle * Math.PI / 180;";
const oldLabelAngle2 = "      const timeLabel = formatForecastTime(fc.dateTime);\r\n      const angle = (idx % 2 === 0) ? -90 : 90; // Left or Right\r\n      let labelOffsetKm = (fc.circleRadiusKm || 50) + (isObs ? 160 : 90); \r\n      const rad = angle * Math.PI / 180;";

const newLabelAngle = `      const timeLabel = formatForecastTime(fc.dateTime);
      let dLat = fc.lat - lat;
      let dLon = (fc.lon - lon) * Math.cos(lat * Math.PI / 180);
      if (idx > 0) {
        const prev = forecasts[idx - 1];
        dLat = fc.lat - prev.lat;
        dLon = (fc.lon - prev.lon) * Math.cos(prev.lat * Math.PI / 180);
      }
      const pathAngle = Math.atan2(dLon, dLat) * 180 / Math.PI;
      const angle = pathAngle + ((idx % 2 === 0) ? -90 : 90); // Left or Right of path
      
      let labelOffsetKm = (fc.circleRadiusKm || 50) + (isObs ? 200 : 120); 
      const rad = angle * Math.PI / 180;`;

content = content.replace(oldLabelAngle1, newLabelAngle).replace(oldLabelAngle2, newLabelAngle);

content = content.replace(/cRadius \+ 140/g, 'cRadius + 200');

const oldCurLabelAngle1 = "    let curLabelOffsetKm = 60;\n    const curRad = -90 * Math.PI / 180; // Left";
const oldCurLabelAngle2 = "    let curLabelOffsetKm = 60;\r\n    const curRad = -90 * Math.PI / 180; // Left";

const newCurLabelAngle = `    let curLabelOffsetKm = 90;
    let pathAngle = 0;
    if (forecasts.length > 0) {
      const f = forecasts[0];
      pathAngle = Math.atan2((f.lon - lon)*Math.cos(lat*Math.PI/180), f.lat - lat) * 180 / Math.PI;
    }
    const curRad = (pathAngle - 90) * Math.PI / 180; // Left of path`;

content = content.replace(oldCurLabelAngle1, newCurLabelAngle).replace(oldCurLabelAngle2, newCurLabelAngle);

fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
console.log('Fixed label angles and distances in drawTyphoon.ts');
