const fs = require('fs');

let content = fs.readFileSync('frontend/src/App.tsx', 'utf8');
let lines = content.split('\n');

// Unused functions start at 904 and end at 944 (1-indexed), which is index 903 to 943
for (let i = 903; i <= 943; i++) {
    if (lines[i] !== undefined) {
        lines[i] = '// ' + lines[i];
    }
}

fs.writeFileSync('frontend/src/App.tsx', lines.join('\n'));
console.log("Success");
