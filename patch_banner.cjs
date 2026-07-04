const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

code = code.replace(
  /<div className="bg-slate-900\/50 px-3 py-1\.5 rounded-lg border border-emerald-500\/20 text-center min-w-\[80px\](?: hidden sm:block)?">/g,
  (match) => match.replace('px-3 py-1.5', 'px-4 py-2.5 min-w-[90px]')
);

code = code.replace(
  /<p className="text-\[10px\] text-slate-400 font-mono uppercase tracking-wider mb-0\.5">/g,
  '<p className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-1">'
);

code = code.replace(
  /<p className="text-sm font-bold/g,
  '<p className="text-base font-bold'
);

fs.writeFileSync('src/components/ClassDetail.tsx', code);
console.log("Banner patched");
