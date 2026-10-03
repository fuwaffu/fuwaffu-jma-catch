const fs = require('fs');

function fixSeaColor(filePath, oldColor) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace background color for the map div
  // In App.tsx: backgroundColor: '#e2e8f0'
  // In ObsApp.tsx: backgroundColor: '#475569'
  content = content.replace(
    new RegExp(`backgroundColor: '${oldColor}'`, 'g'),
    `backgroundColor: '#87cefa'`
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed sea color in', filePath);
}

fixSeaColor('./frontend/src/App.tsx', '#e2e8f0');
fixSeaColor('./frontend/src/ObsApp.tsx', '#475569');
