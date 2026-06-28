import { useState } from 'react';
import { Rocket, GraduationCap } from 'lucide-react';

interface LandingProps {
  onSelectTeacher: () => void;
  onSelectStudent: () => void;
}

export function Landing({ onSelectTeacher, onSelectStudent }: LandingProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-6">
      {/* Spacer */}
      <div className="flex-1" />

      <div className="max-w-2xl w-full flex-1 flex flex-col justify-center">
        <div className="text-center mb-12 select-none">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono uppercase tracking-widest mb-6">
            Presented by GYTama EDU
          </div>
          <div className="relative inline-block">
            <Rocket className="mx-auto h-16 w-16 text-rose-500 mb-6 drop-shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse" />
          </div>
          <h1 className="text-4.5xl md:text-5xl font-display font-bold text-white mb-3 tracking-tight">
            Mission Control
          </h1>
          <p className="text-lg text-slate-400 font-display">
            The premium gamified classroom command center.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={onSelectStudent}
            className="group bg-slate-900/45 backdrop-blur-md border border-slate-800/80 rounded-2xl p-8 hover:border-emerald-500/40 hover:bg-slate-900/70 transition-all duration-300 text-left flex flex-col h-full cursor-pointer hover:shadow-lg hover:shadow-emerald-950/20"
          >
            <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-xl w-fit mb-6 group-hover:scale-110 group-hover:bg-emerald-500/15 transition-all duration-300">
              <GraduationCap size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Student Access</h2>
            <p className="text-sm leading-relaxed text-slate-400">Join your class command post, complete objectives, view status logs, and climb the rankings.</p>
          </button>

          <button
            onClick={onSelectTeacher}
            className="group bg-slate-900/45 backdrop-blur-md border border-slate-800/80 rounded-2xl p-8 hover:border-rose-500/40 hover:bg-slate-900/70 transition-all duration-300 text-left flex flex-col h-full cursor-pointer hover:shadow-lg hover:shadow-rose-950/20"
          >
            <div className="bg-rose-500/10 text-rose-400 p-4 rounded-xl w-fit mb-6 group-hover:scale-110 group-hover:bg-rose-500/15 transition-all duration-300">
              <Rocket size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Teacher Dashboard</h2>
            <p className="text-sm leading-relaxed text-slate-400">Manage classroom cohorts, award custom merit badges, host live sessions, and analyze progress reports.</p>
          </button>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="flex-1 flex items-end justify-center pt-12 select-none">
        <p className="text-xs font-mono uppercase tracking-widest text-slate-600">
          Mission Control &copy; {new Date().getFullYear()} &bull; GYTama EDU
        </p>
      </div>
    </div>
  );
}
