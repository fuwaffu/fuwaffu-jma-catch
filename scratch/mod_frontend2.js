const fs = require('fs');

function main() {
  let content = fs.readFileSync('frontend/src/App.tsx', 'utf8');

  // Fix filteredWarnings logic
  const filteredWarningsOld = `  const filteredWarnings = warnings.filter((w: any) => {
    if (w.isCancelled) return false;
    
    // バックエンドがmap.jsonから直接動的フェッチする仕様になったため、全てclass20s(市町村)で返ってきます
    // 互換性維持のため、どのビューモードでもclass20sを表示するようにします
    if (w.areaType === 'class20s') {
      if (selectedParentArea && viewMode === 'municipality') {
        return w.prefecture === selectedParentArea;
      }
      return true;
    }
    
    if (viewMode === 'prefecture') return w.areaType === 'prefecture';
    if (viewMode === 'region') return w.areaType === 'region' || w.areaType === 'subregion';
    if (viewMode === 'municipality') {
      if (selectedParentArea) {
        return w.areaType === 'municipality' && (w.prefecture === selectedParentArea || w.parentRegion === selectedParentArea);
      }
      return w.areaType === 'municipality';
    }
    return false;
  });`;

  const filteredWarningsNew = `  const filteredWarnings = warnings.filter((w: any) => {
    if (w.isCancelled) return false;
    
    if (viewMode === 'prefecture') return w.areaType === 'prefecture';
    if (viewMode === 'region') {
      if (selectedParentArea) return (w.areaType === 'region' || w.areaType === 'subregion') && w.prefecture === selectedParentArea;
      return w.areaType === 'region' || w.areaType === 'subregion';
    }
    if (viewMode === 'municipality') {
      if (selectedParentArea) return w.areaType === 'municipality' && w.parentRegion === selectedParentArea;
      return w.areaType === 'municipality';
    }
    return false;
  });`;

  content = content.replace(filteredWarningsOld, filteredWarningsNew);

  // Fix handleBack logic
  const handleBackOld = `  // 戻るボタンの処理（画面上）
  const handleBack = () => {
    if (selectedParentArea) {
      setSelectedParentArea(null);
      setViewMode('prefecture');
      // ブラウザの履歴も更新する
      if (window.history.state?.area) {
        window.history.back();
      }
    }
  };

  // 選択領域が変わったときにブラウザ履歴にpushする
  useEffect(() => {
    if (selectedParentArea && window.history.state?.area !== selectedParentArea) {
      window.history.pushState({ area: selectedParentArea }, '');
    }
  }, [selectedParentArea]);

  // ブラウザの戻るボタン（popstate）の検知
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.area) {
        setSelectedParentArea(e.state.area);
        setViewMode('municipality');
      } else {
        setSelectedParentArea(null);
        setViewMode('prefecture');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);`;

  const handleBackNew = `  // 戻るボタンの処理（画面上）
  const handleBack = () => {
    if (viewMode === 'municipality') {
      const regionItem = warnings.find((w: any) => w.areaType === 'region' && w.region === selectedParentArea);
      if (regionItem && regionItem.prefecture) {
        setSelectedParentArea(regionItem.prefecture);
        setViewMode('region');
      } else {
        setSelectedParentArea(null);
        setViewMode('prefecture');
      }
      if (window.history.state?.viewMode) {
        window.history.back();
      }
    } else if (viewMode === 'region') {
      setSelectedParentArea(null);
      setViewMode('prefecture');
      if (window.history.state?.viewMode) {
        window.history.back();
      }
    }
  };

  // 選択領域が変わったときにブラウザ履歴にpushする
  useEffect(() => {
    if (window.history.state?.area !== selectedParentArea || window.history.state?.viewMode !== viewMode) {
      window.history.pushState({ area: selectedParentArea, viewMode }, '');
    }
  }, [selectedParentArea, viewMode]);

  // ブラウザの戻るボタン（popstate）の検知
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.viewMode) {
        setSelectedParentArea(e.state.area || null);
        setViewMode(e.state.viewMode);
      } else {
        setSelectedParentArea(null);
        setViewMode('prefecture');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);`;

  content = content.replace(handleBackOld, handleBackNew);

  // Fix button text
  content = content.replace(
    `← {viewMode === 'municipality' ? '都道府県に戻る' : '都道府県に戻る'}`,
    `← {viewMode === 'municipality' ? '地方・区域に戻る' : '都道府県に戻る'}`
  );
  content = content.replace(
    `← 都道府県に戻る`,
    `← {viewMode === 'municipality' ? '地方・区域に戻る' : '都道府県に戻る'}`
  );

  // Fix Table Rendering
  const tableRenderRegex = /                  \{activeTab === 'warnings' && \(\(\) => \{[\s\S]*?                        \);[\s\r\n]*                      \}\);[\s\r\n]*                    \}\)\(\)\}/;

  const tableRenderNew = `                  {activeTab === 'warnings' && (() => {
                    const PREF_CATEGORY_MAP: Record<string, string[]> = {
                      "北海道": [
                        "北海道", "宗谷地方", "上川地方", "留萌地方", "網走地方", "北見地方", "紋別地方", 
                        "十勝地方", "釧路地方", "根室地方", "胆振地方", "日高地方", "石狩地方", "空知地方", 
                        "後志地方", "渡島地方", "檜山地方",
                        "上川・留萌地方", "網走・北見・紋別地方", "石狩・空知・後志地方", 
                        "釧路・根室地方", "胆振・日高地方", "渡島・檜山地方"
                      ],
                      "東北": ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
                      "関東甲信": ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "山梨県", "長野県"],
                      "北陸": ["新潟県", "富山県", "石川県", "福井県"],
                      "東海": ["岐阜県", "静岡県", "愛知県", "三重県"],
                      "近畿": ["滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
                      "中国 (山口は除く)": ["鳥取県", "島根県", "岡山県", "広島県"],
                      "四国": ["徳島県", "香川県", "愛媛県", "高知県"],
                      "九州北部 (山口を含む)": ["山口県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県"],
                      "九州南部・奄美": ["宮崎県", "鹿児島県", "鹿児島県（奄美地方除く）", "奄美地方"],
                      "沖縄": ["沖縄県", "沖縄本島地方", "大東島地方", "宮古島地方", "八重山地方"]
                    };
                    const CATEGORY_ORDER = [
                      "北海道", "東北", "関東甲信", "北陸", "東海", "近畿",
                      "中国 (山口は除く)", "四国", "九州北部 (山口を含む)", "九州南部・奄美", "沖縄", "その他"
                    ];
                    
                    const getCategory = (pref: string) => {
                      for (const [cat, prefs] of Object.entries(PREF_CATEGORY_MAP)) {
                        if (prefs.includes(pref)) return cat;
                      }
                      return "その他";
                    };

                    const warningsByCategory: Record<string, any[]> = {};
                    groupedWarnings.forEach((row: any) => {
                      let cat = 'その他';
                      if (viewMode === 'prefecture') {
                        cat = getCategory(row.prefecture || row.area);
                      } else if (viewMode === 'region') {
                        cat = row.prefecture || '不明';
                      } else if (viewMode === 'municipality') {
                        cat = row.items[0]?.parentRegion || row.area;
                      }
                      if (!warningsByCategory[cat]) warningsByCategory[cat] = [];
                      warningsByCategory[cat].push(row);
                    });

                    let sortedCats = Object.keys(warningsByCategory);
                    if (viewMode === 'prefecture') {
                      sortedCats = CATEGORY_ORDER.filter(c => warningsByCategory[c]);
                    } else if (viewMode === 'region') {
                      // Already grouped by prefecture name
                    }

                    return sortedCats.map(cat => {
                      const rows = warningsByCategory[cat];
                      if (!rows || rows.length === 0) return null;

                      if (viewMode === 'prefecture') {
                        rows.sort((a: any, b: any) => {
                          const idxA = PREF_CATEGORY_MAP[cat]?.indexOf(a.area) ?? 999;
                          const idxB = PREF_CATEGORY_MAP[cat]?.indexOf(b.area) ?? 999;
                          return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
                        });
                      }

                      return (
                        <React.Fragment key={cat}>
                          <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>
                            <td colSpan={3} style={{ padding: '8px 16px', fontWeight: 700, color: '#1e293b' }}>
                              {viewMode === 'municipality' ? \`└ \${cat}\` : cat}
                            </td>
                          </tr>
                          
                          {rows.map((row: any, index: number) => (
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
                                paddingLeft: viewMode === 'region' ? '32px' : (viewMode === 'municipality' ? '48px' : '16px')
                              }}
                              onClick={() => {
                                if (viewMode === 'prefecture') {
                                  setSelectedParentArea(row.area);
                                  setViewMode('region');
                                } else if (viewMode === 'region') {
                                  setSelectedParentArea(row.area);
                                  setViewMode('municipality');
                                }
                              }}
                            >
                              {viewMode === 'prefecture' ? row.area : \`└ \${row.area}\`}
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
                    });
                  })()}`;

  content = content.replace(tableRenderRegex, tableRenderNew);

  fs.writeFileSync('frontend/src/App.tsx', content);
  console.log("Success");
}
main();
