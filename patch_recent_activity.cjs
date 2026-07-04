const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

// The gap between columns in the grid
code = code.replace(
  '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">',
  '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">'
);

// P-3 to p-4 for the card
code = code.replace(
  /className=\{`p-3 rounded-xl border flex flex-col gap-1\.5 transition-colors \$\{/g,
  'className={`p-4 rounded-xl border flex flex-col gap-2 transition-colors ${'
);

// Student name
code = code.replace(
  '<span className="text-xs font-bold text-white truncate pr-2">{item.studentName}</span>',
  '<span className="text-sm font-bold text-white truncate pr-2">{item.studentName}</span>'
);

// New tag
code = code.replace(
  '<span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400">New</span>',
  '<span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">New</span>'
);

// Summary text
code = code.replace(
  '<div className="text-[11px] text-slate-400 leading-snug line-clamp-2" title={item.summary}>',
  '<div className="text-xs text-slate-400 leading-relaxed line-clamp-2" title={item.summary}>'
);

// Timestamp text
code = code.replace(
  '<div className="text-[10px] text-slate-500 font-mono mt-auto pt-1">',
  '<div className="text-xs text-slate-500 font-mono mt-auto pt-1.5">'
);

fs.writeFileSync('src/components/ClassDetail.tsx', code);
console.log("Recent activity patched");
