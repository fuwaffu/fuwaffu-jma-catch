const fs = require('fs');

// 1. Update drawTyphoon.ts animation speed
let drawPath = 'frontend/src/utils/drawTyphoon.ts';
let drawContent = fs.readFileSync(drawPath, 'utf8');
drawContent = drawContent.replace(/i \* 600\); \/\/ 600ms per step/g, 'i * 350); // 350ms per step');
fs.writeFileSync(drawPath, drawContent);
console.log('Fixed animation speed');

// 2. Update ObsApp.tsx info box
let obsPath = 'frontend/src/ObsApp.tsx';
let obsContent = fs.readFileSync(obsPath, 'utf8');
const oldStyle = "fontFamily: \"'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif\"";
const newStyle = "fontFamily: \"'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif\", animation: 'fadeInSlide 0.8s ease-out forwards'";
obsContent = obsContent.replace(oldStyle, newStyle);
fs.writeFileSync(obsPath, obsContent);
console.log('Added animation to info box in ObsApp.tsx');

// 3. Add keyframes to index.css
let cssPath = 'frontend/src/index.css';
let cssContent = fs.readFileSync(cssPath, 'utf8');
if (!cssContent.includes('fadeInSlide')) {
  cssContent += `

@keyframes fadeInSlide {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
  fs.writeFileSync(cssPath, cssContent);
  console.log('Added keyframes to index.css');
}
