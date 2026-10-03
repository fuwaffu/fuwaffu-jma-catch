const fs = require('fs');

let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');
if (content.includes('getAsymmetricPolygon')) {
  console.log('Already exists');
  process.exit(0);
}
