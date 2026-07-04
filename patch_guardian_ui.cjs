const fs = require('fs');
let content = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

// 1. Add handlers
const handlersTarget = `  const handleOpenAwardModal = (studentId: string = '') => {`;
const handlersReplacement = `  const [isResettingGuardianCode, setIsResettingGuardianCode] = useState(false);

  const handleResetGuardianCode = async (studentId: string) => {
    setIsResettingGuardianCode(true);
    try {
      await db.updateGuardianCode(studentId);
      onSync();
    } catch (err) {
      console.error(err);
      alert('Failed to reset guardian code');
    } finally {
      setIsResettingGuardianCode(false);
    }
  };

  const handleCopyGuardianInfo = (student: any) => {
    const code = student.guardian_access_code || 'Not generated';
    navigator.clipboard.writeText(\`Guardian Access for \${student.name}\\nClass Code: \${classData.joinCode}\\nGuardian Code: \${code}\\nOpen Mission Control and choose Guardian Access.\`);
    alert('Guardian info copied!');
  };

  const handleOpenAwardModal = (studentId: string = '') => {`;

if (content.includes(handlersTarget) && !content.includes('handleResetGuardianCode')) {
  content = content.replace(handlersTarget, handlersReplacement);
}

// 2. Update Table Header
const thTarget = `<th className="py-2.5 px-4 font-semibold text-center w-24">PIN</th>`;
const thReplacement = `<th className="py-2.5 px-4 font-semibold text-center">Credentials</th>`;
content = content.replace(thTarget, thReplacement);

// 3. Update Table Cell
const tdTarget = `<td className="py-3 px-4 text-center font-mono text-sm text-slate-300 font-bold select-none">
                            {student.pin}
                          </td>`;
const tdReplacement = `<td className="py-3 px-4 text-center font-mono text-xs text-slate-400 select-none space-y-1">
                            <div><Key size={10} className="inline mr-1 text-slate-500" /> <strong className="text-slate-300 text-sm">{student.pin}</strong></div>
                            <div className="text-[10px]"><ShieldCheck size={10} className="inline mr-1 text-sky-500/70" /> <strong className="text-sky-300/90">{student.guardian_access_code || 'None'}</strong></div>
                          </td>`;
if (content.includes(tdTarget)) {
  content = content.replace(tdTarget, tdReplacement);
}

// 4. Update Edit Modal Buttons
const buttonsTarget = `<div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const student = classData.students.find(s => s.id === editingStudentId);
                      if (student) {
                        navigator.clipboard.writeText(\`Class Code: \${classData.joinCode}\\nStudent: \${student.name}\\nPIN: \${student.pin}\`);
                        alert('Login info copied!');
                      }
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Copy size={14} /> Copy Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Regenerate PIN for this student?')) {
                        onRegenerateStudentPin(editingStudentId);
                      }
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw size={14} /> Reset PIN
                  </button>
                </div>`;

const buttonsReplacement = `<div className="space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 mt-2">Student Credentials</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const student = classData.students.find(s => s.id === editingStudentId);
                        if (student) {
                          navigator.clipboard.writeText(\`Class Code: \${classData.joinCode}\\nStudent: \${student.name}\\nPIN: \${student.pin}\`);
                          alert('Login info copied!');
                        }
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Copy size={14} /> Copy PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Regenerate PIN for this student?')) {
                          onRegenerateStudentPin(editingStudentId);
                        }
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-amber-500 hover:text-amber-400 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <RefreshCw size={14} /> Reset PIN
                    </button>
                  </div>
                  
                  <div className="text-xs font-bold text-sky-500/70 uppercase tracking-wider mb-1 mt-4 flex items-center gap-1.5"><ShieldCheck size={12}/> Guardian Access</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const student = classData.students.find(s => s.id === editingStudentId);
                        if (student) handleCopyGuardianInfo(student);
                      }}
                      className="w-full bg-sky-900/30 hover:bg-sky-900/50 border border-sky-800/50 text-sky-300 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Copy size={14} /> Copy Parent Info
                    </button>
                    <button
                      type="button"
                      disabled={isResettingGuardianCode}
                      onClick={() => {
                        if (confirm('Regenerate Guardian Code for this student? The old code will no longer work.')) {
                          handleResetGuardianCode(editingStudentId);
                        }
                      }}
                      className="w-full bg-sky-900/30 hover:bg-sky-900/50 border border-sky-800/50 text-sky-400 hover:text-sky-300 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={isResettingGuardianCode ? "animate-spin" : ""} /> Reset Code
                    </button>
                  </div>
                </div>`;

if (content.includes(buttonsTarget)) {
  content = content.replace(buttonsTarget, buttonsReplacement);
} else {
  console.log("Could not find buttons block");
}

fs.writeFileSync('src/components/ClassDetail.tsx', content);
