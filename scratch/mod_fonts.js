const fs = require('fs');

function applyFonts() {
    let indexHtml = fs.readFileSync('frontend/index.html', 'utf8');
    if (!indexHtml.includes('Zen+Kaku+Gothic+New')) {
        indexHtml = indexHtml.replace(
            '<link href="https://fonts.googleapis.com/css2?',
            '<link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@900&'
        );
        fs.writeFileSync('frontend/index.html', indexHtml);
    }

    let css = fs.readFileSync('frontend/src/index.css', 'utf8');
    if (!css.includes('Zen Kaku Gothic Paren')) {
        const fontFace = `
@font-face {
  font-family: 'Zen Kaku Gothic Paren';
  /* Using local font name to let the OS or Google Fonts stylesheet provide the font */
  src: local('Zen Kaku Gothic New Black'), local('Zen Kaku Gothic New');
  font-weight: 900;
  unicode-range: U+0028, U+0029;
}
`;
        fs.writeFileSync('frontend/src/index.css', css + fontFace);
    }

    // Now update inline font families
    let app = fs.readFileSync('frontend/src/App.tsx', 'utf8');
    app = app.replace(/'LINE Seed JP'/g, "'Zen Kaku Gothic Paren', 'LINE Seed JP'");
    fs.writeFileSync('frontend/src/App.tsx', app);

    let obs = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');
    obs = obs.replace(/'LINE Seed JP'/g, "'Zen Kaku Gothic Paren', 'LINE Seed JP'");
    
    // Also fix the span in ObsApp for the typhoon title
    obs = obs.replace(
        `({activeTyphoon.nameEn})`,
        `<span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900 }}>(</span>{activeTyphoon.nameEn}<span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900 }}>)</span>`
    );
    
    // And for time labels since they use string interpolation:
    const timeLabelRegex = /`\$\{day\}日\(\$\{weekDay\}\)([^`]+)`/g;
    app = app.replace(timeLabelRegex, "`\\$\\{day\\}日<span style=\\\"font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;\\\">(</span>\\$\\{weekDay\\}<span style=\\\"font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;\\\">)</span>$1`");
    obs = obs.replace(timeLabelRegex, "`\\$\\{day\\}日<span style=\\\"font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;\\\">(</span>\\$\\{weekDay\\}<span style=\\\"font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;\\\">)</span>$1`");

    fs.writeFileSync('frontend/src/App.tsx', app);
    fs.writeFileSync('frontend/src/ObsApp.tsx', obs);
}

applyFonts();
console.log("Success");
