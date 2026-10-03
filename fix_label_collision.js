const fs = require('fs');

let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');

const oldCode1 = "      let distToCur = Math.sqrt(Math.pow((labelLat - lat) * 111, 2) + Math.pow((labelLon - lon) * 111 * Math.cos((lat + labelLat) / 2 * Math.PI / 180), 2));\n      let attempts = 0;\n      while (distToCur < maxCurRadius + 40 && attempts < 20) {\n        labelOffsetKm += 30;\n        labelLat = fc.lat + (labelOffsetKm / 111) * Math.cos(rad);\n        labelLon = fc.lon + (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);\n        distToCur = Math.sqrt(Math.pow((labelLat - lat) * 111, 2) + Math.pow((labelLon - lon) * 111 * Math.cos((lat + labelLat) / 2 * Math.PI / 180), 2));\n        attempts++;\n      }";

const oldCode2 = "      let distToCur = Math.sqrt(Math.pow((labelLat - lat) * 111, 2) + Math.pow((labelLon - lon) * 111 * Math.cos((lat + labelLat) / 2 * Math.PI / 180), 2));\r\n      let attempts = 0;\r\n      while (distToCur < maxCurRadius + 40 && attempts < 20) {\r\n        labelOffsetKm += 30;\r\n        labelLat = fc.lat + (labelOffsetKm / 111) * Math.cos(rad);\r\n        labelLon = fc.lon + (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);\r\n        distToCur = Math.sqrt(Math.pow((labelLat - lat) * 111, 2) + Math.pow((labelLon - lon) * 111 * Math.cos((lat + labelLat) / 2 * Math.PI / 180), 2));\r\n        attempts++;\r\n      }";

const newCode = `      // Collision detection against actual circle centers and radii
      const checkCollision = (lLat: number, lLon: number) => {
        let maxDist = 0;
        if (curGaleCircle && curGaleCircle.radius > 0) {
          const dG = Math.sqrt(Math.pow((lLat - curGaleCircle.lat) * 111, 2) + Math.pow((lLon - curGaleCircle.lon) * 111 * Math.cos((curGaleCircle.lat + lLat) / 2 * Math.PI / 180), 2));
          if (dG < curGaleCircle.radius + 100) maxDist = curGaleCircle.radius + 100 - dG;
        }
        if (curStormCircle && curStormCircle.radius > 0) {
          const dS = Math.sqrt(Math.pow((lLat - curStormCircle.lat) * 111, 2) + Math.pow((lLon - curStormCircle.lon) * 111 * Math.cos((curStormCircle.lat + lLat) / 2 * Math.PI / 180), 2));
          if (dS < curStormCircle.radius + 100) maxDist = Math.max(maxDist, curStormCircle.radius + 100 - dS);
        }
        return maxDist > 0;
      };

      let attempts = 0;
      while (checkCollision(labelLat, labelLon) && attempts < 30) {
        labelOffsetKm += 50; // Push outwards more aggressively
        labelLat = fc.lat + (labelOffsetKm / 111) * Math.cos(rad);
        labelLon = fc.lon + (labelOffsetKm / (111 * Math.cos(fc.lat * Math.PI / 180))) * Math.sin(rad);
        attempts++;
      }`;

content = content.replace(oldCode1, newCode).replace(oldCode2, newCode);
fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
console.log('Fixed label collision detection');
