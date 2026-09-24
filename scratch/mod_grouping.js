const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.tsx', 'utf8');

const regex = /                            \.map\(\(\[pref, rows\]: \[string, any\]\) => \([\s\S]*?                                <\/React\.Fragment>\r?\n                            \)\)}/;

const newBlock = `                            .map(([pref, rows]: [string, any]) => {
                              const renderRow = (row: any, index: number, isRegionLabel = false) => (
                                <tr key={row.area + '-' + index} className="slide-in-row fade-update" style={{ borderBottom: '1px solid #f1f5f9' }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                >
                              <td style={{ padding: '12px 16px', color: '#64748b', verticalAlign: 'middle' }}>{new Date(row.reportDateTime).toLocaleString()}</td>
                              <td 
                                style={{
                                  padding: '12px 16px', fontWeight: 500, color: '#1e293b', verticalAlign: 'middle',
                                  cursor: (viewMode === 'prefecture' || viewMode === 'region') ? 'pointer' : 'default',
                                  textDecoration: (viewMode === 'prefecture' || viewMode === 'region') ? 'underline' : 'none',
                                  textDecorationColor: '#93c5fd',
                                  textUnderlineOffset: '4px',
                                  paddingLeft: viewMode === 'municipality' ? '32px' : '16px'
                                }}
                                onClick={() => {
                                  if (viewMode === 'prefecture' || viewMode === 'region') {
                                    setSelectedParentArea(viewMode === 'prefecture' ? (row.prefecture || row.area) : row.area);
                                    setViewMode('municipality');
                                  }
                                }}
                              >
                                {viewMode === 'municipality' ? row.area : (viewMode !== 'prefecture' && row.prefecture ? \`\${row.prefecture} \${row.area}\` : row.area)}
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
                              );

                              return (
                            <React.Fragment key={pref}>
                              {pref !== cat && (
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                  <td colSpan={3} style={{ padding: '6px 16px', fontWeight: 600, color: '#475569', fontSize: '0.8rem' }}>
                                    {pref}
                                  </td>
                                </tr>
                              )}
                              
                              {viewMode === 'municipality' ? (
                                Object.entries(
                                  rows.reduce((acc: any, row: any) => {
                                    const r = row.parentRegion || row.area;
                                    if (!acc[r]) acc[r] = [];
                                    acc[r].push(row);
                                    return acc;
                                  }, {})
                                ).map(([regName, regRows]: [string, any]) => (
                                  <React.Fragment key={regName}>
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                      <td colSpan={3} style={{ padding: '6px 16px', fontWeight: 600, color: '#475569', fontSize: '0.8rem', paddingLeft: '24px' }}>
                                        └ {regName}
                                      </td>
                                    </tr>
                                    {regRows.map((row: any, index: number) => renderRow(row, index, false))}
                                  </React.Fragment>
                                ))
                              ) : (
                                rows.map((row: any, index: number) => renderRow(row, index, false))
                              )}
                                </React.Fragment>
                              );
                            })}`;

if (!regex.test(content)) {
    console.log("Could not find regex!");
} else {
    content = content.replace(regex, newBlock);
    fs.writeFileSync('frontend/src/App.tsx', content);
    console.log("Replaced successfully!");
}
