const fs = require('fs');
let content = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const target = `      alert('Failed to reset guardian code');`;
const replacement = `      alert('Failed to reset guardian code: ' + (err.message || err.toString()));`;
content = content.replace(target, replacement);

fs.writeFileSync('src/components/ClassDetail.tsx', content);
