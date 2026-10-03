const fs = require('fs');

let content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

const regex = /<div style={{ fontSize: '28px', color: '#93c5fd', marginBottom: '8px', fontWeight: 700 }}>\s*台風<span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900, fontSize: '40px', margin: '0 6px' }}>{typhoonNum}<\/span>号\s*<span style={{ fontSize: '20px', color: '#cbd5e1', marginLeft: '12px' }}>\({activeTyphoon\.nameEn}\)<\/span>\s*<\/div>\s*<div style={{ fontSize: '56px', fontWeight: 700, letterSpacing: '2px', lineHeight: 1\.1 }}>\s*{activeTyphoon\.name}\s*<\/div>/m;

const newTitleCode = `<div style={{ fontSize: '56px', color: '#93c5fd', marginBottom: '8px', fontWeight: 700, lineHeight: 1.1 }}>
            台風<span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900, fontSize: '72px', margin: '0 8px' }}>{typhoonNum}</span>号
            <span style={{ fontSize: '24px', color: '#cbd5e1', marginLeft: '16px', fontWeight: 600 }}>({activeTyphoon.nameEn})</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '2px' }}>
            {activeTyphoon.name}
          </div>`;

content = content.replace(regex, newTitleCode);
fs.writeFileSync('frontend/src/ObsApp.tsx', content);
console.log('Swapped title sizes in ObsApp.tsx');
