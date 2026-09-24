const fs = require('fs');

const prefList = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", 
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", 
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", 
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", 
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", 
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", 
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
];

function modifyApp(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    
    // We will rewrite the tab logic for warnings.
    const blockStartStr = "{activeTab === 'warnings' && (() => {";
    const blockStartIdx = content.indexOf(blockStartStr);
    
    if (blockStartIdx === -1) {
        console.error("Could not find warnings rendering block");
        return;
    }
    
    // Find the end of this IIFE block
    // It ends with })()} right before {activeTab === 'earthquakes'
    const blockEndStr = "})()}";
    let blockEndIdx = content.indexOf(blockEndStr, blockStartIdx);
    
    if (blockEndIdx === -1) {
        console.error("Could not find end of warnings block");
        return;
    }
    
    const newWarningsRender = `{activeTab === 'warnings' && (() => {
                    const PREFECTURES = ${JSON.stringify(prefList)};
                    
                    if (viewMode === 'municipality') {
                      // 市町村ビュー: 選択された親地域(一次細分区域)に属する市町村を表示
                      const items = Object.values(groupedWarnings).sort((a: any, b: any) => {
                        return new Date(b.reportDateTime).getTime() - new Date(a.reportDateTime).getTime();
                      });
                      
                      return (
                        <>
                          {items.length === 0 && (
                            <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>現在発表されている警報・注意報はありません</td></tr>
                          )}
                          {items.map((g: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc', transition: 'background-color 0.2s' }}>
                              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formatDate(g.reportDateTime)}</td>
                              <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{g.area}</td>
                              <td style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {g.items.map((w: any, j: number) => {
                                  const isWarning = w.warningName.includes('警報') && !w.warningName.includes('注意報');
                                  const isSpecial = w.warningName.includes('特別警報');
                                  return (
                                    <span key={j} style={{
                                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                      backgroundColor: isSpecial ? '#7f1d1d' : (isWarning ? '#fef2f2' : '#f0fdf4'),
                                      color: isSpecial ? '#fff' : (isWarning ? '#dc2626' : '#166534'),
                                      border: \`1px solid \${isSpecial ? '#7f1d1d' : (isWarning ? '#fca5a5' : '#bbf7d0')}\`
                                    }}>{w.warningName}</span>
                                  );
                                })}
                              </td>
                            </tr>
                          ))}
                        </>
                      );
                    } else {
                      // デフォルトビュー: 都道府県ごとに一次細分区域を表示
                      // filteredWarnings には class1 のデータが入っている前提
                      // groupedWarnings は area(一次細分区域) ごとにまとまっている
                      
                      const prefGroups: Record<string, any[]> = {};
                      PREFECTURES.forEach(p => prefGroups[p] = []);
                      
                      Object.values(groupedWarnings).forEach((g: any) => {
                        const pref = g.prefecture;
                        if (prefGroups[pref]) {
                          prefGroups[pref].push(g);
                        } else {
                          // 未知の都道府県があれば最後に押し込むための処理等（通常はない）
                          if (!prefGroups['その他']) prefGroups['その他'] = [];
                          prefGroups['その他'].push(g);
                        }
                      });
                      
                      return (
                        <>
                          {PREFECTURES.map(pref => {
                            const regions = prefGroups[pref] || [];
                            if (regions.length === 0) return null; // 警報がない都道府県は非表示
                            
                            // Sort regions by reportDateTime
                            regions.sort((a: any, b: any) => new Date(b.reportDateTime).getTime() - new Date(a.reportDateTime).getTime());

                            return (
                              <React.Fragment key={pref}>
                                {/* 都道府県見出し */}
                                <tr style={{ backgroundColor: '#e2e8f0' }}>
                                  <td colSpan={3} style={{ padding: '8px 16px', fontWeight: 700, color: '#334155', fontSize: '0.9rem' }}>
                                    {pref}
                                  </td>
                                </tr>
                                {/* 一次細分区域のリスト */}
                                {regions.map((g: any, i: number) => (
                                  <tr 
                                    key={i} 
                                    onClick={() => {
                                      setSelectedParentArea(g.area);
                                      setViewMode('municipality');
                                    }}
                                    style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer', transition: 'background-color 0.2s' }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                  >
                                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formatDate(g.reportDateTime)}</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#2563eb' }}>
                                      {g.area} <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.7rem', marginLeft: '4px', color: '#94a3b8' }}></i>
                                    </td>
                                    <td style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {g.items.map((w: any, j: number) => {
                                        const isWarning = w.warningName.includes('警報') && !w.warningName.includes('注意報');
                                        const isSpecial = w.warningName.includes('特別警報');
                                        return (
                                          <span key={j} style={{
                                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                            backgroundColor: isSpecial ? '#7f1d1d' : (isWarning ? '#fef2f2' : '#f0fdf4'),
                                            color: isSpecial ? '#fff' : (isWarning ? '#dc2626' : '#166534'),
                                            border: \`1px solid \${isSpecial ? '#7f1d1d' : (isWarning ? '#fca5a5' : '#bbf7d0')}\`
                                          }}>{w.warningName}</span>
                                        );
                                      })}
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                          
                          {prefGroups['その他'] && prefGroups['その他'].length > 0 && (
                            <React.Fragment>
                              <tr style={{ backgroundColor: '#e2e8f0' }}>
                                <td colSpan={3} style={{ padding: '8px 16px', fontWeight: 700, color: '#334155', fontSize: '0.9rem' }}>
                                  その他
                                </td>
                              </tr>
                              {prefGroups['その他'].map((g: any, i: number) => (
                                <tr 
                                  key={i} 
                                  onClick={() => {
                                    setSelectedParentArea(g.area);
                                    setViewMode('municipality');
                                  }}
                                  style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer', transition: 'background-color 0.2s' }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                >
                                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formatDate(g.reportDateTime)}</td>
                                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#2563eb' }}>
                                    {g.area} <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.7rem', marginLeft: '4px', color: '#94a3b8' }}></i>
                                  </td>
                                  <td style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {g.items.map((w: any, j: number) => {
                                      const isWarning = w.warningName.includes('警報') && !w.warningName.includes('注意報');
                                      const isSpecial = w.warningName.includes('特別警報');
                                      return (
                                        <span key={j} style={{
                                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                          backgroundColor: isSpecial ? '#7f1d1d' : (isWarning ? '#fef2f2' : '#f0fdf4'),
                                          color: isSpecial ? '#fff' : (isWarning ? '#dc2626' : '#166534'),
                                          border: \`1px solid \${isSpecial ? '#7f1d1d' : (isWarning ? '#fca5a5' : '#bbf7d0')}\`
                                        }}>{w.warningName}</span>
                                      );
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          )}
                        </>
                      );
                    }
                  `;
                  
    content = content.slice(0, blockStartIdx) + newWarningsRender + content.slice(blockEndIdx);
    
    // Replace filteredWarnings block
    content = content.replace(/const filteredWarnings = data\.warnings\.filter\(\(w: any\) => \{[^]+?\}\);/, `const filteredWarnings = data.warnings.filter((w: any) => {
    if (viewMode === 'municipality') {
      if (selectedParentArea) {
        return w.areaType === 'municipality' && (w.parentRegion === selectedParentArea || w.prefecture === selectedParentArea);
      }
      return false;
    } else {
      return w.areaType === 'class1';
    }
  });`);

    // Remove the <select> dropdown in the warnings tab UI
    content = content.replace(/<span style=\{\{ fontSize: '0\.8rem', fontWeight: 600, color: '#475569' \}\}>表示単位:<\/span>\s*<select[^]+?<\/select>/, '<span style={{ fontSize: "0.875rem", color: "#475569", fontWeight: 600 }}>全国の気象警報・注意報</span>');

    // Also we need to make sure the viewMode doesn't get messed up.
    // default should be prefecture? Wait, the state logic:
    // when handleBack is called it sets viewMode to 'prefecture'. 
    // And in handlePopState it sets viewMode to 'prefecture' if no state.
    // Our logic treats both 'prefecture' and anything that is not 'municipality' as the default view.
    
    fs.writeFileSync(filepath, content);
}

modifyApp('frontend/src/App.tsx');
console.log("Success");
