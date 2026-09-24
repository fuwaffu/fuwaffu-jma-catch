const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.tsx', 'utf8');
const regex = /const getStormCircleForPoint = \([^]+?\};\s*/g;
content = content.replace(regex, '');
fs.writeFileSync('frontend/src/App.tsx', content);
console.log("Success");
