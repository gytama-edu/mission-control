import React, { useState, useEffect } from 'react';
import { ClassData, ActivityLog } from '../types';
import { ArrowLeft, Users, Shield, Plus, Minus, Star, Play, Trophy, Settings, Trash2, Edit2, X, AlertTriangle, Key, Copy, RefreshCw, Clock, Undo2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import * as db from '../services/missionControlData';

interface ClassDetailProps {
  classData: ClassData;
  onBack: () => void;
  onEditClass: (name: string, level: string, maxLives: number) => void;
  onDeleteClass: () => void;
  onRegenerateJoinCode: () => void;
  onAddStudent: (name: string) => void;
  onEditStudent: (studentId: string, name: string, nickname?: string) => void;
  onDeleteStudent: (studentId: string) => void;
  onRegenerateStudentPin: (studentId: string) => void;
  onUpdateLives: (studentId: string, change: number, reason?: string | null) => void;
  onUpdatePoints: (studentId: string, change: number, reason?: string | null) => void;
  onStartMeeting: () => void;
  onEndMeeting: (meetingId: string) => void;
}

export function ClassDetail({
  classData,
  onBack,
  onEditClass,
  onDeleteClass,
  onRegenerateJoinCode,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onRegenerateStudentPin,
  onUpdateLives,
  onUpdatePoints,
  onStartMeeting,
  onEndMeeting
}: ClassDetailProps) {
  const [newStudentName, setNewStudentName] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'leaderboard' | 'activity_log' | 'meetings' | 'settings'>('roster');

  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'points' | 'lives' | 'system'>('all');
  const [timelineMeetingFilter, setTimelineMeetingFilter] = useState<'current' | 'all'>('all');
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isEndMeetingModalOpen, setIsEndMeetingModalOpen] = useState(false);
  const [selectedMeetingForSummary, setSelectedMeetingForSummary] = useState<any | null>(null);

  const loadLogs = async () => {
    setIsLogsLoading(true);
    try {
      const logs = await db.fetchActivityLogs(classData.id);
      setActivityLogs(logs);
      setIsTableMissing(false);
    } catch (err: any) {
      if (err && (err.code === 'PGRST205' || (err.message && err.message.includes('activity_logs') && err.message.includes('schema cache')))) {
        setIsTableMissing(true);
        console.warn('Activity logs table is missing in Supabase. Logging is disabled until migration is run.');
      } else {
        console.error('Failed to load activity logs:', err);
      }
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();

    if (isTableMissing) return;

    const channel = supabase
      .channel(`class-logs-${classData.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_logs',
          filter: `class_id=eq.${classData.id}`
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classData.id, isTableMissing]);

  const getActiveReason = () => {
    if (selectedReason === 'custom') {
      return customReason.trim() || null;
    }
    return selectedReason || null;
  };

  // Student Edit State
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentNickname, setEditStudentNickname] = useState('');

  // Class Edit State
  const [editClassName, setEditClassName] = useState(classData.name);
  const [editClassLevel, setEditClassLevel] = useState(classData.level);
  const [editClassMaxLives, setEditClassMaxLives] = useState(classData.maxLives);

  const activeMeeting = classData.meetings?.find(m => m.status === 'active');

  const handleEndMeeting = async () => {
    if (!activeMeeting) return;
    try {
      await onEndMeeting(activeMeeting.id);
      setIsEndMeetingModalOpen(false);
      alert('Class meeting ended and session summary created!');
    } catch (err: any) {
      alert(err.message || 'Failed to end meeting.');
    }
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    onAddStudent(newStudentName.trim());
    setNewStudentName('');
  };

  const sortedStudents = [...classData.students].sort((a, b) => b.points - a.points);

  const getStudentStatus = (lives: number, maxLives: number) => {
    if (lives === 0) return { label: 'Out', color: 'text-red-500 bg-red-500/10 border-red-500/20' };
    if (lives <= maxLives / 2) return { label: 'Warning', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    return { label: 'Safe', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    onEditClass(editClassName, editClassLevel, editClassMaxLives);
    alert('Class settings updated!');
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-8">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white flex items-center gap-2 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-display font-bold text-white">{classData.name}</h1>
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700">
                <Key size={14} className="text-blue-400" />
                <span className="font-mono font-bold text-blue-400">{classData.joinCode}</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(classData.joinCode);
                    alert('Join code copied!');
                  }}
                  className="text-slate-400 hover:text-white p-1 ml-1 transition-colors"
                  title="Copy Join Code"
                >
                  <Copy size={14} />
                </button>
                <button 
                  onClick={() => {
                    if (confirm('Regenerate join code? Students will need the new code to log in.')) {
                      onRegenerateJoinCode();
                    }
                  }}
                  className="text-slate-400 hover:text-white p-1 transition-colors"
                  title="Regenerate Join Code"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                <Users size={14} /> Level: {classData.level}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                <Shield size={14} /> Max Lives: {classData.maxLives}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                <Play size={14} /> Meetings: {classData.meetings.length}
              </span>
            </div>
          </div>

          {activeMeeting ? (
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950 p-4 rounded-xl border border-emerald-500/30">
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-left">
                  <div className="text-sm font-bold text-emerald-400">Meeting in progress</div>
                  <div className="text-xs text-slate-400">
                    Started: {new Date(activeMeeting.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsEndMeetingModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer shrink-0"
              >
                End Class Meeting
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsMeetingModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Play size={20} className="fill-current" />
              Start New Meeting
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-8 overflow-x-auto">
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${
            activeTab === 'roster' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Class Roster
          {activeTab === 'roster' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-6 py-3 font-medium transition-colors relative flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'leaderboard' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Trophy size={16} /> Leaderboard
          {activeTab === 'leaderboard' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('activity_log')}
          className={`px-6 py-3 font-medium transition-colors relative flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'activity_log' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Clock size={16} /> Activity Log
          {activeTab === 'activity_log' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('meetings')}
          className={`px-6 py-3 font-medium transition-colors relative flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'meetings' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Play size={16} /> Meeting History
          {activeTab === 'meetings' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-6 py-3 font-medium transition-colors relative flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'settings' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Settings size={16} /> Settings
          {activeTab === 'settings' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-400" />
          )}
        </button>
      </div>

      {activeTab === 'roster' && (
        <div className="space-y-8">
          {/* Add Student Form */}
          <form onSubmit={handleAddStudent} className="flex gap-3">
            <input
              type="text"
              required
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="New student name..."
              className="flex-1 max-w-md bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus size={18} /> Add Student
            </button>
          </form>

          {/* Preset Reason Selector (Optional) */}
          {classData.students.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-inner">
              <div className="text-sm font-medium text-slate-300">
                Attach Reason (Optional):
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={selectedReason}
                  onChange={(e) => {
                    setSelectedReason(e.target.value);
                    if (e.target.value !== 'custom') setCustomReason('');
                  }}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- No Reason (Quick Change) --</option>
                  <optgroup label="Points Options">
                    <option value="Good answer">Good answer</option>
                    <option value="Great effort">Great effort</option>
                    <option value="Teamwork">Teamwork</option>
                    <option value="Completed homework">Completed homework</option>
                    <option value="Excellent participation">Excellent participation</option>
                  </optgroup>
                  <optgroup label="Lives Options">
                    <option value="Speaking L1 in class">Speaking L1 in class</option>
                    <option value="Off-task behavior">Off-task behavior</option>
                    <option value="Arriving late">Arriving late</option>
                    <option value="Disruptive behavior">Disruptive behavior</option>
                    <option value="No homework">No homework</option>
                  </optgroup>
                  <option value="custom">-- Custom Reason --</option>
                </select>
                
                {selectedReason === 'custom' && (
                  <input
                    type="text"
                    placeholder="Enter custom reason..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                  />
                )}

                {(selectedReason !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReason('');
                      setCustomReason('');
                    }}
                    className="text-slate-400 hover:text-white text-xs underline cursor-pointer px-2"
                  >
                    Clear reason
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Roster Grid */}
          {classData.students.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl border-dashed">
              <Users className="mx-auto h-12 w-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-slate-300">No students yet</h3>
              <p className="text-slate-500 mt-1">Use the form above to add students to the roster.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classData.students.map((student) => {
                const status = getStudentStatus(student.lives, classData.maxLives);
                return (
                <div key={student.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 relative group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                        {student.nickname || student.name}
                        {student.nickname && <span className="text-sm font-normal text-slate-500">({student.name})</span>}
                      </h3>
                      <div className={`mt-1 inline-block px-2 py-0.5 rounded text-xs font-medium border ${status.color}`}>
                        {status.label}
                      </div>
                      <div className="mt-2 text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Key size={10} /> PIN: {student.pin}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingStudentId(student.id);
                        setEditStudentName(student.name);
                        setEditStudentNickname(student.nickname || '');
                      }}
                      className="text-slate-500 hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Lives Control */}
                    <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 flex flex-col justify-between">
                      <div className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider flex items-center gap-1">
                        <Shield size={12} className="text-red-400" /> Lives
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onUpdateLives(student.id, -1, getActiveReason())}
                          disabled={student.lives <= 0}
                          className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus size={16} />
                        </button>
                        <span className={`font-mono text-2xl font-bold ${student.lives === 0 ? 'text-red-500' : 'text-white'}`}>
                          {student.lives}
                        </span>
                        <button
                          onClick={() => onUpdateLives(student.id, 1, getActiveReason())}
                          disabled={student.lives >= classData.maxLives}
                          className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Points Control */}
                    <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 flex flex-col justify-between">
                      <div className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400" /> Points</span>
                        <span className="font-mono text-lg font-bold text-white">{student.points}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 justify-between flex-wrap">
                        <div className="flex gap-1">
                          <button onClick={() => onUpdatePoints(student.id, -1, getActiveReason())} disabled={student.points < 1} className="w-7 h-7 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">-1</button>
                          <button onClick={() => onUpdatePoints(student.id, -5, getActiveReason())} disabled={student.points < 5} className="w-7 h-7 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">-5</button>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => onUpdatePoints(student.id, 1, getActiveReason())} className="w-7 h-7 text-xs rounded bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800 hover:text-emerald-300">+1</button>
                          <button onClick={() => onUpdatePoints(student.id, 5, getActiveReason())} className="w-7 h-7 text-xs rounded bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800 hover:text-emerald-300">+5</button>
                          <button onClick={() => onUpdatePoints(student.id, 10, getActiveReason())} className="w-8 h-7 text-xs rounded bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800 hover:text-emerald-300">+10</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden max-w-3xl">
          {sortedStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No students available for the leaderboard.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800">
                  <th className="p-4 text-slate-400 font-medium w-16 text-center">Rank</th>
                  <th className="p-4 text-slate-400 font-medium">Student Name</th>
                  <th className="p-4 text-slate-400 font-medium text-right w-32">Points</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student, idx) => (
                  <tr key={student.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20">
                    <td className="p-4 text-center">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 font-bold">1</span>
                      ) : idx === 1 ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-300/20 text-slate-300 font-bold">2</span>
                      ) : idx === 2 ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-600/20 text-amber-500 font-bold">3</span>
                      ) : (
                        <span className="text-slate-500 font-mono">{idx + 1}</span>
                      )}
                    </td>
                    <td className="p-4 font-medium text-white">{student.name}</td>
                    <td className="p-4 text-right font-mono text-yellow-400 font-bold">{student.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'activity_log' && (
        <div className="space-y-6">
          {isTableMissing ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-white mb-2">
                    Initialize Classroom Timeline & Logs
                  </h3>
                  <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                    To track points history, customize rewards/behaviors, and unlock the <strong>Undo/Redo</strong> capabilities, you need to execute a database migration inside your Supabase dashboard.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <h4 className="text-sm font-semibold text-slate-300">How to Setup:</h4>
                <ol className="list-decimal list-inside text-slate-400 space-y-2">
                  <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Supabase Dashboard</a>.</li>
                  <li>Select your project, then open the <strong>SQL Editor</strong> in the left sidebar.</li>
                  <li>Click <strong>New Query</strong>, paste the SQL schema below, and click <strong>Run</strong>.</li>
                  <li>Return here and click <button onClick={loadLogs} className="text-indigo-400 hover:underline font-semibold cursor-pointer">Sync Logs</button> to unlock the timeline!</li>
                </ol>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-mono">SUPABASE MIGRATION SQL</span>
                  <button
                    onClick={() => {
                      const sqlBlock = `CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  points_delta integer DEFAULT 0,
  lives_delta integer DEFAULT 0,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  undone boolean DEFAULT false,
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow teachers to select activity logs for owned classes" ON public.activity_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

CREATE POLICY "Allow students to select their own logs" ON public.activity_logs
  FOR SELECT TO anon USING (
    student_id IS NOT NULL
  );

CREATE POLICY "Allow teachers to insert activity logs for owned classes" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

CREATE POLICY "Allow teachers to update activity logs for owned classes" ON public.activity_logs
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

alter publication supabase_realtime add table public.activity_logs;`;
                      navigator.clipboard.writeText(sqlBlock);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer"
                  >
                    {copiedSql ? 'Copied!' : 'Copy SQL Script'}
                  </button>
                </div>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 font-mono overflow-x-auto max-h-60 leading-relaxed scrollbar-thin">
                  {`CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  points_delta integer DEFAULT 0,
  lives_delta integer DEFAULT 0,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  undone boolean DEFAULT false,
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow teachers to select activity logs for owned classes" ON public.activity_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

CREATE POLICY "Allow students to select their own logs" ON public.activity_logs
  FOR SELECT TO anon USING (
    student_id IS NOT NULL
  );

CREATE POLICY "Allow teachers to insert activity logs for owned classes" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

CREATE POLICY "Allow teachers to update activity logs for owned classes" ON public.activity_logs
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

alter publication supabase_realtime add table public.activity_logs;`}
                </pre>
              </div>
            </div>
          ) : (
            <>
              {/* Filtering */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex gap-4 flex-wrap items-center">
                  <div className="flex gap-1.5 flex-wrap">
                    {(['all', 'points', 'lives', 'system'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setLogFilter(filter)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize cursor-pointer ${
                          logFilter === filter
                            ? 'bg-indigo-600 text-white shadow'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {filter === 'all' ? 'All Activities' : filter === 'system' ? 'Roster / Class' : `${filter} changes`}
                      </button>
                    ))}
                  </div>

                  {activeMeeting && (
                    <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-850">
                      <button
                        onClick={() => setTimelineMeetingFilter('all')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                          timelineMeetingFilter === 'all'
                            ? 'bg-slate-800 text-white font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        All History
                      </button>
                      <button
                        onClick={() => setTimelineMeetingFilter('current')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                          timelineMeetingFilter === 'current'
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Current Session
                      </button>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={loadLogs}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 cursor-pointer"
                >
                  <RefreshCw size={12} className={isLogsLoading ? 'animate-spin' : ''} />
                  Sync Logs
                </button>
              </div>

              {/* Activity Logs Timeline */}
              {isLogsLoading && activityLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-medium">Loading classroom timeline...</div>
              ) : (
                (() => {
                  const filtered = activityLogs.filter((log) => {
                    if (timelineMeetingFilter === 'current') {
                      if (!activeMeeting) return false;
                      if (log.meeting_id !== activeMeeting.id) return false;
                    }

                    if (logFilter === 'all') return true;
                    if (logFilter === 'points') return log.action_type === 'points_changed';
                    if (logFilter === 'lives') return log.action_type === 'lives_changed';
                    if (logFilter === 'system') {
                      return [
                        'class_created',
                        'class_claimed',
                        'class_updated',
                        'join_code_regenerated',
                        'student_added',
                        'student_updated',
                        'student_deleted',
                        'student_pin_reset',
                        'meeting_started',
                        'meeting_ended'
                      ].includes(log.action_type);
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
                        No matching activity logs found.
                      </div>
                    );
                  }

                  const handleUndo = async (logId: string) => {
                    if (!confirm('Are you sure you want to undo this action? This will reverse the score/lives change.')) return;
                    try {
                      await db.undoActivityLog(logId);
                      await loadLogs();
                    } catch (err: any) {
                      alert(err.message || 'Failed to undo action.');
                    }
                  };

                  return (
                    <div className="space-y-3 max-w-3xl">
                      {filtered.map((log) => {
                        const isPoints = log.action_type === 'points_changed';
                        const isLives = log.action_type === 'lives_changed';
                        const isUndoable = (isPoints || isLives) && !log.undone;
                        const isCurrentSessionLog = activeMeeting && log.meeting_id === activeMeeting.id;

                        // Formulate nice human-readable message
                        let title = '';
                        let details = '';
                        let badgeColor = 'bg-slate-800 text-slate-400';

                        if (log.action_type === 'points_changed') {
                           const delta = log.points_delta || 0;
                           const sign = delta > 0 ? '+' : '';
                           title = `${sign}${delta} points`;
                           details = `awarded to ${log.studentName || 'Student'}`;
                           badgeColor = delta > 0 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20';
                        } else if (log.action_type === 'lives_changed') {
                           const delta = log.lives_delta || 0;
                           const sign = delta > 0 ? '+' : '';
                           title = `${sign}${delta} lives`;
                           details = `for ${log.studentName || 'Student'}`;
                           badgeColor = delta > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20';
                        } else if (log.action_type === 'class_created') {
                           title = 'Class Created';
                           details = `"${log.metadata?.name || 'Class'}" initialized`;
                           badgeColor = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                        } else if (log.action_type === 'class_claimed') {
                           title = 'Class Claimed';
                           details = `Linked securely to teacher account`;
                           badgeColor = 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
                        } else if (log.action_type === 'class_updated') {
                           title = 'Class Edited';
                           details = `Max Lives: ${log.metadata?.max_lives || 'N/A'}`;
                           badgeColor = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
                        } else if (log.action_type === 'join_code_regenerated') {
                           title = 'Join Code Reset';
                           details = `New code: ${log.metadata?.new_code || 'N/A'}`;
                           badgeColor = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
                        } else if (log.action_type === 'student_added') {
                           title = 'Student Registered';
                           details = `"${log.metadata?.student_name || 'Student'}" joined the roster`;
                           badgeColor = 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
                        } else if (log.action_type === 'student_updated') {
                           title = 'Student Profile Edited';
                           details = `"${log.metadata?.name || 'Student'}" updated`;
                           badgeColor = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
                        } else if (log.action_type === 'student_deleted') {
                           title = 'Student Removed';
                           details = `"${log.metadata?.student_name || 'Student'}" removed`;
                           badgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                        } else if (log.action_type === 'student_pin_reset') {
                           title = 'Student PIN Reset';
                           details = `New credentials generated`;
                           badgeColor = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
                        } else if (log.action_type === 'meeting_started') {
                           title = 'New Session Started';
                           details = `All student lives restored to ${log.metadata?.reset_lives_to || classData.maxLives}`;
                           badgeColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                        } else if (log.action_type === 'meeting_ended') {
                           title = 'Session Ended';
                           details = `Duration: ${log.metadata?.duration || 'N/A'}. Point changes: ${log.metadata?.total_points || 0}. Lives lost: ${log.metadata?.lives_lost || 0}.`;
                           badgeColor = 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
                        } else if (log.action_type === 'action_undone') {
                           title = 'Action Undone';
                           details = log.reason || '';
                           badgeColor = 'bg-slate-850 text-slate-400 border border-slate-800';
                        }

                        return (
                          <div
                            key={log.id}
                            className={`bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between gap-4 transition-all ${
                              log.undone ? 'opacity-40 select-none' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col gap-1.5 items-start">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider shrink-0 border ${badgeColor}`}>
                                    {title}
                                  </span>
                                  {isCurrentSessionLog && (
                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                      Current Session
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <p className={`text-sm font-medium text-slate-200 ${log.undone ? 'line-through' : ''}`}>
                                    {details}
                                    {log.reason && (
                                      <span className="text-slate-400 block text-xs mt-1 font-sans italic line-through-none">
                                        Reason: "{log.reason}"
                                      </span>
                                    )}
                                  </p>
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    {new Date(log.created_at).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {isUndoable && (
                              <button
                                onClick={() => handleUndo(log.id)}
                                className="text-xs bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-red-400 text-slate-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-semibold shadow cursor-pointer shrink-0"
                              >
                                <Undo2 size={12} />
                                Undo
                              </button>
                            )}

                            {log.undone && (
                              <span className="text-xs bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-1 rounded-lg font-bold font-mono tracking-wide shrink-0">
                                UNDONE
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'meetings' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Meeting History</h2>
              <p className="text-sm text-slate-400">Review class sessions, summaries, and performance metrics.</p>
            </div>
          </div>

          {classData.meetings.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
              No meetings recorded for this class yet.
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl">
              {classData.meetings.map((meeting) => {
                const isActive = meeting.status === 'active';
                const startedTime = new Date(meeting.startedAt).toLocaleString();
                const endedTime = meeting.endedAt ? new Date(meeting.endedAt).toLocaleString() : 'Active Now';

                return (
                  <div
                    key={meeting.id}
                    className={`bg-slate-900 border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                      isActive ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)] bg-slate-900/90' : 'border-slate-800'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        {isActive ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active Session
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-850 text-slate-400 border border-slate-800">
                            Ended Session
                          </span>
                        )}
                        <span className="text-xs text-slate-500 font-mono">
                          Lives Reset Target: {meeting.resetLivesTo}
                        </span>
                      </div>

                      <div className="text-sm text-slate-300 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 text-xs w-14">Started:</span>
                          <span className="font-medium text-slate-200">{startedTime}</span>
                        </div>
                        {!isActive && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-xs w-14">Ended:</span>
                            <span className="font-medium text-slate-200">{endedTime}</span>
                          </div>
                        )}
                      </div>

                      {meeting.summary && (
                        <div className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-850 max-w-md">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-sans">
                            <div>Duration: <span className="font-semibold text-slate-300">{meeting.summary.duration}</span></div>
                            <div>Total Actions: <span className="font-semibold text-slate-300">{meeting.summary.total_actions}</span></div>
                            <div>Point Changes: <span className="font-semibold text-slate-300">{meeting.summary.total_point_changes}</span></div>
                            <div>Lives Lost: <span className="font-semibold text-slate-300 text-red-400">{meeting.summary.total_lives_lost}</span></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {isActive ? (
                        <button
                          onClick={() => setIsEndMeetingModalOpen(true)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          End Class Meeting
                        </button>
                      ) : meeting.summary ? (
                        <button
                          onClick={() => setSelectedMeetingForSummary(meeting)}
                          className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          View Summary Report
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No summary generated</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-display font-bold text-white mb-6">Class Settings</h2>
          <form onSubmit={handleSaveClass} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Class Name</label>
              <input
                type="text"
                required
                value={editClassName}
                onChange={(e) => setEditClassName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Level / Grade</label>
              <input
                type="text"
                value={editClassLevel}
                onChange={(e) => setEditClassLevel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Max Lives (1-20)</label>
              <input
                type="number"
                min="1"
                max="20"
                required
                value={editClassMaxLives}
                onChange={(e) => setEditClassMaxLives(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">If reduced, students above the new max will be capped.</p>
            </div>
            
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this class?\nStudents, points, and history will be removed. This cannot be undone.')) {
                    onDeleteClass();
                  }
                }}
                className="text-red-500 hover:text-red-400 font-medium flex items-center gap-2 px-3 py-2 rounded hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={18} /> Delete Class
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Start Meeting Modal */}
      {isMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-2xl font-display font-bold text-white mb-2">Start a new meeting?</h3>
            <p className="text-slate-300 mb-6 leading-relaxed">
              All student lives will reset to the class maximum.<br />
              Student points will stay the same.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsMeetingModalOpen(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onStartMeeting();
                  setIsMeetingModalOpen(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Play size={18} className="fill-current" /> Start Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-display font-bold text-white">Edit Student</h3>
              <button onClick={() => setEditingStudentId(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              onEditStudent(editingStudentId, editStudentName, editStudentNickname);
              setEditingStudentId(null);
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nickname (Optional)</label>
                <input
                  type="text"
                  value={editStudentNickname}
                  onChange={(e) => setEditStudentNickname(e.target.value)}
                  placeholder="Shown in roster"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 mt-2 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Save Changes
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const student = classData.students.find(s => s.id === editingStudentId);
                      if (student) {
                        navigator.clipboard.writeText(`Class Code: ${classData.joinCode}\nStudent: ${student.name}\nPIN: ${student.pin}`);
                        alert('Login info copied!');
                      }
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Copy size={14} /> Copy Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Regenerate PIN for this student?')) {
                        onRegenerateStudentPin(editingStudentId);
                      }
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw size={14} /> Reset PIN
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this student?\nLives and points will be lost.')) {
                      onDeleteStudent(editingStudentId);
                      setEditingStudentId(null);
                    }
                  }}
                  className="w-full border border-red-500/30 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Remove Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Meeting Confirmation Modal */}
      {isEndMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-500/20 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <AlertTriangle size={28} />
              <h3 className="text-2xl font-display font-bold text-white">End class meeting?</h3>
            </div>
            <p className="text-slate-300 mb-6 leading-relaxed text-sm">
              This will close the active meeting and generate a comprehensive session summary report.
            </p>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2 mb-6">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                <span>Student current points will remain unchanged.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                <span>Student current lives will not reset.</span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsEndMeetingModalOpen(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEndMeeting}
                className="bg-red-650 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                End Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Summary Detail Modal */}
      {selectedMeetingForSummary && selectedMeetingForSummary.summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
              <div>
                <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                  <Trophy className="text-yellow-500" size={20} />
                  Session Summary Report
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Session ID: {selectedMeetingForSummary.id.substring(0, 8)}...
                </p>
              </div>
              <button
                onClick={() => setSelectedMeetingForSummary(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 text-sm">
              {/* Timing info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block uppercase">Started At</span>
                  <span className="text-slate-200 font-medium">
                    {new Date(selectedMeetingForSummary.summary.started_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block uppercase">Ended At</span>
                  <span className="text-slate-200 font-medium">
                    {new Date(selectedMeetingForSummary.summary.ended_at).toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2 border-t border-slate-800/60 pt-2 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Total Duration:</span>
                  <span className="font-bold text-emerald-400">{selectedMeetingForSummary.summary.duration}</span>
                </div>
              </div>

              {/* Stats overview */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Key Stats Overview</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
                    <span className="text-2xl font-black text-slate-100 block">
                      {selectedMeetingForSummary.summary.total_actions}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase">Total Actions Logged</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
                    <span className="text-2xl font-black text-yellow-500 block">
                      {selectedMeetingForSummary.summary.total_point_changes >= 0 ? '+' : ''}
                      {selectedMeetingForSummary.summary.total_point_changes}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Points Awarded</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center col-span-2">
                    <div className="flex justify-around items-center h-full">
                      <div>
                        <span className="text-lg font-bold text-red-500 block">
                          -{selectedMeetingForSummary.summary.total_lives_lost}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono uppercase">Lives Lost</span>
                      </div>
                      <div className="h-6 w-px bg-slate-800" />
                      <div>
                        <span className="text-lg font-bold text-emerald-400 block">
                          +{selectedMeetingForSummary.summary.total_lives_gained}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono uppercase">Lives Recovered</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance / Leaders */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performance Metrics</h4>
                
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-850/80">
                    <span className="text-xs text-slate-400 font-medium">Most Active Student</span>
                    <span className="font-bold text-indigo-400 text-sm">
                      {selectedMeetingForSummary.summary.most_active_student}
                    </span>
                  </div>

                  {selectedMeetingForSummary.summary.top_gainers && selectedMeetingForSummary.summary.top_gainers.length > 0 && (
                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850/80 space-y-2">
                      <span className="text-xs text-slate-400 font-medium block">Top Point Gainers</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedMeetingForSummary.summary.top_gainers.map((gainer: string, idx: number) => (
                          <span key={idx} className="bg-yellow-500/10 text-yellow-500 text-xs px-2.5 py-1 rounded-lg border border-yellow-500/20 font-medium">
                            {gainer}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedMeetingForSummary.summary.lost_lives_students && selectedMeetingForSummary.summary.lost_lives_students.length > 0 && (
                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850/80 space-y-2">
                      <span className="text-xs text-slate-400 font-medium block">Classroom Incidents (Lives Lost)</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedMeetingForSummary.summary.lost_lives_students.map((incident: string, idx: number) => (
                          <span key={idx} className="bg-red-500/10 text-red-400 text-xs px-2.5 py-1 rounded-lg border border-red-500/20 font-medium">
                            {incident}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-850 pt-4 flex justify-end">
              <button
                onClick={() => setSelectedMeetingForSummary(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all text-sm cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
