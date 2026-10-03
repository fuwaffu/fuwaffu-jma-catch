const fs = require('fs');
let content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

// The line is: map.fitBounds(bounds, { padding: [150, 150], maxZoom: 6 });
content = content.replace(/padding: \[150, 150\]/, 'padding: [110, 110]');
fs.writeFileSync('frontend/src/ObsApp.tsx', content);
console.log('Fixed ObsApp padding');
