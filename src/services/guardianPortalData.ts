import { supabase } from '../lib/supabaseClient';

const GUARDIAN_SESSION_TOKEN_KEY = 'mission_control_guardian_session_token';
const GUARDIAN_SESSION_EXPIRY_KEY = 'mission_control_guardian_session_expiry';

export type GuardianDisplayMode = 'points' | 'lives';

export interface GuardianSession {
  sessionToken: string;
  expiresAt: string;
}

export interface GuardianBadge {
  name: string;
  description?: string;
  icon?: string;
  awardedAt: string;
}

export interface GuardianTask {
  title: string;
  description?: string;
  taskType: string;
  dueAt?: string;
  status: string;
  awardedPoints?: number;
  teacherFeedback?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface GuardianProgressItem {
  occurredAt: string;
  label: string;
  pointsDelta?: number;
  livesDelta?: number;
}

export interface GuardianDashboardData {
  access: {
    expiresAt: string;
  };
  class: {
    name: string;
    level?: string;
    category: string;
    displayMode: GuardianDisplayMode;
  };
  student: {
    displayName: string;
    nickname?: string;
    points?: number;
    lives?: number;
  };
  badges: GuardianBadge[];
  tasks: GuardianTask[];
  recentProgress: GuardianProgressItem[];
}

interface GuardianRpcResponse {
  ok: boolean;
  reason?: string;
  sessionToken?: string;
  expiresAt?: string;
  data?: GuardianDashboardData;
}

export class GuardianPortalError extends Error {
  code: 'invalid_credentials' | 'invalid_session' | 'invalid_response' | 'request_failed';

  constructor(
    code: GuardianPortalError['code'],
    message: string
  ) {
    super(message);
    this.name = 'GuardianPortalError';
    this.code = code;
  }
}

const isStorageAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && Boolean(window.sessionStorage);
  } catch {
    return false;
  }
};

export const saveGuardianSession = (session: GuardianSession): void => {
  if (!isStorageAvailable()) return;

  try {
    window.sessionStorage.setItem(GUARDIAN_SESSION_TOKEN_KEY, session.sessionToken);
    window.sessionStorage.setItem(GUARDIAN_SESSION_EXPIRY_KEY, session.expiresAt);
  } catch {
    console.warn('Guardian session could not be saved in this browser tab.');
  }
};

export const clearGuardianSession = (): void => {
  if (!isStorageAvailable()) return;

  try {
    window.sessionStorage.removeItem(GUARDIAN_SESSION_TOKEN_KEY);
    window.sessionStorage.removeItem(GUARDIAN_SESSION_EXPIRY_KEY);
  } catch {
    console.warn('Guardian session storage could not be cleared normally.');
  }
};

export const readGuardianSession = (): GuardianSession | null => {
  if (!isStorageAvailable()) return null;

  try {
    const sessionToken = window.sessionStorage.getItem(GUARDIAN_SESSION_TOKEN_KEY);
    const expiresAt = window.sessionStorage.getItem(GUARDIAN_SESSION_EXPIRY_KEY);

    if (!sessionToken || !expiresAt) {
      clearGuardianSession();
      return null;
    }

    const expiryTime = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
      clearGuardianSession();
      return null;
    }

    return { sessionToken, expiresAt };
  } catch {
    console.warn('Guardian session could not be restored from this browser tab.');
    return null;
  }
};

export const beginGuardianSession = async (
  classCode: string,
  guardianCode: string
): Promise<GuardianSession> => {
  const { data, error } = await supabase.rpc('guardian_begin_session', {
    p_class_code: classCode.trim(),
    p_guardian_secret: guardianCode.trim()
  });

  if (error) {
    console.error('Guardian sign-in RPC failed.');
    throw new GuardianPortalError(
      'request_failed',
      'Guardian sign-in is temporarily unavailable. Please try again.'
    );
  }

  const response = data as GuardianRpcResponse | null;
  if (!response?.ok) {
    throw new GuardianPortalError(
      'invalid_credentials',
      'The class code or Guardian code is incorrect, unavailable, or temporarily locked.'
    );
  }

  if (!response.sessionToken || !response.expiresAt) {
    console.error('Guardian sign-in returned an incomplete secure session response.');
    throw new GuardianPortalError(
      'invalid_response',
      'Guardian sign-in could not create a secure session. Please try again.'
    );
  }

  return {
    sessionToken: response.sessionToken,
    expiresAt: response.expiresAt
  };
};

export const fetchGuardianDashboard = async (
  sessionToken: string
): Promise<GuardianDashboardData> => {
  const { data, error } = await supabase.rpc('guardian_fetch_dashboard', {
    p_session_token: sessionToken
  });

  if (error) {
    console.error('Guardian dashboard RPC failed.');
    throw new GuardianPortalError(
      'request_failed',
      'Guardian progress is temporarily unavailable. Please try again.'
    );
  }

  const response = data as GuardianRpcResponse | null;
  if (!response?.ok) {
    throw new GuardianPortalError(
      'invalid_session',
      'This Guardian session is no longer valid. Please sign in again.'
    );
  }

  if (!response.data?.class || !response.data?.student || !response.data?.access) {
    console.error('Guardian dashboard returned an unexpected payload shape.');
    throw new GuardianPortalError(
      'invalid_response',
      'Guardian progress could not be displayed safely. Please try again.'
    );
  }

  return {
    ...response.data,
    badges: Array.isArray(response.data.badges) ? response.data.badges : [],
    tasks: Array.isArray(response.data.tasks) ? response.data.tasks : [],
    recentProgress: Array.isArray(response.data.recentProgress) ? response.data.recentProgress : []
  };
};

export const endGuardianSession = async (sessionToken: string): Promise<void> => {
  const { error } = await supabase.rpc('guardian_end_session', {
    p_session_token: sessionToken
  });

  if (error) {
    console.warn('Guardian logout RPC failed; the local tab session was still cleared.');
  }
};
