const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

// Replace student name
code = code.replace(
  '<h3 className="font-display font-bold text-sm text-white truncate flex items-center gap-1.5">',
  '<h3 className="font-display font-bold text-base text-white truncate flex items-center gap-1.5">'
);

code = code.replace(
  '<p className="text-[10px] text-slate-500 font-medium truncate">',
  '<p className="text-xs text-slate-500 font-medium truncate">'
);

code = code.replace(
  /<div className=\{`mt-1\.5 inline-flex items-center gap-1 px-2 py-0\.5 rounded text-\[9px\]/g,
  '<div className={`mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px]'
);

code = code.replace(
  '<div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 font-mono select-none">',
  '<div className="mt-2 text-xs text-slate-500 flex items-center gap-1 font-mono select-none">'
);

code = code.replace(
  '<Key size={10} className="text-rose-500/70" /> PIN: <strong className="text-slate-300 font-semibold">{student.pin}</strong>',
  '<Key size={12} className="text-rose-500/70" /> PIN: <strong className="text-slate-300 font-bold">{student.pin}</strong>'
);

// Actions in mobile view
code = code.replace(
  /<div className="flex gap-1 shrink-0">\s*<button\s*onClick=\{\(\) => handleOpenAwardModal\(student\.id\)\}\s*className="text-slate-500 hover:text-amber-400 p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"\s*title="Award Badge"\s*>\s*<Award size=\{14\} \/>\s*<\/button>\s*<button\s*onClick=\{\(\) => \{\s*setEditingStudentId\(student\.id\);\s*setEditStudentName\(student\.name\);\s*setEditStudentNickname\(student\.nickname \|\| ''\);\s*\}\}\s*className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"\s*title="Edit Student"\s*>\s*<Edit2 size=\{14\} \/>\s*<\/button>\s*<\/div>/,
  `<div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleOpenAwardModal(student.id)}
                            className="text-slate-500 hover:text-amber-400 p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Award Badge"
                          >
                            <Award size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingStudentId(student.id);
                              setEditStudentName(student.name);
                              setEditStudentNickname(student.nickname || '');
                            }}
                            className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit Student"
                          >
                            <Edit2 size={18} />
                          </button>
                        </div>`
);

// Lives Control
code = code.replace(
  /className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"\s*>\s*<Minus size=\{16\} \/>/g,
  `className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                              >
                                <Minus size={20} />`
);

code = code.replace(
  /className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"\s*>\s*<Plus size=\{16\} \/>/g,
  `className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                              >
                                <Plus size={20} />`
);

code = code.replace(
  '<span className={`font-mono text-xl font-bold ${student.lives === 0 ? \'text-red-500\' : \'text-white\'}`}>',
  '<span className={`font-mono text-2xl font-bold ${student.lives === 0 ? \'text-red-500\' : \'text-white\'}`}>'
);

// Points display
code = code.replace(
  '<span className="font-mono font-bold text-white text-sm">{student.points}</span>',
  '<span className="font-mono font-bold text-white text-base">{student.points}</span>'
);

// Points Control
code = code.replace(/text-sm py-2\.5/g, 'text-base py-3');

fs.writeFileSync('src/components/ClassDetail.tsx', code);
console.log("Mobile grid patched");
