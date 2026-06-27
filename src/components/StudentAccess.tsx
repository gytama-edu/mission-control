import React, { useState, useEffect } from 'react';
import { ClassData, Student, ActivityLog } from '../types';
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

  const [studentLogs, setStudentLogs] = useState<ActivityLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [isTableMissing, setIsTableMissing] = useState(false);

  const loadStudentLogs = async (classId: string, studentId: string) => {
    setIsLogsLoading(true);
    try {
      const logs = await db.fetchStudentActivityLogs(classId, studentId);
      setStudentLogs(logs);
      setIsTableMissing(false);
    } catch (err: any) {
      if (err && (err.code === 'PGRST205' || (err.message && err.message.includes('activity_logs') && err.message.includes('schema cache')))) {
        setIsTableMissing(true);
        console.warn('Activity logs table is missing in Supabase. Student log view is disabled until migration is run.');
      } else {
        console.error('Failed to load student activity logs:', err);
      }
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!loggedInClass || !loggedInStudent) {
      setStudentLogs([]);
      return;
    }
    const classId = loggedInClass.id;
    const studentId = loggedInStudent.id;
    loadStudentLogs(classId, studentId);

    if (isTableMissing) return;

    // Subscribe to realtime updates on activity_logs for this student
    const channel = supabase
      .channel(`student-logs-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_logs',
          filter: `student_id=eq.${studentId}`
        },
        () => {
          loadStudentLogs(classId, studentId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loggedInClass?.id, loggedInStudent?.id, isTableMissing]);

  // Auto-restore profile on refresh/mount
  useEffect(() => {
    const autoRestore = async () => {
      try {
        const saved = window.localStorage.getItem(PROFILE_KEY);
        if (saved) {
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

  const handleLogout = () => {
    window.localStorage.removeItem(PROFILE_KEY);
    setLoggedInClass(null);
    setLoggedInStudent(null);
    setJoinCode('');
    setPin('');
  };

  // Fetch the latest dashboard data helper
  const fetchDashboardData = async (classId: string, studentId: string) => {
    setIsLoading(true);
    setError('');
    try {
      const { classData, studentData } = await db.getStudentDashboardData(classId, studentId);
      if (classData && studentData) {
        setLoggedInClass(classData);
        setLoggedInStudent(studentData);
        // Automatically save session to localStorage when logged in successfully!
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify({
          classId,
          studentId,
        }));
      } else {
        setError('Profile no longer exists. Please log in again.');
        window.localStorage.removeItem(PROFILE_KEY);
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
        } else {
          // If data isn't found during refresh, they might have been deleted
          handleLogout();
          setError('Your profile or class has been removed by the teacher.');
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
          // If logged-in student got deleted, log them out!
          if (payload.eventType === 'DELETE' && payload.old && (payload.old as any).id === studentId) {
            handleLogout();
            setError('Your student profile was removed by the teacher.');
            return;
          }
          // Otherwise pull fresh class list/rankings
          refreshData();
        }
      )
      .subscribe();

    // 3. Subscribe to current class detail updates (e.g., changing maxLives, level, or name, or DELETE)
    const classSubscription = supabase
      .channel(`class-details-${classId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'classes',
          filter: `id=eq.${classId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            handleLogout();
            setError('This class has been deleted by the teacher.');
            return;
          }
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

            {/* My Recent Updates (Personal Timeline) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                <Clock size={18} className="text-indigo-400" /> My Recent Updates
              </h3>
              
              {isTableMissing ? (
                <div className="py-4 text-center text-slate-500 text-xs italic leading-relaxed">
                  Timeline features are disabled until the database tables are initialized in Supabase by the teacher.
                </div>
              ) : isLogsLoading && studentLogs.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm font-medium">Loading history...</div>
              ) : studentLogs.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm">
                  No point or life updates recorded yet. Keep up the good work!
                </div>
              ) : (
                <div className="space-y-3">
                  {studentLogs.map((log) => {
                    const isPoints = log.action_type === 'points_changed';
                    const isLives = log.action_type === 'lives_changed';
                    const isUndone = log.undone;

                    let title = '';
                    let badgeColor = 'bg-slate-800 text-slate-400 border border-slate-750';

                    if (isPoints) {
                      const delta = log.points_delta || 0;
                      const sign = delta > 0 ? '+' : '';
                      title = `${sign}${delta} Points`;
                      badgeColor = delta > 0 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20';
                    } else if (isLives) {
                      const delta = log.lives_delta || 0;
                      const sign = delta > 0 ? '+' : '';
                      title = `${sign}${delta} Lives`;
                      badgeColor = delta > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20';
                    } else {
                      title = 'Update';
                    }

                    return (
                      <div
                        key={log.id}
                        className={`bg-slate-950 border border-slate-800/60 rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all ${
                          isUndone ? 'opacity-45 select-none' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold shrink-0 border ${badgeColor}`}>
                            {title}
                          </span>
                          <div className="space-y-1">
                            {log.reason ? (
                              <p className={`text-sm font-medium text-slate-200 ${isUndone ? 'line-through' : ''}`}>
                                "{log.reason}"
                              </p>
                            ) : (
                              <p className={`text-sm text-slate-400 ${isUndone ? 'line-through' : ''}`}>
                                {isPoints ? (log.points_delta! > 0 ? 'Earned points' : 'Lost points') : (log.lives_delta! > 0 ? 'Restored lives' : 'Lost lives')}
                              </p>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono block font-sans">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {isUndone && (
                          <span className="text-xs bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-md font-bold font-mono shrink-0">
                            UNDONE
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
      </div>
      <div className="mt-auto" />
    </div>
  );
}
