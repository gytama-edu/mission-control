import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Heart,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Star,
  Trophy
} from 'lucide-react';
import {
  beginGuardianSession,
  clearGuardianSession,
  endGuardianSession,
  fetchGuardianDashboard,
  GuardianDashboardData,
  GuardianPortalError,
  GuardianSession,
  GuardianTask,
  readGuardianSession,
  saveGuardianSession
} from '../services/guardianPortalData';

interface GuardianAccessProps {
  onBack: () => void;
}

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatGuardianCodeInput = (value: string): string => {
  const normalized = value
    .toUpperCase()
    .replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '')
    .slice(0, 20);

  const groups = [
    normalized.slice(0, 8),
    normalized.slice(8, 12),
    normalized.slice(12, 16),
    normalized.slice(16, 20)
  ].filter(Boolean);

  return groups.join('-');
};

const getTaskStatusPresentation = (status: string): { label: string; className: string } => {
  switch (status) {
    case 'reviewed':
      return {
        label: 'Reviewed',
        className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      };
    case 'returned':
      return {
        label: 'Needs revision',
        className: 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      };
    case 'submitted':
      return {
        label: 'Submitted',
        className: 'border-sky-500/30 bg-sky-500/10 text-sky-300'
      };
    case 'late':
      return {
        label: 'Submitted late',
        className: 'border-orange-500/30 bg-orange-500/10 text-orange-300'
      };
    case 'closed':
      return {
        label: 'Closed',
        className: 'border-slate-600 bg-slate-800 text-slate-300'
      };
    case 'not_submitted':
      return {
        label: 'Not submitted',
        className: 'border-slate-700 bg-slate-900 text-slate-400'
      };
    default:
      return {
        label: status.replace(/_/g, ' '),
        className: 'border-slate-700 bg-slate-900 text-slate-300'
      };
  }
};

const getTaskTimingLabel = (task: GuardianTask): string | null => {
  if (task.reviewedAt) return `Reviewed ${formatDateTime(task.reviewedAt)}`;
  if (task.submittedAt) return `Submitted ${formatDateTime(task.submittedAt)}`;
  if (task.dueAt) return `Due ${formatDate(task.dueAt)}`;
  return null;
};

