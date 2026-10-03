const fs = require('fs');

let cssPath = 'frontend/src/index.css';
let cssContent = fs.readFileSync(cssPath, 'utf8');
if (!cssContent.includes('obsFadeIn')) {
  cssContent += `

@keyframes obsFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.obs-fade-in {
  animation: obsFadeIn 0.8s ease-out forwards !important;
}
`;
  fs.writeFileSync(cssPath, cssContent);
}

let drawPath = 'frontend/src/utils/drawTyphoon.ts';
let drawContent = fs.readFileSync(drawPath, 'utf8');

// Add className to L.polyline, L.circle, L.circleMarker, L.divIcon
drawContent = drawContent.replace(/className: ''/g, "className: isObs ? 'obs-fade-in' : ''");
// Need to inject className into L.polyline and L.circle options
drawContent = drawContent.replace(/weight: 1\.5, dashArray: '5,5'/g, "weight: 1.5, dashArray: '5,5', className: isObs ? 'obs-fade-in' : ''");
drawContent = drawContent.replace(/weight: 3/g, "weight: 3, className: isObs ? 'obs-fade-in' : ''");
drawContent = drawContent.replace(/weight: 2, opacity: 1/g, "weight: 2, opacity: 1, className: isObs ? 'obs-fade-in' : ''");
drawContent = drawContent.replace(/weight: isObs \? 2 : 1\.5, opacity: 0\.8, dashArray: isObs \? '4,4' : '2,2'/g, "weight: isObs ? 2 : 1.5, opacity: 0.8, dashArray: isObs ? '4,4' : '2,2', className: isObs ? 'obs-fade-in' : ''");
drawContent = drawContent.replace(/pane: 'markerPane'/g, "pane: 'markerPane', className: 'obs-fade-in'"); // circleMarker

fs.writeFileSync(drawPath, drawContent);
console.log('Added fade-in animations');
