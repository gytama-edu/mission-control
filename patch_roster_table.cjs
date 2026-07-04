const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const targetOld = `                  <tbody className="divide-y divide-slate-800/40">
                    {rosterStudents.map((student) => {
                      const status = getStudentStatus(student.lives, classData.maxLives);
                      return (
                        <tr key={student.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-sm text-white">
                                {student.nickname || student.name}
                              </span>
                              {student.nickname && (
                                <span className="text-[10px] text-slate-500 font-medium font-sans">
                                  ({student.name})
                                </span>
                              )}
                              {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                                <span className={\`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border \${status.color} select-none\`}>
                                  {status.label}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-4 text-center font-mono text-xs text-slate-300 font-bold select-none">
                            {student.pin}
                          </td>
                          {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                            <td className="py-2 px-4">
                              <div className="flex items-center justify-center gap-2 select-none">
                                <button
                                  onClick={() => handleUpdateLives(student.id, -1, getActiveReason())}
                                  disabled={student.lives <= 0}
                                  className="w-6 h-6 rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                >
                                  <Minus size={11} />
                                </button>
                                <span className={\`font-mono font-bold text-sm \${student.lives === 0 ? 'text-red-500' : 'text-white'} w-6 text-center\`}>
                                  {student.lives}
                                </span>
                                <button
                                  onClick={() => handleUpdateLives(student.id, 1, getActiveReason())}
                                  disabled={student.lives >= classData.maxLives}
                                  className="w-6 h-6 rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>
                          )}
                          <td className="py-2 px-4">
                            <div className="flex items-center justify-center gap-3 select-none">
                              <span className="font-mono font-bold text-white text-sm w-10 text-right pr-2 border-r border-slate-800">
                                {student.points}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                   onClick={() => handleUpdatePoints(student.id, -5, getActiveReason())}
                                   disabled={student.points < 5}
                                   className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  -5
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, -3, getActiveReason())}
                                   disabled={student.points < 3}
                                   className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  -3
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, -1, getActiveReason())}
                                   disabled={student.points < 1}
                                   className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  -1
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, 1, getActiveReason())}
                                   className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                                >
                                  +1
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, 3, getActiveReason())}
                                   className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-medium cursor-pointer"
                                >
                                  +3
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, 5, getActiveReason())}
                                   className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-semibold cursor-pointer"
                                >
                                  +5
                                </button>
                                <button
                                   onClick={() => handleUpdatePoints(student.id, 10, getActiveReason())}
                                   className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/30 text-white font-bold cursor-pointer"
                                >
                                  +10
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenAwardModal(student.id)}
                                className="text-slate-500 hover:text-amber-400 p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Award Badge"
                              >
                                <Award size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingStudentId(student.id);
                                  setEditStudentName(student.name);
                                  setEditStudentNickname(student.nickname || '');
                                }}
                                className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Edit Student"
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>`;

const targetNew = `                  <tbody className="divide-y divide-slate-800/40">
                    {rosterStudents.map((student) => {
                      const status = getStudentStatus(student.lives, classData.maxLives);
                      return (
                        <tr key={student.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-base text-white">
                                {student.nickname || student.name}
                              </span>
                              {student.nickname && (
                                <span className="text-xs text-slate-500 font-medium font-sans">
                                  ({student.name})
                                </span>
                              )}
                              {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                                <span className={\`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border \${status.color} select-none\`}>
                                  {status.label}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-sm text-slate-300 font-bold select-none">
                            {student.pin}
                          </td>
                          {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-3 select-none">
                                <button
                                  onClick={() => handleUpdateLives(student.id, -1, getActiveReason())}
                                  disabled={student.lives <= 0}
                                  className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className={\`font-mono font-bold text-base \${student.lives === 0 ? 'text-red-500' : 'text-white'} w-6 text-center\`}>
                                  {student.lives}
                                </span>
                                <button
                                  onClick={() => handleUpdateLives(student.id, 1, getActiveReason())}
                                  disabled={student.lives >= classData.maxLives}
                                  className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-4 select-none">
                              <span className="font-mono font-bold text-white text-base w-12 text-right pr-4 border-r border-slate-800">
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
                          </td>
                          <td className="py-3 px-4 text-right">
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
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>`;

if (code.includes(targetOld)) {
    code = code.replace(targetOld, targetNew);
    fs.writeFileSync('src/components/ClassDetail.tsx', code);
    console.log("Success");
} else {
    console.log("Could not find target block");
}
