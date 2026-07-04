const fs = require('fs');
let content = fs.readFileSync('src/components/GuardianAccess.tsx', 'utf8');

content = content.replace(/\\`\\\${studentPreview.name} \\\(\\\${studentPreview.nickname}\\\)\\`/g, '`${studentPreview.name} (${studentPreview.nickname})`');

fs.writeFileSync('src/components/GuardianAccess.tsx', content);
