const fs = require('fs');
let content = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const targetState = `  const [isResettingGuardianCode, setIsResettingGuardianCode] = useState(false);`;
const replacementState = `  const [isResettingGuardianCode, setIsResettingGuardianCode] = useState(false);
  const [guardianCodeError, setGuardianCodeError] = useState<string | null>(null);`;
if (content.includes(targetState) && !content.includes('guardianCodeError')) {
  content = content.replace(targetState, replacementState);
}

const targetRender = `{/* Roster Grid */}`;
const replacementRender = `{guardianCodeError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm mb-4 flex items-center justify-between">
              <span>{guardianCodeError}</span>
              <button onClick={() => setGuardianCodeError(null)} className="text-rose-400 hover:text-rose-300">
                &times;
              </button>
            </div>
          )}
          {/* Roster Grid */}`;
if (content.includes(targetRender) && !content.includes('guardianCodeError &&')) {
  content = content.replace(targetRender, replacementRender);
}

const targetHandler = `  const handleResetGuardianCode = async (studentId: string) => {
    setIsResettingGuardianCode(true);
    try {
      await db.updateGuardianCode(studentId);
      onSync();
    } catch (err) {
      console.error(err);
      alert('Failed to reset guardian code: ' + (err.message || err.toString()));
    } finally {
      setIsResettingGuardianCode(false);
    }
  };`;

const replacementHandler = `  const handleResetGuardianCode = async (studentId: string) => {
    setIsResettingGuardianCode(true);
    setGuardianCodeError(null);
    try {
      const newCode = await db.updateGuardianCode(studentId);
      // Optimistic UI update
      if (classData.students) {
        const student = classData.students.find(s => s.id === studentId);
        if (student) {
          student.guardian_access_code = newCode;
        }
      }
      onSync();
    } catch (err: any) {
      console.error(err);
      setGuardianCodeError('Guardian code could not be generated. Please sync and try again.');
    } finally {
      setIsResettingGuardianCode(false);
    }
  };`;

if (content.includes(targetHandler)) {
  content = content.replace(targetHandler, replacementHandler);
  console.log("Replaced targetHandler");
} else {
  // Try another variation
  const targetHandler2 = `  const handleResetGuardianCode = async (studentId: string) => {
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
  };`;
  if (content.includes(targetHandler2)) {
    content = content.replace(targetHandler2, replacementHandler);
    console.log("Replaced targetHandler2");
  } else {
    console.log("Could not find handleResetGuardianCode to replace.");
  }
}

fs.writeFileSync('src/components/ClassDetail.tsx', content);
