const fs = require('fs');
let content = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const stateTarget = `  const [isResettingGuardianCode, setIsResettingGuardianCode] = useState(false);`;
const stateReplacement = `  const [isResettingGuardianCode, setIsResettingGuardianCode] = useState(false);
  const [guardianCodeError, setGuardianCodeError] = useState<string | null>(null);`;
content = content.replace(stateTarget, stateReplacement);

const handlerTarget = `  const handleResetGuardianCode = async (studentId: string) => {
    setIsResettingGuardianCode(true);
    try {
      await db.updateGuardianCode(studentId);
      onSync();
    } catch (err: any) {
      console.error(err);
      alert('Failed to reset guardian code: ' + (err.message || err.toString()));
    } finally {
      setIsResettingGuardianCode(false);
    }
  };`;
const handlerReplacement = `  const handleResetGuardianCode = async (studentId: string) => {
    setIsResettingGuardianCode(true);
    setGuardianCodeError(null);
    try {
      await db.updateGuardianCode(studentId);
      onSync();
    } catch (err: any) {
      console.error(err);
      setGuardianCodeError('Guardian code could not be generated. Please sync and try again.');
    } finally {
      setIsResettingGuardianCode(false);
    }
  };`;
content = content.replace(handlerTarget, handlerReplacement);

const renderTarget = `{/* Roster Grid */}`;
const renderReplacement = `{guardianCodeError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm mb-4 flex items-center justify-between">
              <span>{guardianCodeError}</span>
              <button onClick={() => setGuardianCodeError(null)} className="text-rose-400 hover:text-rose-300">
                &times;
              </button>
            </div>
          )}
          {/* Roster Grid */}`;
content = content.replace(renderTarget, renderReplacement);

fs.writeFileSync('src/components/ClassDetail.tsx', content);
