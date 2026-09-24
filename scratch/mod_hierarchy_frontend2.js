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
        return w.class10 === selectedParentArea || w.prefecture === selectedParentArea;
      }
      return false;
    } else {
      return true; // We fetch all municipalities and aggregate them in the render logic
    }
  });`;
    content = content.replace(/const filteredWarnings = data\.warnings\.filter\(\(w: any\) => \{[^]+?\}\);/, filterReplace); // wait, it was reverted to warnings.filter
    content = content.replace(/const filteredWarnings = warnings\.filter\(\(w: any\) => \{[^]+?\}\);/, filterReplace);

    // Replace the groupedWarnings logic to group by class10 in default view
    const groupReplace = `const groupedWarnings = Object.values(filteredWarnings.reduce((acc: any, curr: any) => {
    // 市町村ビューなら市町村ごと、デフォルトなら一次細分区域（class10）ごとにまとめる
    const areaName = viewMode === 'municipality' ? curr.region : (curr.class10 || curr.prefecture);
    
    if (!acc[areaName]) {
      acc[areaName] = {
        area: areaName,
        prefecture: curr.prefecture,
        reportDateTime: curr.reportDateTime,
        items: []
      };
    }
    
    // 重複する警報はまとめる（同じ警報名なら優先度が高い方を残す）
    const existing = acc[areaName].items.find((i: any) => i.warningName === curr.warningName);
    if (!existing) {
      acc[areaName].items.push(curr);
    } else if (getWarningPriority(curr.warningLevel) < getWarningPriority(existing.warningLevel)) {
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
                      // デフォルトビュー: 都道府県 > 一次細分区域
                      const prefGroups: Record<string, any[]> = {};
                      PREFECTURES.forEach(p => prefGroups[p] = []);
                      
                      Object.values(groupedWarnings).forEach((row: any) => {
                        const pref = row.prefecture || 'その他';
                        if (!prefGroups[pref]) prefGroups[pref] = [];
                        prefGroups[pref].push(row);
                      });
                      
                      return (
                        <>
                          {PREFECTURES.concat(['その他']).map(pref => {
                            const regions = prefGroups[pref];
                            if (!regions || regions.length === 0) return null;
                            
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
                                        textUnderlineOffset: '4px'
                                      }}
                                      onClick={() => {
                                        setSelectedParentArea(row.area); // row.area is class10
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
    
    // Also update breadcrumb text
    content = content.replace(
      /{viewMode === 'municipality' \? '二次細分区域に戻る' : '都道府県に戻る'}/g,
      "{viewMode === 'municipality' ? '一次細分区域に戻る' : '都道府県に戻る'}"
    );

    fs.writeFileSync(filepath, content);
}

modifyApp('frontend/src/App.tsx');
console.log("Success frontend2");
