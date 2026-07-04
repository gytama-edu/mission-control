const fs = require('fs');

let landingCode = fs.readFileSync('src/components/Landing.tsx', 'utf8');

// Add onSelectParent prop
landingCode = landingCode.replace(
  'interface LandingProps {\n  onSelectTeacher: () => void;\n  onSelectStudent: () => void;\n}',
  'import { ShieldCheck } from \'lucide-react\';\n\ninterface LandingProps {\n  onSelectTeacher: () => void;\n  onSelectStudent: () => void;\n  onSelectParent: () => void;\n}'
);

landingCode = landingCode.replace(
  'export function Landing({ onSelectTeacher, onSelectStudent }: LandingProps) {',
  'export function Landing({ onSelectTeacher, onSelectStudent, onSelectParent }: LandingProps) {'
);

landingCode = landingCode.replace(
  '        <div className="grid md:grid-cols-2 gap-5 max-w-2xl w-full mx-auto">',
  '        <div className="grid md:grid-cols-3 gap-5 max-w-4xl w-full mx-auto">'
);

const teacherAccessCard = `          {/* Teacher Access */}
          <button
            onClick={onSelectTeacher}
            className="group relative bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-purple-500/40 rounded-2xl p-6 transition-all duration-300 text-left flex flex-col h-full cursor-pointer hover:shadow-xl hover:shadow-purple-950/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="bg-purple-500/10 text-purple-400 p-3 rounded-xl w-fit mb-5 group-hover:scale-105 group-hover:bg-purple-500/15 transition-all duration-300">
              <MonitorPlay size={24} />
            </div>
            <h2 className="text-xl font-bold text-white mb-1.5 flex items-center gap-2">
              Teacher Dashboard
              <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider hidden group-hover:inline-block">Admin</span>
            </h2>
            <p className="text-xs leading-relaxed text-slate-400 font-normal">
              Manage classes, host live meetings, assign tasks, evaluate submissions, and track badges.
            </p>
            <div className="mt-4 text-[11px] font-semibold text-purple-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Go to Teacher Console &rarr;
            </div>
          </button>`;

const newCards = teacherAccessCard + `

          {/* Parent/Guardian Access */}
          <button
            onClick={onSelectParent}
            className="group relative bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-sky-500/40 rounded-2xl p-6 transition-all duration-300 text-left flex flex-col h-full cursor-pointer hover:shadow-xl hover:shadow-sky-950/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="bg-sky-500/10 text-sky-400 p-3 rounded-xl w-fit mb-5 group-hover:scale-105 group-hover:bg-sky-500/15 transition-all duration-300">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-xl font-bold text-white mb-1.5 flex items-center gap-2">
              Guardian Access
              <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider hidden group-hover:inline-block">View</span>
            </h2>
            <p className="text-xs leading-relaxed text-slate-400 font-normal">
              Monitor student progress, view teacher feedback, and celebrate learning milestones.
            </p>
            <div className="mt-4 text-[11px] font-semibold text-sky-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Go to Guardian Portal &rarr;
            </div>
          </button>`;

landingCode = landingCode.replace(teacherAccessCard, newCards);

fs.writeFileSync('src/components/Landing.tsx', landingCode);
console.log('Landing patched');
