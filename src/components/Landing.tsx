import { Rocket, GraduationCap, MonitorPlay } from 'lucide-react';

interface LandingProps {
  onSelectTeacher: () => void;
  onSelectStudent: () => void;
}

export function Landing({ onSelectTeacher, onSelectStudent }: LandingProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 font-sans antialiased relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-950/20 via-slate-950/40 to-slate-950 pointer-events-none" />

      {/* Top Spacer */}
      <div className="flex-1 min-h-[32px]" />

      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col justify-center relative z-10">
        {/* Branding Section */}
        <div className="text-center mb-10 select-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-semibold uppercase tracking-wider mb-4 animate-fade-in">
            🚀 Presented by GYTama EDU
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2 font-display bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            Mission Control
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto leading-relaxed">
            A premium gamified classroom command center for teachers and students.
          </p>
        </div>

        {/* Access Pathways */}
        <div className="grid md:grid-cols-2 gap-5 max-w-2xl w-full mx-auto">
          {/* Student Access */}
          <button
            onClick={onSelectStudent}
            className="group relative bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-6 transition-all duration-300 text-left flex flex-col h-full cursor-pointer hover:shadow-xl hover:shadow-emerald-950/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl w-fit mb-5 group-hover:scale-105 group-hover:bg-emerald-500/15 transition-all duration-300">
              <GraduationCap size={24} />
            </div>
            <h2 className="text-xl font-bold text-white mb-1.5 flex items-center gap-2">
              Student Access
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider hidden group-hover:inline-block">Enter</span>
            </h2>
            <p className="text-xs leading-relaxed text-slate-400 font-normal">
              Join your class command post, complete tasks, view teacher feedback, and earn merit badges.
            </p>
            <div className="mt-4 text-[11px] font-semibold text-emerald-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Go to Command Post &rarr;
            </div>
          </button>

          {/* Teacher Access */}
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
              Manage classroom cohorts, host live meetings, assign tasks, evaluate submissions, and track badges.
            </p>
            <div className="mt-4 text-[11px] font-semibold text-purple-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Go to Teacher Console &rarr;
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Spacer */}
      <div className="flex-1 min-h-[48px]" />

      {/* Footer Branding */}
      <div className="w-full flex justify-center py-4 select-none relative z-10 border-t border-slate-900/40">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
          Mission Control &copy; {new Date().getFullYear()} &bull; GYTama EDU
        </p>
      </div>
    </div>
  );
}

