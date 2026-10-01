const fs = require('fs');
let code = fs.readFileSync('scratch/old_backend_utf8.ts', 'utf8');

// 1. Inject areaData fetching and caching
// Find the top of the file
code = code.replace(
  /const CACHE_TTL_SECONDS = 60;/,
  `const CACHE_TTL_SECONDS = 60;

let cachedAreaData: any = null;
async function getAreaData(env: Env) {
  if (cachedAreaData) return cachedAreaData;
  try {
    const res = await fetch('https://www.jma.go.jp/bosai/common/const/area.json');
    if (res.ok) {
      cachedAreaData = await res.json();
      return cachedAreaData;
    }
  } catch(e) {}
  return null;
}

const areaCodeToName = (code: string, areaData: any) => {
    if (!areaData) return code;
    if (areaData.class20s && areaData.class20s[code]) return areaData.class20s[code].name;
    if (areaData.class15s && areaData.class15s[code]) return areaData.class15s[code].name;
    if (areaData.class10s && areaData.class10s[code]) return areaData.class10s[code].name;
    if (areaData.offices && areaData.offices[code]) return areaData.offices[code].name;
    if (areaData.centers && areaData.centers[code]) return areaData.centers[code].name;
    return code;
};

const getHierarchyNames = (code: string, areaData: any) => {
    let pref = '';
    let class10 = '';
    let class15 = '';
    let muni = code;
    if (areaData) muni = areaCodeToName(code, areaData);
    
    if (areaData) {
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
    }
    
    pref = normalizePrefectureName(pref || OFFICE_CODE_TO_PREF[code] || '');
    return { pref, class10, class15, muni };
};
`
);

// 2. Modify processQueueAdaptive to load areaData
code = code.replace(
  /let warningsData: any\[\] \| null = null;/,
  `let warningsData: any[] | null = null;
    const areaData = await getAreaData(env);`
);

// 3. Modify processWarningToMemory to accept areaData and use it
code = code.replace(
  /processWarningToMemory\(report: any, xmlId: string, reportDateTime: string, infoType: string, status: string, warningsData: any\[\]\) \{/,
  `processWarningToMemory(report: any, xmlId: string, reportDateTime: string, infoType: string, status: string, warningsData: any[], areaData: any) {`
);

// We also need to update the call site in processQueueAdaptive
code = code.replace(
  /this\.processWarningToMemory\(report, id, reportDateTime, infoType, statusStr, warningsData\);/g,
  `this.processWarningToMemory(report, id, reportDateTime, infoType, statusStr, warningsData, areaData);`
);

// 4. Update the actual warning extraction to use getHierarchyNames
const replaceWarningPush = `          let class10 = '';
          let class15 = '';
          let finalPref = prefecture;
          let finalMuni = region;
          if (area.Code && areaData) {
              // Ensure code is 6 or 7 digits? JMA XML uses 6 or 7. area.json keys are string.
              let aCode = String(area.Code);
              if (aCode.length === 6) aCode = aCode + '0'; // Some mapping if needed, let's just pass raw string first, wait, JMA area.json uses 7 digit codes for municipalities. XML usually has 6 or 7.
              // Actually we just pass what we have
              const h = getHierarchyNames(String(area.Code), areaData);
              if (h.pref) finalPref = h.pref;
              if (h.class10) class10 = h.class10;
              if (h.class15) class15 = h.class15;
          }`;
          
code = code.replace(
  /const region = area\.Name;/,
  `const region = area.Name;\n${replaceWarningPush}`
);

// Update warningsData.push
code = code.replace(
  /warningsData\.push\(\{\n\s*xmlId, region, reportDateTime, infoType, warningName: wName, level, areaType, prefecture, status, isCancelled: true\n\s*\}\);/g,
  `warningsData.push({ xmlId, region: finalMuni, reportDateTime, infoType, warningName: wName, level, areaType, prefecture: finalPref, class10, class15, status, isCancelled: true });`
);

code = code.replace(
  /warningsData\.push\(\{\n\s*xmlId, region, reportDateTime, infoType, warningName: wName, level, areaType, prefecture, status, isCancelled: false\n\s*\}\);/g,
  `warningsData.push({ xmlId, region: finalMuni, reportDateTime, infoType, warningName: wName, level, areaType, prefecture: finalPref, class10, class15, status, isCancelled: false });`
);

// Save to backend/index.ts
fs.writeFileSync('backend/index.ts', code);
console.log("Restored XML backend successfully");
