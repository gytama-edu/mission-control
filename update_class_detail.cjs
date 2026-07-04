const fs = require('fs');
let content = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

// We need to import updateGuardianCode
const importTarget = `import { updateClass, deleteClass, regenerateJoinCode, updateStudentLives, updateStudentPoints, updateStudentName, deleteStudent, logActivity, addBadge, deleteBadge, awardBadge, revokeBadge } from '../services/missionControlData';`;
const importReplacement = `import { updateClass, deleteClass, regenerateJoinCode, updateStudentLives, updateStudentPoints, updateStudentName, deleteStudent, logActivity, addBadge, deleteBadge, awardBadge, revokeBadge, updateGuardianCode } from '../services/missionControlData';`;
content = content.replace(importTarget, importReplacement);

// Add a function to reset guardian code
const resetTarget = `  const handleCopyLoginInfo = (student: any) => {`;
const resetReplacement = `  const [isResettingGuardianCode, setIsResettingGuardianCode] = useState(false);
  const handleResetGuardianCode = async (studentId: string) => {
    setIsResettingGuardianCode(true);
    try {
      await updateGuardianCode(studentId);
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

  const handleCopyLoginInfo = (student: any) => {`;

if(content.includes(resetTarget)) {
  content = content.replace(resetTarget, resetReplacement);
} else {
  // Try another place
  const otherTarget = `const handleUpdateStudentName = async () => {`;
  content = content.replace(otherTarget, resetReplacement.replace('const handleCopyLoginInfo = (student: any) => {', '') + '\n' + otherTarget);
}

const copyBtnTarget = `<button
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
                    <Key size={16} />
                    Copy Login Credentials
                  </button>`;
                  
const copyBtnReplacement = copyBtnTarget + `\n                  <button
                    type="button"
                    onClick={() => {
                      const student = classData.students.find(s => s.id === editingStudentId);
                      if (student) handleCopyGuardianInfo(student);
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <ShieldCheck size={16} />
                    Copy Guardian Info
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if(window.confirm('Are you sure you want to reset the guardian code for this student? The old code will no longer work.')) {
                        handleResetGuardianCode(editingStudentId!);
                      }
                    }}
                    disabled={isResettingGuardianCode}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-amber-500 hover:text-amber-400 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw size={16} className={isResettingGuardianCode ? "animate-spin" : ""} />
                    Reset Guardian Code
                  </button>`;

content = content.replace(copyBtnTarget, copyBtnReplacement);

// Also add to the table view in the roster
const tableRowTarget = `<div className="mt-2 text-xs text-slate-500 flex items-center gap-1 font-mono select-none">
                            <Key size={12} className="text-rose-500/70" /> PIN: <strong className="text-slate-300 font-bold">{student.pin}</strong>
                          </div>`;
const tableRowReplacement = tableRowTarget + `\n                          <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1 font-mono select-none">
                            <ShieldCheck size={10} className="text-sky-500/70" /> Guardian Code: <strong className="text-slate-300 font-bold">{student.guardian_access_code || 'None'}</strong>
                          </div>`;
                          
content = content.replace(tableRowTarget, tableRowReplacement);

fs.writeFileSync('src/components/ClassDetail.tsx', content);
