const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.tsx', 'utf8');

const targetRegex = /<span style={{ fontSize: '0.8rem', color: '#64748b' }}>更新: \{new Date\(typhoon\.updatedAt\)\.toLocaleString\('ja-JP', \{ timeZone: 'Asia\/Tokyo' \}\)\}<\/span>\r?\n\s*<\/div>/;

const replacement = `<span style={{ fontSize: '0.8rem', color: '#64748b', flex: 1 }}>更新: {new Date(typhoon.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
        <button
          onClick={() => {
            const url = \`\${window.location.origin}/?mode=obs&id=\${typhoon.tcNumber}\`;
            navigator.clipboard.writeText(url).then(() => {
              alert('OBS用のURLをクリップボードにコピーしました！\\nブラウザソースのURLに指定してください。');
            }).catch(e => {
              console.error(e);
              alert('コピーに失敗しました。');
            });
          }}
          style={{ padding: '6px 14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <i className="fa-solid fa-link"></i> OBS表示用リンクをコピー
        </button>
      </div>`;

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacement);
    fs.writeFileSync('frontend/src/App.tsx', content);
    console.log("Success");
} else {
    console.log("Regex not found");
}
