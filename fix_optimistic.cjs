const fs = require('fs');
let content = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const targetState = `  const [isResettingGuardianCode, setIsResettingGuardianCode] = useState(false);
  const [guardianCodeError, setGuardianCodeError] = useState<string | null>(null);`;
const replacementState = `  const [isResettingGuardianCode, setIsResettingGuardianCode] = useState(false);
  const [guardianCodeError, setGuardianCodeError] = useState<string | null>(null);
  const [optimisticGuardianCodes, setOptimisticGuardianCodes] = useState<Record<string, string>>({});`;
if (content.includes(targetState) && !content.includes('optimisticGuardianCodes')) {
  content = content.replace(targetState, replacementState);
}

const targetHandler = `  const handleResetGuardianCode = async (studentId: string) => {
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

const replacementHandler = `  const handleResetGuardianCode = async (studentId: string) => {
    setIsResettingGuardianCode(true);
    setGuardianCodeError(null);
    try {
      const newCode = await db.updateGuardianCode(studentId);
      setOptimisticGuardianCodes(prev => ({ ...prev, [studentId]: newCode }));
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
  console.log("Replaced handler with optimistic state.");
}

// Now replace usages of student.guardian_access_code with (optimisticGuardianCodes[student.id] || student.guardian_access_code) inside the mapping loops.
content = content.replace(/student\.guardian_access_code/g, "(optimisticGuardianCodes[student.id] || student.guardian_access_code)");
// The regex above will also replace student.guardian_access_code ? ... which is what we want!

fs.writeFileSync('src/components/ClassDetail.tsx', content);
