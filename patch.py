import re

with open('src/components/ClassDetail.tsx', 'r') as f:
    content = f.read()

# Replace student name
content = re.sub(
    r'<td className="py-2 px-4">\s*<div className="flex items-center gap-2">\s*<span className="font-display font-bold text-sm text-white">',
    r'<td className="py-3 px-4">\n                            <div className="flex items-center gap-2">\n                              <span className="font-display font-bold text-base text-white">',
    content
)

content = re.sub(
    r'<span className="text-\[10px\] text-slate-500 font-medium font-sans">',
    r'<span className="text-xs text-slate-500 font-medium font-sans">',
    content
)

content = re.sub(
    r'<span className=\{`inline-flex items-center gap-1 px-1\.5 py-0\.5 rounded text-\[8px\] font-bold uppercase tracking-wider border \$\{status\.color\} select-none`\}>',
    r'<span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${status.color} select-none`}>',
    content
)

# Replace PIN
content = re.sub(
    r'<td className="py-2 px-4 text-center font-mono text-xs text-slate-300 font-bold select-none">',
    r'<td className="py-3 px-4 text-center font-mono text-sm text-slate-300 font-bold select-none">',
    content
)

# Replace Lives (desktop only, assuming it finds the one in the table td)
content = re.sub(
    r'<td className="py-2 px-4">\s*<div className="flex items-center justify-center gap-2 select-none">\s*<button\s*onClick=\{\(\) => handleUpdateLives\(student.id, -1, getActiveReason\(\)\)\}\s*disabled=\{student.lives <= 0\}\s*className="w-6 h-6 rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"\s*>\s*<Minus size=\{11\} />',
    r'''<td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-3 select-none">
                                <button
                                  onClick={() => handleUpdateLives(student.id, -1, getActiveReason())}
                                  disabled={student.lives <= 0}
                                  className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                >
                                  <Minus size={14} />''',
    content
)

content = re.sub(
    r'<span className=\{`font-mono font-bold text-sm \$\{student\.lives === 0 \? \'text-red-500\' : \'text-white\'\} w-6 text-center`\}>',
    r'<span className={`font-mono font-bold text-base ${student.lives === 0 ? \'text-red-500\' : \'text-white\'} w-6 text-center`}>',
    content
)

content = re.sub(
    r'</button>\s*</div>\s*</td>\s*<td className="py-2 px-4">\s*<div className="flex items-center justify-center gap-3 select-none">\s*<span className="font-mono font-bold text-white text-sm w-10 text-right pr-2 border-r border-slate-800">',
    r'''</button>
                              </div>
                            </td>
                          )}
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-4 select-none">
                              <span className="font-mono font-bold text-white text-base w-12 text-right pr-4 border-r border-slate-800">''',
    content
)

content = re.sub(
    r'<button\s*onClick=\{\(\) => handleUpdateLives\(student\.id, 1, getActiveReason\(\)\)\}\s*disabled=\{student\.lives >= classData\.maxLives\}\s*className="w-6 h-6 rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"\s*>\s*<Plus size=\{11\} />',
    r'''<button
                                  onClick={() => handleUpdateLives(student.id, 1, getActiveReason())}
                                  disabled={student.lives >= classData.maxLives}
                                  className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                >
                                  <Plus size={14} />''',
    content
)

# Points Quick Buttons
content = re.sub(
    r'<div className="flex items-center gap-1">',
    r'<div className="flex flex-wrap items-center gap-1.5 justify-center">',
    content
)

content = re.sub(
    r'className="text-\[9px\] px-1\.5 py-0\.5 font-mono rounded ',
    r'className="text-xs px-2.5 py-1.5 font-mono rounded-lg ',
    content
)

# Replace actions icons
content = re.sub(
    r'<td className="py-2 px-4 text-right">\s*<div className="flex items-center justify-end gap-1\.5">\s*<button\s*onClick=\{\(\) => handleOpenAwardModal\(student\.id\)\}\s*className="text-slate-500 hover:text-amber-400 p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"\s*title="Award Badge"\s*>\s*<Award size=\{13\} />\s*</button>\s*<button\s*onClick=\{\(\) => \{\s*setEditingStudentId\(student\.id\);\s*setEditStudentName\(student\.name\);\s*setEditStudentNickname\(student\.nickname \|\| \'\'\);\s*\}\}\s*className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"\s*title="Edit Student"\s*>\s*<Edit2 size=\{13\} />\s*</button>',
    r'''<td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenAwardModal(student.id)}
                                className="text-slate-500 hover:text-amber-400 p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Award Badge"
                              >
                                <Award size={16} />
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
                                <Edit2 size={16} />
                              </button>''',
    content
)

with open('src/components/ClassDetail.tsx', 'w') as f:
    f.write(content)
print("Done")
