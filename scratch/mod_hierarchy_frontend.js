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
    
    // Replace filteredWarnings block
    const filterReplace = `const filteredWarnings = warnings.filter((w: any) => {
    if (w.isCancelled) return false;
    
    if (viewMode === 'municipality') {
      if (selectedParentArea) {
        return w.class15 === selectedParentArea || w.class10 === selectedParentArea || w.prefecture === selectedParentArea;
      }
      return false;
    } else {
      return true; // We fetch all municipalities and aggregate them in the render logic
    }
  });`;
    content = content.replace(/const filteredWarnings = warnings\.filter\(\(w: any\) => \{[^]+?\}\);/, filterReplace);

    // Replace the groupedWarnings logic because now we aggregate differently!
    // Actually, App.tsx has:
    // const groupedWarnings = Object.values(filteredWarnings.reduce((acc: any, curr: any) => { ...
    // Let's modify the grouping to just group by `region` (which is municipality in municipality view, or class15 in default view).
    const groupReplace = `const groupedWarnings = Object.values(filteredWarnings.reduce((acc: any, curr: any) => {
    // In municipality view, we show municipalities (curr.region)
    // In default view, we show Secondary Subdivisions (curr.class15) or Primary (curr.class10) if no secondary
    const areaName = viewMode === 'municipality' ? curr.region : (curr.class15 || curr.class10 || curr.prefecture);
    
    if (!acc[areaName]) {
      acc[areaName] = {
        area: areaName,
        prefecture: curr.prefecture,
        class10: curr.class10,
        class15: curr.class15,
        reportDateTime: curr.reportDateTime,
        items: []
      };
    }
    
    // We only keep the highest warning level per warning type if we are aggregating.
    // Actually, just push all and we will de-duplicate warnings by name.
    const existing = acc[areaName].items.find((i: any) => i.warningName === curr.warningName);
    if (!existing) {
      acc[areaName].items.push(curr);
    } else if (getWarningPriority(curr.warningLevel) < getWarningPriority(existing.warningLevel)) {
      // If we found a higher priority warning of the same type, replace it
      existing.warningLevel = curr.warningLevel;
    }
    
    // Update report time if newer
    if (new Date(curr.reportDateTime).getTime() > new Date(acc[areaName].reportDateTime).getTime()) {
      acc[areaName].reportDateTime = curr.reportDateTime;
    }
    return acc;
  }, {}));`;
    content = content.replace(/const groupedWarnings = Object\.values\(filteredWarnings\.reduce\(\(acc: any, curr: any\) => \{[^]+?\}, \{\}\)\);/, groupReplace);

    // Replace the render block
    const blockStartStr = "{activeTab === 'warnings' && (() => {";
    const blockStartIdx = content.indexOf(blockStartStr);
    const blockEndStr = "})()}";
    const blockEndIdx = content.indexOf(blockEndStr, blockStartIdx);
    
    const newWarningsRender = `{activeTab === 'warnings' && (() => {
                    const PREFECTURES = ${JSON.stringify(prefList)};
                    
                    if (viewMode === 'municipality') {
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
                      // デフォルトビュー: 都道府県 > 一次細分区域 > 二次細分区域
                      const prefGroups: Record<string, Record<string, any[]>> = {};
                      PREFECTURES.forEach(p => prefGroups[p] = {});
                      
                      Object.values(groupedWarnings).forEach((row: any) => {
                        const pref = row.prefecture || 'その他';
                        const c10 = row.class10 || 'その他';
                        
                        if (!prefGroups[pref]) prefGroups[pref] = {};
                        if (!prefGroups[pref][c10]) prefGroups[pref][c10] = [];
                        
                        prefGroups[pref][c10].push(row);
                      });
                      
                      return (
                        <>
                          {PREFECTURES.concat(['その他']).map(pref => {
                            const class10Groups = prefGroups[pref];
                            if (!class10Groups || Object.keys(class10Groups).length === 0) return null;
                            
                            return (
                              <React.Fragment key={pref}>
                                {/* 都道府県見出し */}
                                <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>
                                  <td colSpan={3} style={{ padding: '8px 16px', fontWeight: 700, color: '#1e293b' }}>
                                    {pref}
                                  </td>
                                </tr>
                                
                                {/* 一次細分区域グループ */}
                                {Object.keys(class10Groups).map(c10 => {
                                  const regions = class10Groups[c10];
                                  regions.sort((a: any, b: any) => new Date(b.reportDateTime).getTime() - new Date(a.reportDateTime).getTime());
                                  
                                  return (
                                    <React.Fragment key={c10}>
                                      {/* 一次細分区域見出し */}
                                      {c10 !== 'その他' && (
                                        <tr style={{ backgroundColor: '#f8fafc' }}>
                                          <td colSpan={3} style={{ padding: '6px 16px', fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
                                            ■ {c10}
                                          </td>
                                        </tr>
                                      )}
                                      
                                      {/* 二次細分区域のリスト */}
                                      {regions.map((row: any, i: number) => (
                                        <tr 
                                          key={row.area + '-' + i} 
                                          className="slide-in-row fade-update" style={{ borderBottom: '1px solid #f1f5f9' }}
                                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                        >
                                          <td style={{ padding: '12px 16px', color: '#64748b', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{new Date(row.reportDateTime).toLocaleString()}</td>
                                          <td 
                                            style={{
                                              padding: '12px 16px', fontWeight: 500, color: '#1e293b', verticalAlign: 'middle',
                                              cursor: 'pointer',
                                              textDecoration: 'underline',
                                              textDecorationColor: '#93c5fd',
                                              textUnderlineOffset: '4px',
                                              paddingLeft: c10 !== 'その他' ? '24px' : '16px'
                                            }}
                                            onClick={() => {
                                              setSelectedParentArea(row.area); // row.area is class15 here
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
                              </React.Fragment>
                            );
                          })}
                        </>
                      );
                    }
                  `;
                  
    content = content.slice(0, blockStartIdx) + newWarningsRender + content.slice(blockEndIdx);

    // Also update the breadcrumb / back button logic text
    content = content.replace(
      /{viewMode === 'municipality' \? '地方・区域に戻る' : '都道府県に戻る'}/g,
      "{viewMode === 'municipality' ? '二次細分区域に戻る' : '都道府県に戻る'}"
    );
    
    fs.writeFileSync(filepath, content);
}

modifyApp('frontend/src/App.tsx');
console.log("Success frontend");
