const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});

async function test() {
  const url = 'https://www.data.jma.go.jp/developer/xml/feed/extra.xml';
  const extraXmlStr = await fetch(url).then(r => r.text());
  const extraXml = parser.parse(extraXmlStr);
  const entries = extraXml.feed.entry;
  const vptwEntry = entries.find(e => e.link['@_href'].includes('_VPTW'));
  if (!vptwEntry) { console.log('No VPTW found'); return; }
  const link = vptwEntry.link['@_href'];
  console.log('Fetching', link);
  const xmlStr = await fetch(link).then(r => r.text());
  const xmlData = parser.parse(xmlStr);
  const report = xmlData.Report;
  
  // Drill into structure
  const infos = report.Body?.MeteorologicalInfos;
  const items = Array.isArray(infos?.MeteorologicalInfo) ? infos.MeteorologicalInfo : [infos?.MeteorologicalInfo];
  
  for (const info of items) {
    console.log('=== MeteorologicalInfo ===');
    console.log('DateTime:', info['@_dateTime'] || info.DateTime);
    console.log('Type:', info['@_type']);
    
    const itemObj = info.Item;
    if (!itemObj) continue;
    const itemsArr = Array.isArray(itemObj) ? itemObj : [itemObj];
    
    for (const item of itemsArr) {
      console.log('--- Item ---');
      const kinds = Array.isArray(item.Kind) ? item.Kind : [item.Kind];
      for (const kind of kinds) {
        console.log('Kind.Name:', kind?.Name);
        if (kind?.Property) {
          const prop = kind.Property;
          console.log('Property.Type:', prop.Type);
          if (prop.TyphoonNamePart) {
            console.log('TyphoonNamePart:', JSON.stringify(prop.TyphoonNamePart, null, 2));
          }
          if (prop.ClassPart) {
            console.log('ClassPart:', JSON.stringify(prop.ClassPart, null, 2));
          }
          if (prop.CenterPart) {
            console.log('CenterPart:', JSON.stringify(prop.CenterPart, null, 2));
          }
          if (prop.WindPart) {
            console.log('WindPart keys:', Object.keys(prop.WindPart || {}));
          }
          if (prop.WarningAreaPart) {
            console.log('WarningAreaPart keys:', Object.keys(prop.WarningAreaPart || {}));
          }
        }
      }
      
      if (item.Area) {
        console.log('Area:', JSON.stringify(item.Area, null, 2));
      }
    }
  }
}

test();
