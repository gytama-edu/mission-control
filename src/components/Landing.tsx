import { useState } from 'react';
import { Rocket, GraduationCap } from 'lucide-react';

interface LandingProps {
  onSelectTeacher: () => void;
  onSelectStudent: () => void;
}

export function Landing({ onSelectTeacher, onSelectStudent }: LandingProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <Rocket className="mx-auto h-16 w-16 text-blue-500 mb-6" />
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Mission Control
          </h1>
          <p className="text-xl text-slate-400">Classroom Gamification Platform</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={onSelectStudent}
            className="group bg-slate-900 border border-slate-800 rounded-2xl p-8 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all text-left flex flex-col h-full"
          >
            <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform">
              <GraduationCap size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Student Access</h2>
            <p className="text-slate-400">Join your class, check your status, and view the leaderboard.</p>
          </button>

          <button
            onClick={onSelectTeacher}
            className="group bg-slate-900 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 hover:bg-slate-800/50 transition-all text-left flex flex-col h-full"
          >
            <div className="bg-blue-500/10 text-blue-400 p-4 rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform">
              <Rocket size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Teacher Dashboard</h2>
            <p className="text-slate-400">Manage classes, students, lives, and points.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
