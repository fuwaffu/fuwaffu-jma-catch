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
    
    // We rewrite the tab logic for warnings.
    const blockStartStr = "{activeTab === 'warnings' && (() => {";
    const blockStartIdx = content.indexOf(blockStartStr);
    const blockEndStr = "})()}";
    const blockEndIdx = content.indexOf(blockEndStr, blockStartIdx);
    
    if (blockStartIdx === -1 || blockEndIdx === -1) {
        console.error("Could not find warnings rendering block");
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
                          {items.map((row: any, i: number) => (
                            <tr key={row.area + '-' + i} className="slide-in-row fade-update" style={{ borderBottom: '1px solid #f1f5f9' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                              >
                                <td style={{ padding: '12px 16px', color: '#64748b', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{new Date(row.reportDateTime).toLocaleString()}</td>
                                <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1e293b', verticalAlign: 'middle' }}>{row.area}</td>
                                <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {row.items
                                      .sort((a: any, b: any) => getWarningPriority(a.warningLevel) - getWarningPriority(b.warningLevel))
                                      .map((w: any, idx: number) => {
                                        const displayName = formatWarningName(w.warningName);
                                        return (
                                          <span key={idx} style={{
                                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                                            whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            ...getWarningColor(w.warningLevel)
                                          }}>
                                            {displayName}
                                          </span>
                                        );
                                      })}
                                  </div>
                                </td>
                            </tr>
                          ))}
                        </>
                      );
                    } else {
                      // デフォルトビュー: 都道府県ごとに一次細分区域を表示
                      const prefGroups: Record<string, any[]> = {};
                      PREFECTURES.forEach(p => prefGroups[p] = []);
                      
                      Object.values(groupedWarnings).forEach((row: any) => {
                        const pref = row.prefecture || row.area;
                        if (prefGroups[pref]) {
                          prefGroups[pref].push(row);
                        } else {
                          if (!prefGroups['その他']) prefGroups['その他'] = [];
                          prefGroups['その他'].push(row);
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
                                <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>
                                  <td colSpan={3} style={{ padding: '8px 16px', fontWeight: 700, color: '#1e293b' }}>
                                    {pref}
                                  </td>
                                </tr>
                                {/* 一次細分区域のリスト */}
                                {regions.map((row: any, i: number) => (
                                  <tr 
                                    key={row.area + '-' + i} 
                                    className="slide-in-row fade-update" style={{ borderBottom: '1px solid #f1f5f9' }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                  >
                                    <td style={{ padding: '12px 16px', color: '#64748b', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{new Date(row.reportDateTime).toLocaleString()}</td>
                                    <td 
                                      style={{
                                        padding: '12px 16px', fontWeight: 500, color: '#1e293b', verticalAlign: 'middle',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        textDecorationColor: '#93c5fd',
                                        textUnderlineOffset: '4px'
                                      }}
                                      onClick={() => {
                                        setSelectedParentArea(row.area);
                                        setViewMode('municipality');
                                      }}
                                    >
                                      {row.area} <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.7rem', marginLeft: '4px', color: '#94a3b8' }}></i>
                                    </td>
                                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {row.items
                                          .sort((a: any, b: any) => getWarningPriority(a.warningLevel) - getWarningPriority(b.warningLevel))
                                          .map((w: any, idx: number) => {
                                            const displayName = formatWarningName(w.warningName);
                                            return (
                                              <span key={idx} style={{
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                                                whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                ...getWarningColor(w.warningLevel)
                                              }}>
                                                {displayName}
                                              </span>
                                            );
                                          })}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </>
                      );
                    }
                  `;
                  
    content = content.slice(0, blockStartIdx) + newWarningsRender + content.slice(blockEndIdx);
    
    // Replace filteredWarnings block
    content = content.replace(/const filteredWarnings = warnings\.filter\(\(w: any\) => \{[^]+?\}\);/, `const filteredWarnings = data.warnings.filter((w: any) => {
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

    fs.writeFileSync(filepath, content);
}

modifyApp('frontend/src/App.tsx');
console.log("Success");
