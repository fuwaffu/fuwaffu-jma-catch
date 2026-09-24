const fs = require('fs');

let app = fs.readFileSync('frontend/src/App.tsx', 'utf8');
app = app.replace(/const getOuterTangentPolygon = \(points: \{ lat: number, lon: number, r: number \}\[\]\) =>/g, "const getOuterTangentPolygon = (_points: any) =>");
fs.writeFileSync('frontend/src/App.tsx', app);

let obs = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');
obs = obs.replace(/const getOuterTangentPolygon = \(points: \{ lat: number, lon: number, r: number \}\[\]\) =>/g, "const getOuterTangentPolygon = (_points: any) =>");
fs.writeFileSync('frontend/src/ObsApp.tsx', obs);

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
src: local('Zen Kaku Gothic New Black'), local('Zen Kaku Gothic New');
font-weight: 900;
unicode-range: U+0028, U+0029;
}
`;
    fs.writeFileSync('frontend/src/index.css', css + fontFace);
}
console.log("Success");
