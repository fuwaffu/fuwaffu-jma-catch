const fs = require('fs');
let content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');
content = content.replace(/backgroundColor: '#475569'/g, "backgroundColor: '#87cefa'");
fs.writeFileSync('frontend/src/ObsApp.tsx', content);
console.log('Fixed ObsApp background color');
