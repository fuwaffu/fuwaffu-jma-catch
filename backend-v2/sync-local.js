const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');
const { execSync } = require('child_process');

async function run() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const feedRes = await fetch('https://www.data.jma.go.jp/developer/xml/feed/extra_l.xml');
  const feedXml = await feedRes.text();
  const feed = parser.parse(feedXml);
  
  const entries = Array.isArray(feed.feed.entry) ? feed.feed.entry : [feed.feed.entry];
  
  // Get latest VPWW54 (Warning) for each prefecture
  // Prefectures are identified by their office code in the URL, e.g. _VPWW54_160000.xml
  const latestXmls = new Map();
  for (const entry of entries) {
    if (!entry) continue;
    const title = entry.title;
    const url = entry.id;
    if (title && (title.includes('気象警報・注意報') || title.includes('気象特別警報・警報・注意報'))) {
      const match = url.match(/_VPWW(54|53)_(\d+)\.xml/);
      if (match) {
        const prefCode = match[2];
        if (!latestXmls.has(prefCode)) {
          latestXmls.set(prefCode, url);
        }
      }
    }
  }

  console.log(`Found ${latestXmls.size} latest XMLs to fetch.`);
  let warningsData = [];

  for (const [prefCode, url] of latestXmls.entries()) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      const xml = parser.parse(text);
      const report = xml.Report;
      if (!report || !report.Body || !report.Body.Warning) continue;
      
      const xmlId = url.split('/').pop();
      const reportDateTime = report.Head.ReportDateTime;
      let prefecture = report.Head.Headline.Information?.Item?.Areas?.Area?.Name || '';
      if (!prefecture) {
         // fallback
         const items = Array.isArray(report.Body.Warning) ? report.Body.Warning : [report.Body.Warning];
         for(const w of items) {
            if(w['@_type'] && w['@_type'].includes('府県予報区')) {
               const area = Array.isArray(w.Item?.Area) ? w.Item.Area[0] : w.Item?.Area;
               if(area) prefecture = area.Name;
            }
         }
      }

      if (prefecture.includes('地方') && (prefecture.includes('宗谷') || prefecture.includes('上川') || prefecture.includes('留萌') || prefecture.includes('網走') || prefecture.includes('北見') || prefecture.includes('紋別') || prefecture.includes('十勝') || prefecture.includes('釧路') || prefecture.includes('根室') || prefecture.includes('胆振') || prefecture.includes('日高') || prefecture.includes('石狩') || prefecture.includes('空知') || prefecture.includes('後志') || prefecture.includes('渡島') || prefecture.includes('檜山'))) {
        prefecture = '北海道';
      } else if (prefecture.includes('沖縄') || prefecture.includes('大東島') || prefecture.includes('宮古島') || prefecture.includes('八重山')) {
        prefecture = '沖縄県';
      } else if (prefecture.includes('奄美') || prefecture.includes('鹿児島')) {
        prefecture = '鹿児島県';
      } else if (prefecture === '東京地方') {
        prefecture = '東京都';
      }

      const warnings = Array.isArray(report.Body.Warning) ? report.Body.Warning : [report.Body.Warning];
      for (const warning of warnings) {
        if (!warning) continue;
        const wType = warning['@_type'] || '';
        let areaType = 'unknown';
        if (wType.includes('府県予報区')) areaType = 'prefecture';
        else if (wType.includes('細分区域')) areaType = 'region';
        else if (wType.includes('まとめた地域')) areaType = 'subregion';
        else if (wType.includes('市町村等')) areaType = 'municipality';

        const items = Array.isArray(warning.Item) ? warning.Item : (warning.Item ? [warning.Item] : []);
        for (const item of items) {
          if (!item) continue;
          let areas = [];
          if (item.Area) areas = Array.isArray(item.Area) ? item.Area : [item.Area];
          else if (item.Areas && item.Areas.Area) areas = Array.isArray(item.Areas.Area) ? item.Areas.Area : [item.Areas.Area];
          if (areas.length === 0) continue;

          for (const area of areas) {
            if (!area) continue;
            const region = area.Name;

            const kinds = Array.isArray(item.Kind) ? item.Kind : (item.Kind ? [item.Kind] : []);
            for (const kind of kinds) {
              if (!kind) continue;
              const kindName = kind.Name;
              if (!kindName || kindName.includes('解除') || kindName === 'なし' || kind.Status === '解除') continue;
              
              let wName = kindName.replace(/^レベル[1-5１-５]\s*/, '');
              let level = 'advisory';
              if (wName.includes('特別警報')) level = 'special';
              else if (wName.includes('警報')) level = 'warning';

              if (wName.includes('大雨') || wName.includes('洪水') || wName.includes('氾濫') || wName.includes('高潮') || wName.includes('土砂災害')) {
                if (level === 'special') wName = `レベル5 ${wName}`;
                else if (level === 'warning') wName = wName.includes('高潮') ? `レベル4 ${wName}` : `レベル3 ${wName}`;
                else wName = `レベル2 ${wName}`;
                const lm = wName.match(/レベル([1-5])/);
                if (lm) level = `level_${lm[1]}`;
              }

              warningsData.push({
                xmlId, reportDateTime, region, prefecture, areaType,
                warningCode: kind.Code || '', warningName: wName, warningLevel: level, infoType: '発表', status: kind.Status || '継続'
              });
            }
          }
        }
      }
    } catch(e) {
      console.error(e);
    }
  }

  fs.writeFileSync('warnings_full.json', JSON.stringify(warningsData));
  console.log(`Saved ${warningsData.length} active warnings.`);
  execSync('npx wrangler kv key put warnings --binding WEATHER_DATA_STORE --path warnings_full.json', {stdio: 'inherit'});
  console.log('Successfully pushed to KV.');
}

run();
