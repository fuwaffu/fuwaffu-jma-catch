const fs = require('fs');
let content = fs.readFileSync('./frontend/src/App.tsx', 'utf8');
content = content.replace(/height: '450px'/g, "height: '720px'");
fs.writeFileSync('./frontend/src/App.tsx', content);
console.log('Changed map height to 720px');
