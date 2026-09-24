const fs = require('fs');

function fix(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Add formatDate function
    const formatDateFn = `
  const formatDate = (isoStr: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return \`\${d.getDate()}日 \${d.getHours()}:\${d.getMinutes().toString().padStart(2, '0')}\`;
  };
`;
    // Inject formatDate before its usage (maybe before const groupedWarnings = ...)
    content = content.replace(
        /const groupedWarnings = Object\.values\(filteredWarnings/g,
        formatDateFn + '\n  const groupedWarnings = Object.values(filteredWarnings'
    );

    // Remove unused functions
    content = content.replace(/const formatWarningName = \([^]+?\};\s*/, '');
    content = content.replace(/const getWarningPriority = \([^]+?\};\s*/, '');
    content = content.replace(/const getWarningColor = \([^]+?\};\s*/, '');

    fs.writeFileSync(filepath, content);
}

fix('frontend/src/App.tsx');
console.log("Success");
