import { useState, useEffect } from 'react';
import { ClassData } from '../types';
import { ArrowLeft, Key, Rocket, Shield, Star, Trophy, Clock, LogOut } from 'lucide-react';

interface StudentAccessProps {
  classes: ClassData[];
  onBack: () => void;
}

const PROFILE_KEY = 'mission_control_student_profile';

export function StudentAccess({ classes, onBack }: StudentAccessProps) {
  const [joinCode, setJoinCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  const [loggedInClass, setLoggedInClass] = useState<ClassData | null>(null);
  const [loggedInStudentId, setLoggedInStudentId] = useState<string | null>(null);

  const [savedProfile, setSavedProfile] = useState<{ classId: string, studentId: string } | null>(null);
  const [showSavedPrompt, setShowSavedPrompt] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROFILE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const c = classes.find(c => c.id === parsed.classId);
        const s = c?.students.find(s => s.id === parsed.studentId);
        if (c && s) {
          setSavedProfile(parsed);
          setShowSavedPrompt(true);
        } else {
          window.localStorage.removeItem(PROFILE_KEY);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [classes]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const targetClass = classes.find(c => String(c.joinCode).trim().toUpperCase() === joinCode.trim().toUpperCase());
    if (!targetClass) {
      setError('Class code not found.');
      return;
    }

    const student = targetClass.students.find(s => String(s.pin).trim() === pin.trim());
    if (!student) {
      setError('PIN not found in this class.');
      return;
    }

    setLoggedInClass(targetClass);
    setLoggedInStudentId(student.id);
  };

  const handleSaveProfile = () => {
    if (loggedInClass && loggedInStudentId) {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify({
        classId: loggedInClass.id,
        studentId: loggedInStudentId
      }));
    }
  };

  const handleLogout = () => {
    setLoggedInClass(null);
    setLoggedInStudentId(null);
    setJoinCode('');
    setPin('');
  };

  if (loggedInClass && loggedInStudentId) {
    const student = loggedInClass.students.find(s => s.id === loggedInStudentId);
    if (!student) return null; // Should not happen

    const status = student.lives === 0 ? 'Out' : student.lives <= loggedInClass.maxLives / 2 ? 'Warning' : 'Safe';
    const statusColor = status === 'Out' ? 'text-red-500 bg-red-500/10 border-red-500/20' 
      : status === 'Warning' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
      : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';

    const sortedStudents = [...loggedInClass.students].sort((a, b) => b.points - a.points);
    const rank = sortedStudents.findIndex(s => s.id === student.id) + 1;

    const latestMeeting = loggedInClass.meetings.length > 0 
      ? new Date(loggedInClass.meetings[loggedInClass.meetings.length - 1].startedAt).toLocaleDateString()
      : 'No meetings yet';

    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Rocket className="text-emerald-500" /> Mission Control
          </h1>
          <button 
            onClick={handleLogout}
            className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <LogOut size={18} /> Logout
          </button>
        </header>

        {!window.localStorage.getItem(PROFILE_KEY) && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-blue-200 text-sm">Save this profile on this device for quick access next time?</div>
            <div className="flex gap-2">
              <button onClick={() => window.localStorage.setItem(PROFILE_KEY, 'dismissed')} className="px-3 py-1.5 text-sm text-blue-300 hover:text-white">Not now</button>
              <button onClick={() => { handleSaveProfile(); alert('Profile saved!'); }} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded shadow-sm">Save Profile</button>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-display font-bold text-white mb-1">{student.nickname || student.name}</h2>
                  <p className="text-slate-400 flex items-center gap-2">
                    Class: <span className="text-white font-medium">{loggedInClass.name}</span>
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-lg text-sm font-medium border ${statusColor}`}>
                  Status: {status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-slate-400 mb-2 font-medium">
                    <Shield size={16} className="text-red-400" /> Lives
                  </div>
                  <div className="text-3xl font-mono font-bold text-white">
                    {student.lives} <span className="text-lg text-slate-500">/ {loggedInClass.maxLives}</span>
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-slate-400 mb-2 font-medium">
                    <Star size={16} className="text-yellow-400" /> Points
                  </div>
                  <div className="text-3xl font-mono font-bold text-yellow-400">
                    {student.points}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" /> Leaderboard Info
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <span className="text-slate-400">Your Rank</span>
                  <span className="font-mono font-bold text-white">#{rank}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <span className="text-slate-400">Total Students</span>
                  <span className="font-mono font-bold text-white">{loggedInClass.students.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1"><Clock size={14} /> Last Meeting</span>
                  <span className="text-sm font-medium text-slate-300">{latestMeeting}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-4">
      <header className="mb-auto">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors w-fit"
        >
          <ArrowLeft size={20} /> Back to Main
        </button>
      </header>

      <div className="w-full max-w-md mx-auto my-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <Rocket className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
          <h1 className="text-3xl font-display font-bold text-white mb-2">Student Access</h1>
          <p className="text-slate-400">Enter your credentials to view your status.</p>
        </div>

        {showSavedPrompt && savedProfile ? (
          <div className="mb-8">
            <div className="bg-slate-800/50 border border-slate-700 p-5 rounded-xl text-center mb-4">
              <p className="text-slate-300 mb-2">Saved Profile Found</p>
              <h3 className="text-xl font-bold text-white mb-4">
                {classes.find(c => c.id === savedProfile.classId)?.students.find(s => s.id === savedProfile.studentId)?.name}
              </h3>
              <button
                onClick={() => {
                  setLoggedInClass(classes.find(c => c.id === savedProfile.classId) || null);
                  setLoggedInStudentId(savedProfile.studentId);
                  setShowSavedPrompt(false);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold transition-colors"
              >
                Continue
              </button>
            </div>
            <button
              onClick={() => setShowSavedPrompt(false)}
              className="w-full text-slate-400 hover:text-white text-sm"
            >
              Use another profile
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Class Code</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SPACE1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Student PIN</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  required
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="4-digit PIN"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold transition-colors mt-2"
            >
              Access Dashboard
            </button>
          </form>
        )}
      </div>
      <div className="mt-auto" />
    </div>
  );
}
