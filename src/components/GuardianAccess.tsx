import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, Loader2, Sparkles, Trophy } from 'lucide-react';
import { fetchGuardianStudentPreview } from '../services/missionControlData';

interface GuardianAccessProps {
  onBack: () => void;
}

export function GuardianAccess({ onBack }: GuardianAccessProps) {
  const [classCode, setClassCode] = useState('');
  const [guardianCode, setGuardianCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [studentPreview, setStudentPreview] = useState<any>(null);
  const [classData, setClassData] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode.trim() || !guardianCode.trim()) {
      setError('Please enter both the class code and guardian code.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const result = await fetchGuardianStudentPreview(classCode.trim().toUpperCase(), guardianCode.trim().toUpperCase());
      if (result.ok && result.studentData && result.classData) {
        setStudentPreview(result.studentData);
        setClassData(result.classData);
      } else {
        setError('We could not verify this guardian access code. Please check your credentials and try again.');
      }
    } catch (err: any) {
      console.error(err);
      setError('An error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  if (studentPreview && classData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6 font-sans relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-sky-950/20 via-slate-950/40 to-slate-950 pointer-events-none" />
        
        <header className="max-w-3xl w-full mx-auto flex items-center justify-between mb-8 relative z-10 border-b border-slate-900/60 pb-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-sky-400" size={24} />
            <div>
              <h1 className="text-xl font-display font-black text-white tracking-tight">Guardian Portal</h1>
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">Phase 25B Preview</span>
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-xs font-semibold text-slate-400 hover:text-white transition-all bg-slate-900/60 hover:bg-slate-900 border border-slate-800/85 hover:border-slate-700/60 rounded-lg px-3 py-2 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} /> Exit
          </button>
        </header>

        <main className="max-w-3xl w-full mx-auto relative z-10 flex-1 flex flex-col items-center pt-8">
          <div className="w-full bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-8 shadow-xl text-center space-y-6">
            <div className="inline-flex items-center justify-center p-4 bg-sky-500/10 text-sky-400 rounded-full mb-2">
              <ShieldCheck size={32} />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-white">
                {studentPreview.nickname ? `${studentPreview.name} (${studentPreview.nickname})` : studentPreview.name}
              </h2>
              <p className="text-sm text-slate-400 mt-1 flex items-center justify-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-500"></span>
                {classData.name}
              </p>
            </div>

            <div className="flex justify-center gap-6 mt-6">
              <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-4 min-w-[120px]">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Points</div>
                <div className="text-2xl font-black text-amber-400">{studentPreview.points}</div>
              </div>
              {classData.scoring_system === 'lives' && (
                <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-4 min-w-[120px]">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Health</div>
                  <div className="text-2xl font-black text-rose-400">{studentPreview.lives}</div>
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-800/60 max-w-md mx-auto">
              <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4">
                <h3 className="text-sm font-bold text-sky-300 flex items-center justify-center gap-1.5 mb-2">
                  <Sparkles size={16} /> Dashboard Being Prepared
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The full Guardian Dashboard is currently in development. Soon you'll be able to view detailed task progress, read teacher feedback, and celebrate learning milestones.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-sky-950/20 via-slate-950/40 to-slate-950 pointer-events-none" />
      
      <header className="w-full flex items-center justify-between mb-8 relative z-10">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 font-medium bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative z-10 w-full max-w-md mx-auto -mt-20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-sky-500/10 text-sky-400 rounded-2xl mb-4">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-display font-black text-white tracking-tight mb-2">Guardian Access</h1>
          <p className="text-sm text-slate-400">View your child's learning progress</p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl w-full">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-xs mb-6 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Class Code</label>
              <input
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="e.g. MATH101"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all font-mono text-sm uppercase"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Guardian Code</label>
              <input
                type="text"
                value={guardianCode}
                onChange={(e) => setGuardianCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all font-mono text-sm uppercase"
              />
              <p className="text-[10px] text-slate-500 mt-2">
                * Enter the class code and guardian code provided by the teacher.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold transition-all duration-200 mt-4 flex items-center justify-center gap-2 cursor-pointer shadow-md text-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Verifying access...</span>
                </>
              ) : (
                <span>Access Dashboard</span>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
