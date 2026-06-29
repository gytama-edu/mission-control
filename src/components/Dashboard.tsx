import React, { useState } from 'react';
import { ClassData } from '../types';
import { Users, Plus, Star, Shield, Trash2, Rocket, Loader2, Download, Activity, Radio, LayoutGrid, KeyRound, Heart, Archive, ArchiveRestore } from 'lucide-react';
import { ConfirmActionModal } from './ConfirmActionModal';

interface DashboardProps {
  classes: ClassData[];
  isLoading: boolean;
  error: string | null;
  onAddClass: (name: string, level: string, maxLives: number) => void;
  onArchiveClass: (id: string) => void;
  onRestoreClass: (id: string) => void;
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
  onArchiveClass,
  onRestoreClass,
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
  const [showArchived, setShowArchived] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    helperNote?: string;
    confirmLabel?: string;
    variant?: 'default' | 'warning' | 'danger';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const closeConfirmModal = () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));

  const handleArchiveClick = (e: React.MouseEvent, c: ClassData) => {
    e.stopPropagation();
    setConfirmModalConfig({
      isOpen: true,
      title: 'Archive this class?',
      message: 'This will hide the class from your active dashboard. Student records, tasks, submissions, badges, reports, and uploaded files will be preserved.',
      helperNote: 'You can restore archived classes later.',
      confirmLabel: 'Archive Class',
      variant: 'warning',
      onConfirm: () => onArchiveClass(c.id)
    });
  };

  const handleRestoreClick = (e: React.MouseEvent, c: ClassData) => {
    e.stopPropagation();
    setConfirmModalConfig({
      isOpen: true,
      title: 'Restore this class?',
      message: 'This will move the class back to your active dashboard.',
      helperNote: 'Students will be able to access the class again after it is restored.',
      confirmLabel: 'Restore Class',
      variant: 'default',
      onConfirm: () => onRestoreClass(c.id)
    });
  };

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

  const activeClasses = classes.filter(c => !c.isArchived);
  const archivedClasses = classes.filter(c => c.isArchived);

  const totalClasses = activeClasses.length;
  const totalStudents = activeClasses.reduce((sum, c) => sum + (c.students?.length || 0), 0);
  const activeSessions = activeClasses.reduce((sum, c) => sum + (c.meetings?.filter(m => m.status === 'active')?.length || 0), 0);
  const totalMissions = activeClasses.reduce((sum, c) => sum + (c.meetings?.length || 0), 0);

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md max-w-md w-full">
          <Loader2 className="mx-auto h-12 w-12 text-rose-500 animate-spin mb-4" />
          <h3 className="font-display font-semibold text-lg text-white mb-1">Accessing Dashboard</h3>
          <p className="text-slate-400 text-sm">Loading classroom data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-[calc(100vh-2rem)] justify-between">
      <div>
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-900/60 select-none">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-display font-black text-white tracking-tight flex items-center gap-2">
                <Rocket className="text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.3)]" size={22} />
                <span>Mission Control</span>
              </h1>
              <span className="text-slate-700 hidden sm:inline">&bull;</span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-900 px-2 py-0.5 rounded border border-slate-800">Presented by GYTama EDU</span>
            </div>
            {teacherEmail && (
              <p className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Logged in as: <strong className="text-slate-300 font-semibold">{teacherEmail}</strong>
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {teacherEmail && (
              <button
                onClick={onLogout}
                className="bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl font-mono uppercase tracking-wider text-[10px] font-bold border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
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
                className="bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-xl font-mono uppercase tracking-wider text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-800 hover:border-slate-700 cursor-pointer"
              >
                <Download size={13} />
                Import Data
              </button>
            )}
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl font-bold font-mono uppercase tracking-wider text-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/10 active:scale-[0.98] border border-rose-500/30"
            >
              <Plus size={14} />
              Create Class
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 flex items-start gap-3">
            <Shield size={20} className="shrink-0 mt-0.5 text-red-500" />
            <div>
              <h3 className="font-bold mb-1">Connection Error</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-rose-500/5 border border-rose-500/15 text-rose-400 px-4 py-3 rounded-xl mb-6 text-xs flex gap-2.5 items-start backdrop-blur-sm select-none">
          <Shield size={16} className="shrink-0 mt-0.5 text-rose-500/70" />
          <div>
            Teacher authentication is established. Students join their dedicated dashboards using the class code and their secure 4-digit PIN.
          </div>
        </div>

        {/* Compact Quick Stats */}
        <div className="flex flex-wrap items-center gap-3 mb-6 select-none">
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-xl px-3 py-1.5 flex items-center gap-2 transition-all hover:border-slate-700/60 shadow-md">
            <LayoutGrid size={13} className="text-rose-500/80" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Classes:</span>
            <strong className="text-white font-mono font-bold text-xs">{totalClasses}</strong>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-xl px-3 py-1.5 flex items-center gap-2 transition-all hover:border-slate-700/60 shadow-md">
            <Users size={13} className="text-cyan-400/80" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Students:</span>
            <strong className="text-white font-mono font-bold text-xs">{totalStudents}</strong>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-xl px-3 py-1.5 flex items-center gap-2 transition-all hover:border-slate-700/60 shadow-md">
            <span className="relative flex h-2 w-2">
              {activeSessions > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${activeSessions > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            </span>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Active Meetings:</span>
            <strong className={`font-mono font-bold text-xs ${activeSessions > 0 ? 'text-emerald-400' : 'text-white'}`}>{activeSessions}</strong>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-xl px-3 py-1.5 flex items-center gap-2 transition-all hover:border-slate-700/60 shadow-md">
            <Star size={13} className="text-amber-400/80" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Meetings Run:</span>
            <strong className="text-white font-mono font-bold text-xs">{totalMissions}</strong>
          </div>
        </div>

      {isAdding && (
        <div className="bg-slate-900/65 backdrop-blur-md border border-slate-800/80 p-5 rounded-2xl mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-600" />
          <h2 className="text-sm font-display font-bold mb-4 text-white flex items-center gap-2 select-none">
            <LayoutGrid size={16} className="text-rose-500" />
            Create New Class
          </h2>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Class Name</label>
              <input
                type="text"
                required
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g. English 7A"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/50 transition-all text-xs font-sans"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Level / Grade</label>
              <input
                type="text"
                value={newClassLevel}
                onChange={(e) => setNewClassLevel(e.target.value)}
                placeholder="e.g. Beginner or Grade 5"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/50 transition-all text-xs font-sans"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Max Lives (1-20)</label>
              <input
                type="number"
                min="1"
                max="20"
                required
                value={newClassMaxLives}
                onChange={(e) => setNewClassMaxLives(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/50 transition-all text-xs font-sans"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-2 rounded-xl font-mono uppercase tracking-wider text-[10px] border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white px-3 py-2 rounded-xl font-bold font-mono uppercase tracking-wider text-[10px] transition-all shadow-md shadow-rose-600/10 cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {activeClasses.length === 0 && !showArchived ? (
        <div className="text-center py-20 bg-slate-900/35 border border-dashed border-slate-800/80 rounded-2xl backdrop-blur-sm px-6 max-w-xl mx-auto my-12">
          <div className="relative inline-block mb-4">
            <Rocket className="h-12 w-12 text-slate-600 drop-shadow-[0_0_10px_rgba(244,63,94,0.1)]" />
          </div>
          <h3 className="text-xl font-display font-bold text-white mb-2">No Classes Found</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
            Ready to set up your classroom dashboard? Create a new class to begin tracking student performance, managing meetings, and awarding points.
          </p>
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-rose-600/15 inline-flex items-center gap-2 cursor-pointer text-sm"
            >
              <Plus size={18} /> Create First Class
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2 select-none border-b border-slate-900/60 pb-3">
            <div>
              <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <LayoutGrid size={14} className={showArchived ? "text-slate-500" : "text-rose-500"} />
                {showArchived ? 'Archived Classes' : 'Active Classes'}
              </h2>
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                {showArchived ? archivedClasses.length : totalClasses} {showArchived ? (archivedClasses.length === 1 ? 'Class' : 'Classes') : (totalClasses === 1 ? 'Class' : 'Classes')} {showArchived ? 'Archived' : 'Active'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showArchived 
                    ? 'bg-rose-600/10 border-rose-500/30 text-rose-400' 
                    : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {showArchived ? <LayoutGrid size={12} /> : <Archive size={12} />}
                {showArchived ? 'View Active' : 'View Archived'}
              </button>
            </div>
          </div>
          
          {showArchived && (
            <div className="bg-slate-900/40 border border-slate-800/80 text-slate-400 px-4 py-3 rounded-xl mb-4 text-xs flex gap-2.5 items-start backdrop-blur-sm select-none">
              <Archive size={16} className="shrink-0 mt-0.5 text-slate-500" />
              <div>
                Archived classes are hidden from the main dashboard but can be restored later. Student records, tasks, submissions, badges, reports, and uploaded files are preserved.
              </div>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/60 text-[10px] font-mono uppercase tracking-widest text-slate-500 select-none bg-slate-950/20">
                  <th className="py-2.5 px-4 font-semibold">Class Name</th>
                  <th className="py-2.5 px-4 font-semibold">Level / Grade</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Students</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Max Lives</th>
                  <th className="py-2.5 px-4 font-semibold">Class Code</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {(showArchived ? archivedClasses : activeClasses).map((c) => {
                  const hasActiveSession = c.meetings?.some((m) => m.status === 'active');
                  return (
                    <tr 
                      key={c.id} 
                      className="hover:bg-slate-900/40 transition-colors group cursor-pointer"
                      onClick={() => onSelectClass(c.id)}
                    >
                      <td className="py-3 px-4 font-display font-bold text-white text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectClass(c.id);
                          }}
                          className="hover:text-rose-400 transition-colors cursor-pointer text-left focus:outline-none"
                        >
                          {c.name}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs font-mono uppercase select-none">
                        {c.level}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300 text-xs font-mono font-bold select-none">
                        {c.students?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300 text-xs font-mono font-bold select-none">
                        {c.maxLives}
                      </td>
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <code className="text-xs font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-rose-400 tracking-wider">
                          {c.joinCode}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 select-none">
                          {hasActiveSession ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.12)]">
                              <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                              Live
                            </span>
                          ) : !c.teacherId ? (
                            <span className="inline-flex items-center bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full">
                              Unclaimed
                            </span>
                          ) : (
                            <span className="inline-flex items-center bg-slate-800/40 text-slate-400 border border-slate-800/40 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {!c.teacherId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Claim "${c.name}" as your class? This will link it securely to your teacher account.`)) {
                                  onClaimClass(c.id);
                                }
                              }}
                              className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 text-[9px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer"
                            >
                              Claim
                            </button>
                          )}
                          <button
                            onClick={() => onSelectClass(c.id)}
                            className="bg-slate-950 hover:bg-rose-600/10 border border-slate-800 hover:border-rose-500/30 text-slate-300 hover:text-rose-400 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer"
                          >
                            Open
                          </button>
                          <button
                            onClick={() => onSelectClass(c.id)}
                            className="bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-250 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer"
                          >
                            Reports
                          </button>
                          {!hasActiveSession && (
                            showArchived ? (
                              <button
                                onClick={(e) => handleRestoreClick(e, c)}
                                className="bg-slate-950 hover:bg-emerald-600/10 border border-slate-800 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer flex items-center gap-1"
                                title="Restore Class"
                              >
                                <ArchiveRestore size={12} />
                                Restore
                              </button>
                            ) : (
                              <button
                                onClick={(e) => handleArchiveClick(e, c)}
                                className="text-slate-500 hover:text-amber-500 p-1.5 rounded-lg hover:bg-amber-500/10 transition-colors cursor-pointer"
                                title="Archive Class"
                              >
                                <Archive size={13} />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Grid Card View (md:hidden) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {(showArchived ? archivedClasses : activeClasses).map((c) => {
              const hasActiveSession = c.meetings?.some((m) => m.status === 'active');
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectClass(c.id)}
                  className="relative bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 hover:border-rose-500/30 hover:bg-slate-900/80 transition-all duration-200 cursor-pointer group flex flex-col h-full shadow-md"
                >
                  {hasActiveSession && (
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.12)] select-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-2 gap-4">
                    <div className="min-w-0 pr-12">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base font-display font-bold text-white group-hover:text-rose-400 transition-colors truncate">
                          {c.name}
                        </h3>
                        {!c.teacherId && (
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wider">
                            Unclaimed
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[10px] mt-0.5 font-display">{c.level}</p>
                    </div>

                    {!hasActiveSession && (
                      <div className="flex items-center gap-1 shrink-0 z-10" onClick={(e) => e.stopPropagation()}>
                        {!c.teacherId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Claim "${c.name}" as your class? This will link it securely to your teacher account.`)) {
                                onClaimClass(c.id);
                              }
                            }}
                            className="bg-emerald-600/25 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md transition-all font-bold cursor-pointer"
                          >
                            Claim
                          </button>
                        )}
                        showArchived ? (
                          <button
                            onClick={(e) => handleRestoreClick(e, c)}
                            className="bg-slate-950 hover:bg-emerald-600/10 border border-slate-800 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md transition-all font-bold cursor-pointer"
                            title="Restore Class"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleArchiveClick(e, c)}
                            className="text-slate-500 hover:text-amber-500 p-1.5 rounded-md hover:bg-amber-500/10 transition-colors cursor-pointer"
                            title="Archive Class"
                          >
                            <Archive size={14} />
                          </button>
                        )
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 select-none">
                    <KeyRound size={11} className="text-slate-500" />
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Class Code:</span>
                    <code className="text-xs font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-rose-400 tracking-wider">
                      {c.joinCode}
                    </code>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4 border-t border-slate-800/60 select-none mt-3">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <Users size={12} className="text-rose-500/70" />
                      <span>
                        <strong className="text-white font-semibold font-mono">{c.students?.length || 0}</strong> Students
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <Heart size={12} className="text-rose-500/70" />
                      <span>
                        <strong className="text-white font-semibold font-mono">{c.maxLives}</strong> Max Lives
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>

      <footer className="w-full flex justify-center pt-12 select-none border-t border-slate-900/60 mt-12 pb-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <span>Mission Control</span>
          <span className="text-slate-700">&bull;</span>
          <span>Presented by GYTama EDU</span>
          <span className="text-slate-700">&bull;</span>
          <span className="text-slate-600">&copy; {new Date().getFullYear()}</span>
        </p>
      </footer>

      <ConfirmActionModal {...confirmModalConfig} onClose={closeConfirmModal} />
    </div>
  );
}
