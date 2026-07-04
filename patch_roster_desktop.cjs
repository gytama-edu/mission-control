const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

code = code.replace(
  '<th className="py-2.5 px-4 font-semibold text-center w-64">Points Control</th>',
  `<th className="py-2.5 px-4 font-semibold text-center w-20">Points</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-36">Deduct</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-48">Add</th>`
);

const oldBody = `<td className="py-2 px-4">
                            <div className="flex items-center justify-center gap-3 select-none">
                              <span className="font-mono font-bold text-white text-sm w-10 text-right pr-2 border-r border-slate-800">
                                {student.points}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 justify-center">
                                <button
                                   onClick={() => handleUpdatePoints(student.id, -5, getActiveReason())}
                                   disabled={student.points < 5}
                                   className="text-xs px-2.5 py-1.5 font-mono rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  -5
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, -3, getActiveReason())}
                                   disabled={student.points < 3}
                                   className="text-xs px-2.5 py-1.5 font-mono rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  -3
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, -1, getActiveReason())}
                                   disabled={student.points < 1}
                                   className="text-xs px-2.5 py-1.5 font-mono rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  -1
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, 1, getActiveReason())}
                                   className="text-xs px-2.5 py-1.5 font-mono rounded-lg bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                                >
                                  +1
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, 3, getActiveReason())}
                                   className="text-xs px-2.5 py-1.5 font-mono rounded-lg bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-medium cursor-pointer"
                                >
                                  +3
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, 5, getActiveReason())}
                                   className="text-xs px-2.5 py-1.5 font-mono rounded-lg bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-semibold cursor-pointer"
                                >
                                  +5
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, 10, getActiveReason())}
                                   className="text-xs px-2.5 py-1.5 font-mono rounded-lg bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/30 text-white font-bold cursor-pointer"
                                >
                                  +10
                                </button>
                              </div>
                            </div>
                          </td>`;

const newBody = `<td className="py-3 px-4 text-center">
                            <span className="font-mono font-bold text-white text-base">
                              {student.points}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5 select-none">
                              <button
                                 onClick={() => handleUpdatePoints(student.id, -5, getActiveReason())}
                                 disabled={student.points < 5}
                                 className="text-xs px-2 py-1.5 font-mono rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                              >
                                -5
                              </button>
                              <button
                                 onClick={() => handleUpdatePoints(student.id, -3, getActiveReason())}
                                 disabled={student.points < 3}
                                 className="text-xs px-2 py-1.5 font-mono rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                              >
                                -3
                              </button>
                              <button
                                 onClick={() => handleUpdatePoints(student.id, -1, getActiveReason())}
                                 disabled={student.points < 1}
                                 className="text-xs px-2 py-1.5 font-mono rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                              >
                                -1
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5 select-none">
                              <button
                                 onClick={() => handleUpdatePoints(student.id, 1, getActiveReason())}
                                 className="text-xs px-2 py-1.5 font-mono rounded-lg bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/30 text-rose-400 cursor-pointer transition-colors"
                              >
                                +1
                              </button>
                              <button
                                 onClick={() => handleUpdatePoints(student.id, 3, getActiveReason())}
                                 className="text-xs px-2 py-1.5 font-mono rounded-lg bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-medium cursor-pointer transition-colors"
                              >
                                +3
                              </button>
                              <button
                                 onClick={() => handleUpdatePoints(student.id, 5, getActiveReason())}
                                 className="text-xs px-2 py-1.5 font-mono rounded-lg bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-semibold cursor-pointer transition-colors"
                              >
                                +5
                              </button>
                              <button
                                 onClick={() => handleUpdatePoints(student.id, 10, getActiveReason())}
                                 className="text-xs px-2 py-1.5 font-mono rounded-lg bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/40 text-white font-bold cursor-pointer transition-colors shadow-[0_0_10px_rgba(225,29,72,0.1)]"
                              >
                                +10
                              </button>
                            </div>
                          </td>`;

if (code.includes(oldBody)) {
  code = code.replace(oldBody, newBody);
  fs.writeFileSync('src/components/ClassDetail.tsx', code);
  console.log('Roster table patched successfully.');
} else {
  console.log('Error: Could not find oldBody');
}
