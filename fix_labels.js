const fs = require('fs');
let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');

// Use string replacement instead of regex to avoid escaping issues
const oldForecastHtml1 = "    const html = isObs \n      ? `<div style=\"color:#1e293b;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;white-space:nowrap;font-family:'Zen Kaku Gothic Paren', 'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);\">${timeLabel}</div>`\n      : `<div style=\"font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,255,255,0.92);border:1px solid #999;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#333;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;\">${timeLabel}</div>`;";

const oldForecastHtml2 = "    const html = isObs \r\n      ? `<div style=\"color:#1e293b;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;white-space:nowrap;font-family:'Zen Kaku Gothic Paren', 'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);\">${timeLabel}</div>`\r\n      : `<div style=\"font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,255,255,0.92);border:1px solid #999;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#333;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;\">${timeLabel}</div>`;";

const newForecastHtml = `    const html = isObs 
      ? \`<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,255,255,0.92);border:2px solid #999;border-radius:6px;padding:4px 10px;font-size:16px;font-weight:700;color:#333;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,0.2); transform: translate(-50%, -50%); display: inline-block;">\${timeLabel}</div>\`
      : \`<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,255,255,0.92);border:1px solid #999;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#333;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;">\${timeLabel}</div>\`;`;

const oldCurHtml1 = "  const curHtml = isObs\n    ? `<div style=\"color:#FF2800;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;white-space:nowrap;font-family:'Zen Kaku Gothic Paren', 'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);\">${curTimeLabel}</div>`\n    : `<div style=\"font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,240,240,0.92);border:1px solid #FF2800;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#FF2800;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;\">${curTimeLabel}</div>`;";

const oldCurHtml2 = "  const curHtml = isObs\r\n    ? `<div style=\"color:#FF2800;font-weight:700;font-size:16px;text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;white-space:nowrap;font-family:'Zen Kaku Gothic Paren', 'LINE Seed JP',sans-serif;transform:translate(-50%,-50%);\">${curTimeLabel}</div>`\r\n    : `<div style=\"font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,240,240,0.92);border:1px solid #FF2800;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#FF2800;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;\">${curTimeLabel}</div>`;";

const newCurHtml = `  const curHtml = isObs
    ? \`<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,240,240,0.92);border:2px solid #FF2800;border-radius:6px;padding:4px 10px;font-size:16px;font-weight:700;color:#FF2800;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,0.2); transform: translate(-50%, -50%); display: inline-block;">\${curTimeLabel}</div>\`
    : \`<div style="font-family: 'Zen Kaku Gothic Paren', 'LINE Seed JP', sans-serif; background:rgba(255,240,240,0.92);border:1px solid #FF2800;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#FF2800;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15); transform: translate(-50%, -50%); display: inline-block;">\${curTimeLabel}</div>\`;`;

content = content.replace(oldForecastHtml1, newForecastHtml).replace(oldForecastHtml2, newForecastHtml);
content = content.replace(oldCurHtml1, newCurHtml).replace(oldCurHtml2, newCurHtml);

fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
console.log('Fixed labels');
