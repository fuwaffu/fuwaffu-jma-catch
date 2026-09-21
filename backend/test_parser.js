const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true });
const xml = `
<WarningAreaPart type="暴風域">
  <Circle>
    <Axes>
      <Axis>
        <Direction description="全域" condition="全域" unit="８方位漢字" type="方向"/>
        <Radius description="７０海里" unit="海里" type="半径">70</Radius>
        <Radius description="１３０キロ" unit="km" type="半径">130</Radius>
      </Axis>
    </Axes>
  </Circle>
</WarningAreaPart>`;
console.log(JSON.stringify(parser.parse(xml), null, 2));
