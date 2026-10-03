const fs = require('fs');
let content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');
content = content.replace(/    const forecasts = activeTyphoon\.forecasts \|\| \[\];\r?\n/, '');
fs.writeFileSync('frontend/src/ObsApp.tsx', content);
console.log('Removed unused forecasts variable');
