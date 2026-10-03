const fs = require('fs');

let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');

const polyFunc = \  const getAsymmetricPolygon = (eyeLat: number, eyeLon: number, radii: any[], numPoints = 72) => {
    if (!radii || radii.length === 0) return null;
    const all = radii.find((r: any) => r.direction === '‘Sˆæ' || !r.direction);
    
    let maxR = 0, minOppositeR = 0, maxDir = '';
    const dirAngles: Record<string, number> = {
      '–k': 0, '–k–k“Œ': 22.5, '–k“Œ': 45, '“Œ–k“Œ': 67.5,
      '“Œ': 90, '“Œ“ì“Œ': 112.5, '“ì“Œ': 135, '“ì“ì“Œ': 157.5,
      '“ì': 180, '“ì“ì¼': 202.5, '“ì¼': 225, '¼“ì¼': 247.5,
      '¼': 270, '¼–k¼': 292.5, '–k¼': 315, '–k–k¼': 337.5
    };

    if (all) {
      maxR = all.radiusKm;
      minOppositeR = all.radiusKm;
      maxDir = '–k'; // arbitrary
    } else {
      for (const r of radii) {
        if (r.radiusKm > maxR) { maxR = r.radiusKm; maxDir = (r.direction || '').replace('‘¤', ''); }
      }
      const maxAngle = dirAngles[maxDir];
      if (maxAngle !== undefined) {
        const oppAngle = (maxAngle + 180) % 360;
        let minDiff = 360;
        for (const r of radii) {
           const dir = (r.direction || '').replace('‘¤', '');
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
      // Is angle within 90 degrees of maxAngle?
      let diff = Math.abs(angle - maxAngle);
      if (diff > 180) diff = 360 - diff;
      
      const r = diff <= 90 ? maxR : minOppositeR;
      const rad = angle * Math.PI / 180;
      const dLat = (r * Math.cos(rad)) / 111;
      const dLon = (r * Math.sin(rad)) / (111 * Math.cos(eyeLat * Math.PI / 180));
      points.push([eyeLat + dLat, eyeLon + dLon]);
    }
    return points;
  };\;

content = content.replace(/  const getTrueCircleFromRadii = [\s\S]*?return \{ lat: eyeLat \+ dLat, lon: eyeLon \+ dLon, radius: \(maxR \+ minOppositeR\) \/ 2 \};\r?\n  \};\r?\n/m, polyFunc + "\n\n$&");

const oldGale = /  const curGaleCircle = getTrueCircleFromRadii\(lat, lon, cur\.galeRadii\);\r?\n  addStep\(0, \(\) => \{\r?\n    if \(curGaleCircle && curGaleCircle\.radius > 0\) \{\r?\n      L\.circle\(\[curGaleCircle\.lat, curGaleCircle\.lon\], \{ radius: curGaleCircle\.radius \* 1000, color: '#FFFF00', fillColor: '#FFFF00', fillOpacity: 0\.3, weight: 3, className: isObs \? 'obs-fade-in' : '' \}\)\.addTo\(map\);\r?\n    \}\r?\n  \}\);/m;

const newGale = \  const curGalePoly = getAsymmetricPolygon(lat, lon, cur.galeRadii);
  addStep(0, () => {
    if (curGalePoly && curGalePoly.length > 0) {
      L.polygon(curGalePoly, { color: '#FFFF00', fillColor: '#FFFF00', fillOpacity: 0.3, weight: 3, className: isObs ? 'obs-fade-in' : '' }).addTo(map);
    }
  });\;

const oldStorm = /  const curStormCircle = getTrueCircleFromRadii\(lat, lon, cur\.stormRadii\);\r?\n  addStep\(0, \(\) => \{\r?\n    if \(curStormCircle && curStormCircle\.radius > 0\) \{\r?\n      L\.circle\(\[curStormCircle\.lat, curStormCircle\.lon\], \{ radius: curStormCircle\.radius \* 1000, color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0\.3, weight: 3, className: isObs \? 'obs-fade-in' : '' \}\)\.addTo\(map\);\r?\n    \}\r?\n  \}\);/m;

const newStorm = \  const curStormPoly = getAsymmetricPolygon(lat, lon, cur.stormRadii);
  addStep(0, () => {
    if (curStormPoly && curStormPoly.length > 0) {
      L.polygon(curStormPoly, { color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0.3, weight: 3, className: isObs ? 'obs-fade-in' : '' }).addTo(map);
    }
  });\;

content = content.replace(oldGale, newGale);
content = content.replace(oldStorm, newStorm);

fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
console.log('Fixed wind areas to be asymmetric polygons');
