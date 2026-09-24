const fs = require('fs');

let c = fs.readFileSync('backend/index.ts', 'utf8');

const correctBlock = `              try {
                  for (const report of mapData) {
                      if (!report.areaTypes) continue;
                      const rDate = report.reportDatetime || reportDateTimeFallback;
                      for (const areaTypeObj of report.areaTypes) {
                          for (const area of areaTypeObj.areas) {
                              const areaCode = area.code;
                              const { pref, class10, class15, muni } = getHierarchyNames(areaCode);
                              for (const w of area.warnings) {
                                  if (w.status === '発表' || w.status === '継続') {
                                      const warningCode = w.code;
                                      const wInfo = WARNING_CODES[warningCode];
                                      if (wInfo) {
                                          warningsData.push({
                                              xmlId: \`mapjson-\${areaCode}-\${warningCode}\`,
                                              reportDateTime: rDate,
                                              prefecture: pref,
                                              class10: class10,
                                              class15: class15,
                                              region: muni,
                                              warningCode: warningCode,
                                              warningName: wInfo.name,
                                              warningLevel: wInfo.level,
                                              infoType: '発表',
                                              status: w.status,
                                              isCancelled: false,
                                              areaType: 'municipality'
                                          });
                                      }
                                  }
                              }
                          }
                      }
                  }
              } catch (e: any) {`;

c = c.replace(/try\s*\{\s*for \(const report of mapData\) \{[^]+?\} catch \(e: any\) \{/, correctBlock);
fs.writeFileSync('backend/index.ts', c);
console.log("Syntax fixed");
