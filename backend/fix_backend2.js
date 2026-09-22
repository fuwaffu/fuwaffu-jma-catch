const fs = require('fs');

let code = fs.readFileSync('index.ts', 'utf8');

// Remove fetch and queue from Logic
const fetchStart = code.indexOf('async fetch(request');
if (fetchStart !== -1) {
  // Find where fetch ends by finding 'async queue' or 'async processQueueAdaptive'
  const nextMethodStart = code.indexOf('async processQueueAdaptive', fetchStart);
  if (nextMethodStart !== -1) {
    code = code.substring(0, fetchStart) + code.substring(nextMethodStart);
  }
}

// Remove any remaining invalidateApiCaches calls
code = code.replace(/await invalidateApiCaches\(\);/g, '');

fs.writeFileSync('index.ts', code);
console.log('Fixed index.ts successfully!');
