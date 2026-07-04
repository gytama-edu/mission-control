const fs = require('fs');
let content = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const desktopTarget = `<td className="py-3 px-4 text-center font-mono text-xs text-slate-400 select-none space-y-1">
                            <div><Key size={10} className="inline mr-1 text-slate-500" /> <strong className="text-slate-300 text-sm">{student.pin}</strong></div>
                            <div className="text-[10px]"><ShieldCheck size={10} className="inline mr-1 text-sky-500/70" /> <strong className="text-sky-300/90">{student.guardian_access_code || 'None'}</strong></div>
                          </td>`;

const desktopReplacement = `<td className="py-3 px-4 font-mono text-xs text-slate-400 select-none">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-center gap-1.5 bg-slate-950/40 rounded px-2 py-1">
                                <Key size={10} className="text-slate-500" /> <strong className="text-slate-300 text-sm">{student.pin}</strong>
                              </div>
                              <div className="flex flex-col items-center justify-center gap-1.5 bg-sky-950/10 rounded px-2 py-1.5 border border-sky-900/30">
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <ShieldCheck size={10} className="text-sky-500/70" />
                                  {student.guardian_access_code ? (
                                    <strong className="text-sky-300/90 tracking-wider">{student.guardian_access_code}</strong>
                                  ) : (
                                    <span className="text-slate-500 italic">None</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {student.guardian_access_code ? (
                                    <>
                                      <button 
                                        onClick={() => handleCopyGuardianInfo(student)}
                                        className="text-[9px] uppercase tracking-wider bg-sky-900/30 hover:bg-sky-900/50 text-sky-400 px-1.5 py-0.5 rounded border border-sky-800/50 transition-colors"
                                        title="Copy Info"
                                      >
                                        Copy
                                      </button>
                                      <button 
                                        disabled={isResettingGuardianCode}
                                        onClick={() => {
                                          if (confirm('Regenerate Guardian Code? Old code will stop working.')) {
                                            handleResetGuardianCode(student.id);
                                          }
                                        }}
                                        className="text-[9px] uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300 px-1.5 py-0.5 rounded border border-slate-700/50 transition-colors disabled:opacity-50"
                                        title="Reset Code"
                                      >
                                        Reset
                                      </button>
                                    </>
                                  ) : (
                                    <button 
                                      disabled={isResettingGuardianCode}
                                      onClick={() => handleResetGuardianCode(student.id)}
                                      className="text-[9px] uppercase tracking-wider bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 px-2 py-0.5 rounded border border-sky-500/30 transition-colors disabled:opacity-50"
                                    >
                                      Generate
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>`;

const mobileTarget = `<div className="mt-2 text-xs text-slate-500 flex items-center gap-1 font-mono select-none">
                            <Key size={12} className="text-rose-500/70" /> PIN: <strong className="text-slate-300 font-bold">{student.pin}</strong>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1 font-mono select-none">
                            <ShieldCheck size={10} className="text-sky-500/70" /> Guardian Code: <strong className="text-slate-300 font-bold">{student.guardian_access_code || 'None'}</strong>
                          </div>`;

const mobileReplacement = `<div className="mt-3 text-xs text-slate-500 flex items-center justify-between gap-1 font-mono select-none">
                            <div className="flex items-center gap-1.5">
                              <Key size={12} className="text-slate-500" /> PIN: <strong className="text-slate-300 font-bold">{student.pin}</strong>
                            </div>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-2 bg-slate-950/40 rounded px-2 py-1.5 border border-slate-800/40">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono select-none">
                              <ShieldCheck size={12} className="text-sky-500/70" />
                              <span>Parent:</span>
                              {student.guardian_access_code ? (
                                <strong className="text-sky-300/90 tracking-wider text-xs">{student.guardian_access_code}</strong>
                              ) : (
                                <span className="text-slate-500 italic">None</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {student.guardian_access_code ? (
                                <>
                                  <button 
                                    onClick={() => handleCopyGuardianInfo(student)}
                                    className="text-[9px] uppercase tracking-wider bg-sky-900/30 hover:bg-sky-900/50 text-sky-400 px-2 py-1 rounded border border-sky-800/50 transition-colors"
                                    title="Copy Info"
                                  >
                                    Copy
                                  </button>
                                  <button 
                                    disabled={isResettingGuardianCode}
                                    onClick={() => {
                                      if (confirm('Regenerate Guardian Code? Old code will stop working.')) {
                                        handleResetGuardianCode(student.id);
                                      }
                                    }}
                                    className="text-[9px] uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300 px-2 py-1 rounded border border-slate-700/50 transition-colors disabled:opacity-50"
                                    title="Reset Code"
                                  >
                                    Reset
                                  </button>
                                </>
                              ) : (
                                <button 
                                  disabled={isResettingGuardianCode}
                                  onClick={() => handleResetGuardianCode(student.id)}
                                  className="text-[9px] uppercase tracking-wider bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 px-2 py-1 rounded border border-sky-500/30 transition-colors disabled:opacity-50"
                                >
                                  Generate
                                </button>
                              )}
                            </div>
                          </div>`;

let changed = false;
if (content.includes(desktopTarget)) {
  content = content.replace(desktopTarget, desktopReplacement);
  changed = true;
} else {
  console.log('desktopTarget not found');
}

if (content.includes(mobileTarget)) {
  content = content.replace(mobileTarget, mobileReplacement);
  changed = true;
} else {
  console.log('mobileTarget not found');
}

if (changed) {
  fs.writeFileSync('src/components/ClassDetail.tsx', content);
  console.log('Patched inline guardian controls successfully.');
}
