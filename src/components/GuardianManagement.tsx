import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clipboard,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Users,
  X
} from 'lucide-react';
import { ClassData } from '../types';
import {
  createGuardianCredential,
  fetchGuardianCredentialStatuses,
  GuardianCredentialState,
  GuardianCredentialStatus,
  rotateGuardianCredential,
  setGuardianCredentialActive
} from '../services/guardianTeacherData';

interface GuardianManagementProps {
  classData: ClassData;
  onBack: () => void;
}

interface RevealedCode {
  studentId: string;
  studentName: string;
  guardianCode: string;
  action: 'created' | 'rotated';
}

const statePresentation: Record<GuardianCredentialState, { label: string; className: string }> = {
  not_configured: {
    label: 'Not configured',
    className: 'border-slate-700 bg-slate-800/70 text-slate-300'
  },
  active: {
    label: 'Active',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  },
  disabled: {
    label: 'Disabled',
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  },
  expired: {
    label: 'Expired',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  },
  locked: {
    label: 'Temporarily locked',
    className: 'border-orange-500/30 bg-orange-500/10 text-orange-300'
  }
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
};

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

export function GuardianManagement({ classData, onBack }: GuardianManagementProps) {
  const [statuses, setStatuses] = useState<GuardianCredentialStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionStudentId, setActionStudentId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [revealedCode, setRevealedCode] = useState<RevealedCode | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStatuses = useCallback(async (quiet = false) => {
    if (quiet) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const nextStatuses = await fetchGuardianCredentialStatuses(classData.id);
      setStatuses(nextStatuses);
      setLoadFailed(false);
    } catch (err: unknown) {
      console.error('Failed to load Guardian credential statuses:', err);
      setStatuses([]);
      setLoadFailed(true);
      setError(err instanceof Error ? err.message : 'Unable to load Guardian access status.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [classData.id]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const configuredCount = useMemo(
    () => statuses.filter((status) => status.credentialState !== 'not_configured').length,
    [statuses]
  );

  const activeCount = useMemo(
    () => statuses.filter((status) => status.credentialState === 'active').length,
    [statuses]
  );

  const handleCreate = async (status: GuardianCredentialStatus) => {
    setActionStudentId(status.studentId);
    setError('');

    try {
      const result = await createGuardianCredential(status.studentId);
      setRevealedCode({
        studentId: status.studentId,
        studentName: status.studentNickname || status.studentName,
        guardianCode: result.guardianCode,
        action: 'created'
      });
      setCopied(false);
      await loadStatuses(true);
    } catch (err: unknown) {
      console.error('Failed to create Guardian credential:', err);
      setError(err instanceof Error ? err.message : 'Unable to create Guardian access.');
    } finally {
      setActionStudentId(null);
    }
  };

  const handleRotate = async (status: GuardianCredentialStatus) => {
    const studentLabel = status.studentNickname || status.studentName;
    const confirmed = window.confirm(
      `Rotate Guardian access for ${studentLabel}?\n\nThe previous code and every active Guardian session will stop working immediately.`
    );
    if (!confirmed) return;

    setActionStudentId(status.studentId);
    setError('');

    try {
      const result = await rotateGuardianCredential(status.studentId);
      setRevealedCode({
        studentId: status.studentId,
        studentName: studentLabel,
        guardianCode: result.guardianCode,
        action: 'rotated'
      });
      setCopied(false);
      await loadStatuses(true);
    } catch (err: unknown) {
      console.error('Failed to rotate Guardian credential:', err);
      setError(err instanceof Error ? err.message : 'Unable to rotate Guardian access.');
    } finally {
      setActionStudentId(null);
    }
  };

  const handleSetActive = async (status: GuardianCredentialStatus, isActive: boolean) => {
    const studentLabel = status.studentNickname || status.studentName;

    if (!isActive) {
      const confirmed = window.confirm(
        `Disable Guardian access for ${studentLabel}?\n\nEvery active Guardian session will be signed out immediately.`
      );
      if (!confirmed) return;
    }

    setActionStudentId(status.studentId);
    setError('');

    try {
      await setGuardianCredentialActive(status.studentId, isActive);
      await loadStatuses(true);
    } catch (err: unknown) {
      console.error('Failed to update Guardian credential state:', err);
      setError(
        err instanceof Error
          ? err.message
          : isActive
            ? 'Unable to enable Guardian access.'
            : 'Unable to disable Guardian access.'
      );
    } finally {
      setActionStudentId(null);
    }
  };

  const handleCopyCode = async () => {
    if (!revealedCode) return;

    try {
      await copyText(revealedCode.guardianCode);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy Guardian code:', err);
      setError('The code could not be copied automatically. Select it and copy it manually.');
    }
  };

  const closeCodeModal = () => {
    setRevealedCode(null);
    setCopied(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button onClick={onBack} className="mc-back-link mb-6">
          <ArrowLeft size={14} className="mc-back-icon" />
          Back to Class
        </button>

        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl">
          <div className="border-b border-slate-800 p-6 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-sky-300">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-400">
                    Guardian Access
                  </p>
                  <h1 className="text-2xl font-display font-bold text-white sm:text-3xl">
                    {classData.name}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                    Create and control read-only family access for each student. Full Guardian codes are shown only once and cannot be recovered later.
                  </p>
                </div>
              </div>

              <button
                onClick={() => loadStatuses(true)}
                disabled={isRefreshing || isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px bg-slate-800 sm:grid-cols-3">
            <div className="bg-slate-900 px-6 py-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Students</div>
              <div className="mt-1 text-2xl font-bold text-white">{classData.students.length}</div>
            </div>
            <div className="bg-slate-900 px-6 py-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Configured</div>
              <div className="mt-1 text-2xl font-bold text-white">{loadFailed ? '—' : configuredCount}</div>
            </div>
            <div className="bg-slate-900 px-6 py-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active</div>
              <div className="mt-1 text-2xl font-bold text-emerald-300">{loadFailed ? '—' : activeCount}</div>
            </div>
          </div>
        </div>

        {error && !loadFailed && (
          <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="text-center text-slate-400">
              <Loader2 className="mx-auto mb-3 animate-spin text-sky-400" size={28} />
              Loading Guardian access status...
            </div>
          </div>
        ) : loadFailed ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 text-amber-300" size={38} />
            <h2 className="text-xl font-bold text-white">Guardian database setup required</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-amber-100/80">
              {error || 'Guardian Access cannot load until its database functions are installed.'}
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">
              Your class roster is still intact. Guardian controls will appear after the database setup is completed.
            </p>
            <button
              onClick={() => loadStatuses()}
              disabled={isLoading || isRefreshing}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm font-bold text-amber-100 transition-colors hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Retry Setup Check
            </button>
          </div>
        ) : statuses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
            <Users className="mx-auto mb-4 text-slate-500" size={36} />
            <h2 className="text-lg font-bold text-white">No students in this class</h2>
            <p className="mt-2 text-sm text-slate-400">Add students to the roster before creating Guardian access.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {statuses.map((status) => {
              const presentation = statePresentation[status.credentialState];
              const isBusy = actionStudentId === status.studentId;
              const studentLabel = status.studentNickname || status.studentName;

              return (
                <section
                  key={status.studentId}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-bold text-white">{studentLabel}</h2>
                        {status.studentNickname && (
                          <span className="text-sm text-slate-500">({status.studentName})</span>
                        )}
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${presentation.className}`}>
                          {presentation.label}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                        {status.secretHint && (
                          <span className="inline-flex items-center gap-1.5">
                            <EyeOff size={13} /> Code ends in{' '}
                            <strong className="font-mono text-slate-200">{status.secretHint}</strong>
                          </span>
                        )}
                        <span>Last used: {formatDateTime(status.lastUsedAt)}</span>
                        <span>Active sessions: {status.activeSessionCount}</span>
                        {status.lockedUntil && <span>Locked until: {formatDateTime(status.lockedUntil)}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      {status.credentialState === 'not_configured' ? (
                        <button
                          onClick={() => handleCreate(status)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                          Generate Access
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRotate(status)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            Rotate Code
                          </button>

                          {status.credentialState === 'disabled' ? (
                            <button
                              onClick={() => handleSetActive(status, true)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <ShieldCheck size={16} />
                              Enable
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSetActive(status, false)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <ShieldOff size={16} />
                              Disable
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {revealedCode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-sky-500/30 bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">One-time display</p>
                <h2 className="mt-1 text-xl font-bold text-white">
                  Guardian code {revealedCode.action}
                </h2>
              </div>
              <button
                onClick={closeCodeModal}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close code dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm leading-relaxed text-slate-400">
                Share this code securely with the guardian of{' '}
                <strong className="text-white">{revealedCode.studentName}</strong>. After closing this window,
                Mission Control will show only the final four-character hint.
              </p>

              <div className="my-5 rounded-xl border border-sky-500/30 bg-slate-950 p-4 text-center">
                <code className="break-all font-mono text-lg font-bold tracking-wider text-sky-200 sm:text-xl">
                  {revealedCode.guardianCode}
                </code>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
                This code is not saved in readable form. Copy it now. Rotating the code later will immediately invalidate this one and sign out existing Guardian sessions.
              </div>

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={closeCodeModal}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                >
                  I have saved it
                </button>
                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-500"
                >
                  {copied ? <Check size={16} /> : <Clipboard size={16} />}
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
