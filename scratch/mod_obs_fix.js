const fs = require('fs');
let content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

// Remove the gradient overlay completely
content = content.replace(
    /\{\/\* グラデーションオーバーレイ \(情報が見やすいように\) \*\/\}[^]+?\}\} \/>/,
    ""
);

fs.writeFileSync('frontend/src/ObsApp.tsx', content);
console.log("Success");
