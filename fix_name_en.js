const fs = require('fs');

let content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

const oldTitleCode = \          <div style={{ fontSize: '56px', color: '#93c5fd', marginBottom: '8px', fontWeight: 700, lineHeight: 1.1 }}>
            ë‰ïó<span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900, fontSize: '72px', margin: '0 8px' }}>{typhoonNum}</span>çÜ
            <span style={{ fontSize: '24px', color: '#cbd5e1', marginLeft: '16px', fontWeight: 600 }}>({activeTyphoon.nameEn})</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '2px' }}>
            {activeTyphoon.name}
          </div>\;

const newTitleCode = \          <div style={{ fontSize: '56px', color: '#93c5fd', marginBottom: '8px', fontWeight: 700, lineHeight: 1.1 }}>
            ë‰ïó<span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900, fontSize: '72px', margin: '0 8px' }}>{typhoonNum}</span>çÜ
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '2px' }}>
            {activeTyphoon.name}
            <span style={{ fontSize: '20px', color: '#cbd5e1', marginLeft: '12px', fontWeight: 600, letterSpacing: 'normal' }}>({activeTyphoon.nameEn})</span>
          </div>\;

content = content.replace(oldTitleCode, newTitleCode);
content = content.replace(oldTitleCode.replace(/\\n/g, '\\r\\n'), newTitleCode);

fs.writeFileSync('frontend/src/ObsApp.tsx', content);
console.log('Fixed english name position in ObsApp.tsx');
