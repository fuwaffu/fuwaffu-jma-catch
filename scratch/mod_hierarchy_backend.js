const fs = require('fs');

let backendContent = fs.readFileSync('backend/index.ts', 'utf8');

// Update getHierarchyNames in backend
const newHierarchyFn = `const getHierarchyNames = (code: string) => {
                  let pref = '';
                  let class10 = '';
                  let class15 = '';
                  let muni = areaCodeToName(code);
                  
                  if (areaData.class20s && areaData.class20s[code]) {
                      const parent = areaData.class20s[code].parent;
                      if (areaData.class15s && areaData.class15s[parent]) {
                          class15 = areaData.class15s[parent].name;
                          const c10 = areaData.class15s[parent].parent;
                          if (areaData.class10s && areaData.class10s[c10]) {
                              class10 = areaData.class10s[c10].name;
                              const off = areaData.class10s[c10].parent;
                              if (areaData.offices && areaData.offices[off]) pref = areaData.offices[off].name;
                          }
                      } else if (areaData.class10s && areaData.class10s[parent]) {
                          class10 = areaData.class10s[parent].name;
                          const off = areaData.class10s[parent].parent;
                          if (areaData.offices && areaData.offices[off]) pref = areaData.offices[off].name;
                      }
                  } else if (areaData.class15s && areaData.class15s[code]) {
                      class15 = areaData.class15s[code].name;
                      const c10 = areaData.class15s[code].parent;
                      if (areaData.class10s && areaData.class10s[c10]) {
                          class10 = areaData.class10s[c10].name;
                          const off = areaData.class10s[c10].parent;
                          if (areaData.offices && areaData.offices[off]) pref = areaData.offices[off].name;
                      }
                  } else if (areaData.class10s && areaData.class10s[code]) {
                      class10 = areaData.class10s[code].name;
                      const off = areaData.class10s[code].parent;
                      if (areaData.offices && areaData.offices[off]) pref = areaData.offices[off].name;
                  } else if (areaData.offices && areaData.offices[code]) {
                      pref = areaData.offices[code].name;
                  }
                  
                  pref = normalizePrefectureName(pref || OFFICE_CODE_TO_PREF[code] || '');
                  return { pref, class10, class15, muni };
              };`;

backendContent = backendContent.replace(/const getHierarchyNames = \(code: string\) => \{[^]+?return \{ pref, reg, muni \};\s*\};/, newHierarchyFn);

// Update warningsData.push
const newPush = `const { pref, class10, class15, muni } = getHierarchyNames(areaCode);
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
                              }`;
backendContent = backendContent.replace(/const \{ pref, reg, muni \} = getHierarchyNames\(areaCode\);[^]+?\}\s*\}\s*\}\s*\}/, newPush);

fs.writeFileSync('backend/index.ts', backendContent);
console.log("Success backend");
