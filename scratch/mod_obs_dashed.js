const fs = require('fs');

let c = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');
c = c.replace(/color: '#666', weight: 1, dashArray: '2,2'/g, "color: '#e2e8f0', weight: 2, dashArray: '4,4'");
fs.writeFileSync('frontend/src/ObsApp.tsx', c);
console.log("Success");
