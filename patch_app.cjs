const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// Add view mode 'parent'
appCode = appCode.replace(
  'const [viewMode, setViewMode] = useState<\'landing\' | \'teacher\' | \'student\'>(() => {',
  'const [viewMode, setViewMode] = useState<\'landing\' | \'teacher\' | \'student\' | \'parent\'>(() => {'
);

appCode = appCode.replace(
  '      if (saved === \'landing\' || saved === \'teacher\' || saved === \'student\') {',
  '      if (saved === \'landing\' || saved === \'teacher\' || saved === \'student\' || saved === \'parent\') {'
);

appCode = appCode.replace(
  '  const handleSetViewMode = (mode: \'landing\' | \'teacher\' | \'student\') => {',
  '  const handleSetViewMode = (mode: \'landing\' | \'teacher\' | \'student\' | \'parent\') => {'
);

// Add Parent view rendering (placeholder)
const landingReturn = `<Landing onSelectTeacher={() => handleSetViewMode('teacher')} onSelectStudent={() => handleSetViewMode('student')} />`;
const newLandingReturn = `<Landing onSelectTeacher={() => handleSetViewMode('teacher')} onSelectStudent={() => handleSetViewMode('student')} onSelectParent={() => handleSetViewMode('parent')} />`;
appCode = appCode.replace(landingReturn, newLandingReturn);

const studentViewReturn = `if (viewMode === 'student') {
    return <StudentAccess onBack={() => handleSetViewMode('landing')} />;
  }`;
  
const parentViewReturn = `if (viewMode === 'parent') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
          <div className="bg-sky-500/10 text-sky-400 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path><path d="m9 12 2 2 4-4"></path></svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Guardian Access</h1>
          <p className="text-slate-400 mb-8 text-sm leading-relaxed">
            The Guardian Portal is currently in development. Soon you'll be able to monitor student progress, view teacher feedback, and celebrate learning milestones in a secure, read-only dashboard.
          </p>
          <button
            onClick={() => handleSetViewMode('landing')}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
          >
            Return to Main Menu
          </button>
        </div>
      </div>
    );
  }`;

appCode = appCode.replace(studentViewReturn, studentViewReturn + '\n\n  ' + parentViewReturn);

fs.writeFileSync('src/App.tsx', appCode);
console.log('App patched');
