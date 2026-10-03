const fs = require('fs');

let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');

const oldBlock1 = `  // 8. DB表示の場合のみ、現在位置の×印とポップアップを追加
  if (!isObs) {
    addStep(0, () => {
      const typhoonIcon = L.divIcon({
        html: '<div style="font-size:24px;text-align:center;line-height:1;color:#FF2800;font-weight:bold;text-shadow:1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;">×</div>',
        iconSize: [24, 24], iconAnchor: [12, 12], className: isObs ? 'obs-fade-in' : '',
      });
      L.marker([lat, lon], { icon: typhoonIcon }).addTo(map)
        .bindPopup(\`<b>\${typhoon.name?.text || ''}</b><br>\${cur.location || ''}<br>\${cur.pressure}hPa / 最大風速\${cur.maxWind}m/s\`);
    });
  }`;

const oldBlock2 = oldBlock1.replace(/\n/g, "\r\n");

const newBlock = `  // 8. 現在位置の×印とポップアップ（ポップアップはDBのみ）
  addStep(0, () => {
    const typhoonIcon = L.divIcon({
      html: '<div style="font-size:24px;text-align:center;line-height:1;color:#FF2800;font-weight:bold;text-shadow:1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;">×</div>',
      iconSize: [24, 24], iconAnchor: [12, 12], className: isObs ? 'obs-fade-in' : '',
    });
    const m = L.marker([lat, lon], { icon: typhoonIcon }).addTo(map);
    if (!isObs) {
      m.bindPopup(\`<b>\${typhoon.name?.text || ''}</b><br>\${cur.location || ''}<br>\${cur.pressure}hPa / 最大風速\${cur.maxWind}m/s\`);
    }
  });`;

content = content.replace(oldBlock1, newBlock).replace(oldBlock2, newBlock);

fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
console.log('Fixed x mark visibility');
