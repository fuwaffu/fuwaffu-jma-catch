const fs = require('fs');

function revertSpanTags(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Remove spans around left parenthesis
    content = content.replace(/<span style="[^"]*?Zen Kaku Gothic New[^"]*?">\s*\(\s*<\/span>/g, '(');
    // Remove spans around right parenthesis
    content = content.replace(/<span style="[^"]*?Zen Kaku Gothic New[^"]*?">\s*\)\s*<\/span>/g, ')');
    
    // For single quotes version in React JSX (ObsApp title)
    content = content.replace(/<span style=\{\{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900 \}\}>\s*\(\s*<\/span>/g, '(');
    content = content.replace(/<span style=\{\{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900 \}\}>\s*\)\s*<\/span>/g, ')');
    
    // Just to be absolutely safe, let's also remove any escaped versions from my regex
    content = content.replace(/<span style=\\"font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;\\">\(/g, '(');
    content = content.replace(/<span style=\\"font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;\\">\)/g, ')');

    fs.writeFileSync(filepath, content);
}

revertSpanTags('frontend/src/App.tsx');
revertSpanTags('frontend/src/ObsApp.tsx');
console.log("Success");
