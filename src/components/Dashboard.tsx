import React, { useState } from 'react';
import { ClassData } from '../types';
import { Users, Plus, Star, Shield, Trash2, Rocket, Loader2, Download } from 'lucide-react';

interface DashboardProps {
  classes: ClassData[];
  isLoading: boolean;
  error: string | null;
  onAddClass: (name: string, level: string, maxLives: number) => void;
  onDeleteClass: (id: string) => void;
  onSelectClass: (id: string) => void;
  onImportLocalData: () => void;
  onClaimClass: (id: string) => void;
  teacherEmail?: string | null;
  onLogout: () => void;
}

export function Dashboard({
  classes,
  isLoading,
  error,
  onAddClass,
  onDeleteClass,
  onSelectClass,
  onImportLocalData,
  onClaimClass,
  teacherEmail,
  onLogout
}: DashboardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState('');
  const [newClassMaxLives, setNewClassMaxLives] = useState(5);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    onAddClass(newClassName.trim(), newClassLevel.trim() || 'General', newClassMaxLives);
    setNewClassName('');
    setNewClassLevel('');
    setNewClassMaxLives(5);
    setIsAdding(false);
  };

  const hasLocalData = () => {
    try {
      return !!window.localStorage.getItem('mission_control_classes');
    } catch {
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-400">Loading your command center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <Rocket className="text-blue-500" size={32} />
            Mission Control
          </h1>
          <p className="text-slate-400 mt-1">Classroom gamification dashboard</p>
          {teacherEmail && (
            <p className="text-sm text-blue-400 font-mono mt-1.5">Logged in as: {teacherEmail}</p>
          )}
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          {teacherEmail && (
            <button
              onClick={onLogout}
              className="bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-850"
            >
              Log Out
            </button>
          )}
          {hasLocalData() && classes.length === 0 && (
            <button
              onClick={() => {
                if (confirm('Import local data to Supabase? This may take a moment.')) {
                  onImportLocalData();
                }
              }}
              className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Download size={20} />
              Import Local Data
            </button>
          )}
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Create New Class
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-8">
          <h3 className="font-bold mb-1">Connection Error</h3>
          <p>{error}</p>
        </div>
      )}

      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl mb-8 text-sm flex gap-3 items-start">
        <Shield size={20} className="shrink-0 mt-0.5" />
        <div>
          <strong className="block mb-1">Phase 5 - Security Active</strong>
          Teacher login is active. Student access still uses Class Code + PIN. Full student account security may be added later.
        </div>
      </div>

      {isAdding && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl mb-8 shadow-xl">
          <h2 className="text-xl font-display font-semibold mb-4 text-white">Initialize New Class</h2>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Class Name</label>
              <input
                type="text"
                required
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g. Science 101"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Level / Grade</label>
              <input
                type="text"
                value={newClassLevel}
                onChange={(e) => setNewClassLevel(e.target.value)}
                placeholder="e.g. Grade 5"
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
                value={newClassMaxLives}
                onChange={(e) => setNewClassMaxLives(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-2xl border-dashed">
          <Rocket className="mx-auto h-12 w-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-300">No classes found</h3>
          <p className="text-slate-500 mt-1 mb-6">Get started by initializing a new classroom environment.</p>
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              <Plus size={18} /> Create First Class
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelectClass(c.id)}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-blue-500/50 hover:bg-slate-800/50 transition-all cursor-pointer group flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4 gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-display font-bold text-white group-hover:text-blue-400 transition-colors">
                      {c.name}
                    </h3>
                    {!c.teacherId && (
                      <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 text-xs px-2 py-0.5 rounded-full font-mono font-medium">
                        Unowned
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mt-1">{c.level}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!c.teacherId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Claim "${c.name}" as your class? This will link it securely to your teacher account.`)) {
                          onClaimClass(c.id);
                        }
                      }}
                      className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 text-xs px-2 py-1 rounded-lg transition-all font-semibold"
                    >
                      Claim
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this class?\nStudents, points, and history will be removed. This cannot be undone.')) {
                        onDeleteClass(c.id);
                      }
                    }}
                    className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-4 pt-6 border-t border-slate-800">
                <div className="flex items-center gap-2 text-slate-300">
                  <Users size={16} className="text-blue-400" />
                  <span className="font-medium">{c.students.length}</span> Students
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Shield size={16} className="text-emerald-400" />
                  <span className="font-medium">{c.maxLives}</span> Max Lives
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
