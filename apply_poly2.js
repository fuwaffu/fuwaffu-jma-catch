const fs = require('fs');

let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');

const polyFunc = `  const getAsymmetricPolygon = (eyeLat: number, eyeLon: number, radii: any[], numPoints = 72) => {
    if (!radii || radii.length === 0) return null;
    const all = radii.find((r: any) => r.direction === '全域' || !r.direction);
    
    let maxR = 0, minOppositeR = 0, maxDir = '';
    const dirAngles: Record<string, number> = {
      '北': 0, '北北東': 22.5, '北東': 45, '東北東': 67.5,
      '東': 90, '東南東': 112.5, '南東': 135, '南南東': 157.5,
      '南': 180, '南南西': 202.5, '南西': 225, '西南西': 247.5,
      '西': 270, '西北西': 292.5, '北西': 315, '北北西': 337.5
    };

    if (all) {
      maxR = all.radiusKm;
      minOppositeR = all.radiusKm;
      maxDir = '北';
    } else {
      for (const r of radii) {
        if (r.radiusKm > maxR) { maxR = r.radiusKm; maxDir = (r.direction || '').replace('側', ''); }
      }
      const maxAngle = dirAngles[maxDir];
      if (maxAngle !== undefined) {
        const oppAngle = (maxAngle + 180) % 360;
        let minDiff = 360;
        for (const r of radii) {
           const dir = (r.direction || '').replace('側', '');
           const angle = dirAngles[dir];
           if (angle !== undefined) {
             let diff = Math.abs(angle - oppAngle);
             if (diff > 180) diff = 360 - diff;
             if (diff < minDiff) { minDiff = diff; minOppositeR = r.radiusKm; }
           }
        }
      } else {
        minOppositeR = maxR;
      }
    }

    const maxAngle = dirAngles[maxDir] || 0;
    const points: [number, number][] = [];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i * 360) / numPoints;
      let diff = Math.abs(angle - maxAngle);
      if (diff > 180) diff = 360 - diff;
      
      const r = diff <= 90 ? maxR : minOppositeR;
      const rad = (angle - 90) * Math.PI / 180;
      const dLat = (r * Math.cos(rad)) / 111;
      const dLon = (r * Math.sin(rad)) / (111 * Math.cos(eyeLat * Math.PI / 180));
      points.push([eyeLat + dLat, eyeLon + dLon]);
    }
    return points;
  };
`;

if (!content.includes('getAsymmetricPolygon(')) {
  content = content.replace(/  const getTrueCircleFromRadii = /m, polyFunc + "\n  const getTrueCircleFromRadii = ");
}

const curGaleStr = `  const curGaleCircle = getTrueCircleFromRadii(lat, lon, cur.galeRadii);
  addStep(0, () => {
    if (curGaleCircle && curGaleCircle.radius > 0) {
      L.circle([curGaleCircle.lat, curGaleCircle.lon], { radius: curGaleCircle.radius * 1000, color: '#FFFF00', fillColor: '#FFFF00', fillOpacity: 0.3, weight: 3, className: isObs ? 'obs-fade-in' : '' }).addTo(map);
    }
  });`;

const newGaleStr = `  const curGalePoly = getAsymmetricPolygon(lat, lon, cur.galeRadii);
  addStep(0, () => {
    if (curGalePoly && curGalePoly.length > 0) {
      L.polygon(curGalePoly as any, { color: '#FFFF00', fillColor: '#FFFF00', fillOpacity: 0.3, weight: 3, className: isObs ? 'obs-fade-in' : '' }).addTo(map);
    }
  });`;

content = content.replace(curGaleStr, newGaleStr);
content = content.replace(curGaleStr.replace(/\n/g, '\r\n'), newGaleStr); // handle crlf

const curStormStr = `  const curStormCircle = getTrueCircleFromRadii(lat, lon, cur.stormRadii);
  addStep(0, () => {
    if (curStormCircle && curStormCircle.radius > 0) {
      L.circle([curStormCircle.lat, curStormCircle.lon], { radius: curStormCircle.radius * 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.3, weight: 3, className: isObs ? 'obs-fade-in' : '' }).addTo(map);
    }
  });`;

const newStormStr = `  const curStormPoly = getAsymmetricPolygon(lat, lon, cur.stormRadii);
  addStep(0, () => {
    if (curStormPoly && curStormPoly.length > 0) {
      L.polygon(curStormPoly as any, { color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.3, weight: 3, className: isObs ? 'obs-fade-in' : '' }).addTo(map);
    }
  });`;

content = content.replace(curStormStr, newStormStr);
content = content.replace(curStormStr.replace(/\n/g, '\r\n'), newStormStr);

fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
console.log('Fixed wind areas to be asymmetric polygons successfully');
