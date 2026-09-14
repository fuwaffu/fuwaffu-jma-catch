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
  const OFFICE_CODE_TO_PREF = {
    "011000": "北海道", "012000": "北海道", "013000": "北海道", "014030": "北海道", "014100": "北海道", "015000": "北海道", "016000": "北海道", "017000": "北海道",
    "020000": "青森県", "030000": "岩手県", "040000": "宮城県", "050000": "秋田県", "060000": "山形県", "070000": "福島県",
    "080000": "茨城県", "090000": "栃木県", "100000": "群馬県", "110000": "埼玉県", "120000": "千葉県", "130000": "東京都", "140000": "神奈川県",
    "150000": "新潟県", "160000": "富山県", "170000": "石川県", "180000": "福井県", "190000": "山梨県", "200000": "長野県",
    "210000": "岐阜県", "220000": "静岡県", "230000": "愛知県", "240000": "三重県",
    "250000": "滋賀県", "260000": "京都府", "270000": "大阪府", "280000": "兵庫県", "290000": "奈良県", "300000": "和歌山県",
    "310000": "鳥取県", "320000": "島根県", "330000": "岡山県", "340000": "広島県", "350000": "山口県",
    "360000": "徳島県", "370000": "香川県", "380000": "愛媛県", "390000": "高知県",
    "400000": "福岡県", "410000": "佐賀県", "420000": "長崎県", "430000": "熊本県", "440000": "大分県", "450000": "宮崎県", 
    "460040": "鹿児島県", "460100": "鹿児島県",
    "471000": "沖縄県", "472000": "沖縄県", "473000": "沖縄県", "474000": "沖縄県"
  };

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
      let prefecture = '';
      const idMatch = url.match(/_VPWW(?:53|54)_(\d{6})\.xml/);
      if (idMatch) {
        prefecture = OFFICE_CODE_TO_PREF[idMatch[1]] || '';
      }

      if (!prefecture) {
         prefecture = report.Head.Headline.Information?.Item?.Areas?.Area?.Name || '';
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
