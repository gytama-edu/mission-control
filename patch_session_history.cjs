const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

// Header styles
code = code.replace(
  '<tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono uppercase tracking-wider text-slate-400">',
  '<tr className="border-b border-slate-800 bg-slate-950/50 text-sm font-mono uppercase tracking-wider text-slate-400">'
);

code = code.replace(
  /<th className="p-4([^"]*)">/g,
  '<th className="py-4 px-6$1">'
);

// Body styles
code = code.replace(
  /<td className="p-4([^"]*)">/g,
  '<td className="py-4 px-6$1">'
);

// Make text-sm -> text-base in the session history td classes
// We'll replace specific patterns
code = code.replace(
  '<td className="py-4 px-6 font-medium text-white whitespace-nowrap">{startedDate}</td>',
  '<td className="py-4 px-6 font-medium text-white whitespace-nowrap text-base">{startedDate}</td>'
);

code = code.replace(
  /<td className="py-4 px-6 text-center font-mono text-sm /g,
  '<td className="py-4 px-6 text-center font-mono text-base '
);

code = code.replace(
  '<td className="py-4 px-6 font-mono text-sm text-slate-300">',
  '<td className="py-4 px-6 font-mono text-base text-slate-300">'
);

code = code.replace(
  '<span className={`px-2 py-0.5 rounded-full',
  '<span className={`px-3 py-1 rounded-full'
);

fs.writeFileSync('src/components/ClassDetail.tsx', code);
console.log("Session history patched");