const getFriendlyError = (error: unknown): string => {
  if (error instanceof GuardianPortalError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong while loading Guardian access.';
};

export function GuardianAccess({ onBack }: GuardianAccessProps) {
  const [initialSession] = useState<GuardianSession | null>(() => readGuardianSession());
  const [session, setSession] = useState<GuardianSession | null>(initialSession);
  const [dashboard, setDashboard] = useState<GuardianDashboardData | null>(null);
  const [classCode, setClassCode] = useState('');
  const [guardianCode, setGuardianCode] = useState('');
  const [error, setError] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(initialSession));
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const invalidateSession = useCallback(() => {
    clearGuardianSession();
    setSession(null);
    setDashboard(null);
  }, []);

  const loadDashboard = useCallback(async (
    activeSession: GuardianSession,
    quiet = false
  ): Promise<void> => {
    if (quiet) {
      setIsRefreshing(true);
    } else {
      setIsBootstrapping(true);
    }

    try {
      const nextDashboard = await fetchGuardianDashboard(activeSession.sessionToken);
      setDashboard(nextDashboard);
      setError('');
    } catch (loadError) {
      if (loadError instanceof GuardianPortalError && loadError.code === 'invalid_session') {
        invalidateSession();
      }
      setError(getFriendlyError(loadError));
    } finally {
      setIsBootstrapping(false);
      setIsRefreshing(false);
    }
  }, [invalidateSession]);

  useEffect(() => {
    if (initialSession) {
      void loadDashboard(initialSession);
    } else {
      setIsBootstrapping(false);
    }
  }, [initialSession, loadDashboard]);

  useEffect(() => {
    if (!session || !dashboard) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadDashboard(session, true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [dashboard, loadDashboard, session]);

  const studentLabel = useMemo(() => {
    if (!dashboard) return '';
    return dashboard.student.nickname || dashboard.student.displayName;
  }, [dashboard]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!classCode.trim() || guardianCode.replace(/-/g, '').length !== 20) {
      setError('Enter the class code and the complete 20-character Guardian code.');
      return;
    }

    setIsSigningIn(true);
    setError('');

    try {
      const nextSession = await beginGuardianSession(classCode, guardianCode);
      saveGuardianSession(nextSession);
      setSession(nextSession);
      await loadDashboard(nextSession);
      setGuardianCode('');
    } catch (signInError) {
      setError(getFriendlyError(signInError));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    const token = session?.sessionToken;
    invalidateSession();
    setClassCode('');
    setGuardianCode('');
    setError('');

    if (token) {
      await endGuardianSession(token);
    }
  };

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
            <Loader2 size={30} className="animate-spin" />
          </div>
          <h1 className="text-xl font-bold text-white">Opening Guardian Portal</h1>
          <p className="mt-2 text-sm text-slate-400">Loading the latest read-only progress view...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-md">
          <button onClick={onBack} className="mc-back-link mb-8">
            <ArrowLeft size={14} className="mc-back-icon" />
            Back to Main Menu
          </button>

          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-sky-950/20">
            <div className="border-b border-slate-800 p-6 sm:p-8">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
                <ShieldCheck size={28} />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">Secure read-only access</p>
              <h1 className="mt-2 text-3xl font-display font-bold text-white">Guardian Portal</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                View one student’s progress, teacher feedback, tasks, and learning milestones. Guardian access cannot edit classroom data.
              </p>
            </div>

            <form onSubmit={handleSignIn} className="space-y-5 p-6 sm:p-8">
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">Class Code</span>
                <input
                  value={classCode}
                  onChange={(event) => setClassCode(event.target.value.toUpperCase().slice(0, 64))}
                  autoComplete="off"
                  inputMode="text"
                  placeholder="Enter class code"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-base uppercase tracking-wider text-white outline-none transition-colors placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">Guardian Code</span>
                <input
                  value={guardianCode}
                  onChange={(event) => setGuardianCode(formatGuardianCodeInput(event.target.value))}
                  autoComplete="one-time-code"
                  inputMode="text"
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm uppercase tracking-wider text-white outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 sm:text-base"
                />
              </label>

              <button
                type="submit"
                disabled={isSigningIn}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningIn ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                {isSigningIn ? 'Signing in securely...' : 'Open Progress Dashboard'}
              </button>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs leading-relaxed text-slate-500">
                Your teacher provides both codes. This session stays only in the current browser tab and expires automatically.
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
          <AlertCircle className="mx-auto text-amber-300" size={36} />
          <h1 className="mt-4 text-xl font-bold text-white">Progress could not be loaded</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{error || 'Please retry the secure dashboard request.'}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => void loadDashboard(session)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-500"
            >
              <RefreshCw size={16} /> Retry
            </button>
            <button
              onClick={() => void handleLogout()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"
            >
              <LogOut size={16} /> Sign in again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPointsMode = dashboard.class.displayMode === 'points';
  const progressMetric = isPointsMode ? dashboard.student.points : dashboard.student.lives;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button onClick={onBack} className="mc-back-link">
            <ArrowLeft size={14} className="mc-back-icon" />
            Main Menu
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadDashboard(session, true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
            >
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <header className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl">
          <div className="relative p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_45%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-300">
                  <ShieldCheck size={14} /> Read-only Guardian View
                </div>
                <p className="text-sm font-medium text-slate-400">{dashboard.class.name}</p>
                <h1 className="mt-1 text-3xl font-display font-bold text-white sm:text-4xl">{studentLabel}</h1>
                {dashboard.student.nickname && (
                  <p className="mt-1 text-sm text-slate-500">Student name: {dashboard.student.displayName}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                  {dashboard.class.level && (
                    <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">{dashboard.class.level}</span>
                  )}
                  <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 capitalize">
                    {dashboard.class.category} class
                  </span>
                </div>
              </div>

              <div className="min-w-48 rounded-2xl border border-sky-500/20 bg-slate-950/70 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                  {isPointsMode ? <Trophy size={17} className="text-amber-300" /> : <Heart size={17} className="text-rose-300" />}
                  {isPointsMode ? 'Current Points' : 'Current Lives'}
                </div>
                <div className="mt-2 text-4xl font-display font-bold text-white">{progressMetric ?? 0}</div>
                <p className="mt-2 text-xs text-slate-500">No rank or class leaderboard is shown.</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
          <main className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sky-300">
                    <BookOpenCheck size={20} />
                    <h2 className="text-lg font-bold text-white">Tasks & Feedback</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Published classroom work for this student only.</p>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-bold text-slate-300">
                  {dashboard.tasks.length}
                </span>
              </div>

              {dashboard.tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-sm text-slate-500">
                  No published tasks are available right now.
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboard.tasks.map((task, index) => {
                    const status = getTaskStatusPresentation(task.status);
                    const timingLabel = getTaskTimingLabel(task);

                    return (
                      <article key={`${task.title}-${task.dueAt || index}`} className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-white">{task.title}</h3>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${status.className}`}>
                                {status.label}
                              </span>
                            </div>
                            <p className="mt-1 text-xs capitalize text-slate-500">{task.taskType} task</p>
                          </div>

                          {typeof task.awardedPoints === 'number' && (
                            <div className="shrink-0 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center">
                              <div className="text-lg font-bold text-amber-200">+{task.awardedPoints}</div>
                              <div className="text-[10px] uppercase tracking-wider text-amber-400/70">Awarded</div>
                            </div>
                          )}
                        </div>

                        {task.description && (
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{task.description}</p>
                        )}

                        {timingLabel && (
                          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                            <Clock3 size={14} /> {timingLabel}
                          </div>
                        )}

                        {task.teacherFeedback && (
                          <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
                            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                              <MessageSquareText size={15} /> Teacher Feedback
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{task.teacherFeedback}</p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </main>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Trophy size={19} className="text-amber-300" />
                <h2 className="font-bold text-white">Badges</h2>
              </div>

              {dashboard.badges.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-center text-sm text-slate-500">
                  No badges have been awarded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {dashboard.badges.map((badge, index) => (
                    <div key={`${badge.name}-${badge.awardedAt}-${index}`} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-xl text-amber-200">
                        {badge.icon || <Star size={18} />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white">{badge.name}</h3>
                        {badge.description && <p className="mt-1 text-xs leading-relaxed text-slate-400">{badge.description}</p>}
                        <p className="mt-2 text-[11px] text-slate-600">Awarded {formatDate(badge.awardedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle2 size={19} className="text-emerald-300" />
                <h2 className="font-bold text-white">Recent Progress</h2>
              </div>

              {dashboard.recentProgress.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-center text-sm text-slate-500">
                  No recent progress updates are available.
                </p>
              ) : (
                <div className="space-y-1">
                  {dashboard.recentProgress.map((item, index) => {
                    const delta = isPointsMode ? item.pointsDelta : item.livesDelta;
                    return (
                      <div key={`${item.occurredAt}-${item.label}-${index}`} className="flex gap-3 border-b border-slate-800/70 py-3 last:border-0">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-200">{item.label}</p>
                            {typeof delta === 'number' && delta !== 0 && (
                              <span className={`shrink-0 font-mono text-xs font-bold ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-600">{formatDateTime(item.occurredAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck size={19} className="mt-0.5 shrink-0 text-sky-300" />
                <div>
                  <h2 className="font-bold text-white">Privacy boundary</h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    This portal is limited to one student. It does not show classmates, rankings, student PINs, submission text, attachments, private teacher notes, or AI review information.
                  </p>
                  <p className="mt-3 text-[11px] text-slate-600">Session expires {formatDateTime(dashboard.access.expiresAt)}.</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
