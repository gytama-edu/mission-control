const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

code = code.replace(/\\'text-red-500\\'/g, "'text-red-500'");
code = code.replace(/\\'text-white\\'/g, "'text-white'");

fs.writeFileSync('src/components/ClassDetail.tsx', code);
console.log("Quotes fixed");
