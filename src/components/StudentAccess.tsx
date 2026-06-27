import React, { useState, useEffect } from 'react';
import { ClassData, Student } from '../types';
import { ArrowLeft, Key, Rocket, Shield, Star, Trophy, Clock, LogOut, Loader2 } from 'lucide-react';
import * as db from '../services/missionControlData';
import { supabase } from '../lib/supabaseClient';

interface StudentAccessProps {
  onBack: () => void;
}

const PROFILE_KEY = 'mission_control_student_profile';

export function StudentAccess({ onBack }: StudentAccessProps) {
  const [joinCode, setJoinCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [restoringProfile, setRestoringProfile] = useState(false);
  
  const [loggedInClass, setLoggedInClass] = useState<ClassData | null>(null);
  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(null);

  const [savedProfile, setSavedProfile] = useState<{ classId: string, studentId: string, studentName?: string } | null>(null);
  const [showSavedPrompt, setShowSavedPrompt] = useState(false);

  // Auto-restore profile on refresh/mount
  useEffect(() => {
    const autoRestore = async () => {
      try {
        const saved = window.localStorage.getItem(PROFILE_KEY);
        if (saved && saved !== 'dismissed') {
          const parsed = JSON.parse(saved);
          if (parsed.classId && parsed.studentId) {
            setRestoringProfile(true);
            setError('');
            const { classData, studentData } = await db.getStudentDashboardData(parsed.classId, parsed.studentId);
            if (classData && studentData) {
              setLoggedInClass(classData);
              setLoggedInStudent(studentData);
            } else {
              setError('Profile no longer exists. Please log in again.');
              window.localStorage.removeItem(PROFILE_KEY);
            }
          }
        }
      } catch (e) {
        console.error(e);
        setError('Failed to restore profile.');
      } finally {
        setRestoringProfile(false);
      }
    };
    autoRestore();
  }, []);

  // Fetch the latest dashboard data helper
  const fetchDashboardData = async (classId: string, studentId: string) => {
    setIsLoading(true);
    setError('');
    try {
      const { classData, studentData } = await db.getStudentDashboardData(classId, studentId);
      if (classData && studentData) {
        setLoggedInClass(classData);
        setLoggedInStudent(studentData);
      } else {
        setError('Saved profile data could not be found.');
        window.localStorage.removeItem(PROFILE_KEY);
        setShowSavedPrompt(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect.');
    } finally {
      setIsLoading(false);
    }
  };

  // Realtime subscription setup
  useEffect(() => {
    if (!loggedInClass || !loggedInStudent) return;

    const classId = loggedInClass.id;
    const studentId = loggedInStudent.id;

    // Helper to refresh in background
    const refreshData = async () => {
      try {
        const { classData, studentData } = await db.getStudentDashboardData(classId, studentId);
        if (classData && studentData) {
          setLoggedInClass(classData);
          setLoggedInStudent(studentData);
        }
      } catch (err) {
        console.error("Failed to fetch updated real-time data:", err);
      }
    };

    // 1. Subscribe to the logged-in student row specifically (for instantaneous updates)
    const studentSubscription = supabase
      .channel(`student-self-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'students',
          filter: `id=eq.${studentId}`,
        },
        (payload) => {
          const updatedRow = payload.new as any;
          if (updatedRow) {
            setLoggedInStudent(prev => {
              if (!prev) return null;
              return {
                ...prev,
                name: updatedRow.name,
                nickname: updatedRow.nickname || '',
                lives: updatedRow.lives,
                points: updatedRow.points,
                pin: updatedRow.pin,
              };
            });
          }
          // Also trigger background refresh of full class data to keep things in perfect sync
          refreshData();
        }
      )
      .subscribe();

    // 2. Subscribe to all student changes in the same class (to recalculate rank/leaderboard)
    const classStudentsSubscription = supabase
      .channel(`class-students-${classId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          // If update is for someone else or is an insert/delete, pull fresh class list
          if (payload.new && (payload.new as any).id !== studentId) {
            refreshData();
          } else if (payload.eventType === 'DELETE' || payload.eventType === 'INSERT') {
            refreshData();
          }
        }
      )
      .subscribe();

    // 3. Subscribe to current class detail updates (e.g., changing maxLives, level, or name)
    const classSubscription = supabase
      .channel(`class-details-${classId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'classes',
          filter: `id=eq.${classId}`,
        },
        () => {
          refreshData();
        }
      )
      .subscribe();

    // 4. Subscribe to meetings INSERT for this class
    const meetingsSubscription = supabase
      .channel(`class-meetings-${classId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meetings',
          filter: `class_id=eq.${classId}`,
        },
        () => {
          refreshData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentSubscription);
      supabase.removeChannel(classStudentsSubscription);
      supabase.removeChannel(classSubscription);
      supabase.removeChannel(meetingsSubscription);
    };
  }, [loggedInClass?.id, loggedInStudent?.id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const normalizedEnteredCode = joinCode.trim().toUpperCase();
    const normalizedEnteredPin = pin.trim();

    try {
      const targetClass = await db.findClassByJoinCode(normalizedEnteredCode);
      if (!targetClass) {
        setError('Class code not found.');
        setIsLoading(false);
        return;
      }

      const student = await db.findStudentByClassAndPin(targetClass.id, normalizedEnteredPin);
      if (!student) {
        setError('PIN not found in this class.');
        setIsLoading(false);
        return;
      }

      await fetchDashboardData(targetClass.id, student.id);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
      setIsLoading(false);
    }
  };

  const handleSaveProfile = () => {
    if (loggedInClass && loggedInStudent) {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify({
        classId: loggedInClass.id,
        studentId: loggedInStudent.id,
        studentName: loggedInStudent.nickname || loggedInStudent.name
      }));
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(PROFILE_KEY);
    setLoggedInClass(null);
    setLoggedInStudent(null);
    setJoinCode('');
    setPin('');
  };

  if (restoringProfile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
          <Loader2 className="mx-auto h-12 w-12 text-emerald-500 animate-spin mb-4" />
          <p className="text-slate-400">Loading student profile...</p>
        </div>
      </div>
    );
  }


  if (loggedInClass && loggedInStudent) {
    const student = loggedInStudent;
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => fetchDashboardData(loggedInClass.id, student.id)}
              className="text-slate-400 hover:text-white transition-colors"
              title="Refresh Data"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Refresh'}
            </button>
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
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
                  <span className="font-mono font-bold text-white">#{rank > 0 ? rank : '-'}</span>
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
                {savedProfile.studentName || 'Student Profile'}
              </h3>
              <button
                onClick={() => {
                  fetchDashboardData(savedProfile.classId, savedProfile.studentId);
                  setShowSavedPrompt(false);
                }}
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Continue'}
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
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold transition-colors mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Access Dashboard'}
            </button>
          </form>
        )}
      </div>
      <div className="mt-auto" />
    </div>
  );
}
