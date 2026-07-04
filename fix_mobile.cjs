const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const badMobile = `                            <div className="flex items-center justify-between gap-2">
                              </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5 select-none">
                              <button
                                onClick={() => handleUpdatePoints(student.id, 1, getActiveReason())}
                                className="flex-1 text-base py-3 font-mono rounded-lg bg-rose-950/60 border border-rose-500/30 hover:bg-rose-500/30 text-rose-400 cursor-pointer font-medium"
                              >
                                +1
                              </button>`;

const fixedMobile = `                            <div className="flex items-center justify-between gap-2">
                              <button onClick={() => handleUpdatePoints(student.id, 1, getActiveReason())} className="flex-1 text-base py-3 font-mono rounded-lg bg-rose-950/60 border border-rose-500/30 hover:bg-rose-500/30 text-rose-400 cursor-pointer font-medium">+1</button>`;

code = code.replace(badMobile, fixedMobile);
fs.writeFileSync('src/components/ClassDetail.tsx', code);
console.log("Fixed mobile view");
