import { supabase } from '../lib/supabaseClient';

export type GuardianCredentialState =
  | 'not_configured'
  | 'active'
  | 'disabled'
  | 'expired'
  | 'locked';

export interface GuardianCredentialStatus {
  studentId: string;
  studentName: string;
  studentNickname?: string | null;
  credentialState: GuardianCredentialState;
  isActive: boolean;
  secretHint?: string | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  lockedUntil?: string | null;
  createdAt?: string | null;
  rotatedAt?: string | null;
  activeSessionCount: number;
}

export interface GuardianOneTimeCodeResult {
  studentId: string;
  guardianCode: string;
  secretHint: string;
  credentialState: 'active';
}

interface GuardianRpcResponse {
  ok: boolean;
  reason?: string;
  students?: GuardianCredentialStatus[];
  studentId?: string;
  guardianCode?: string;
  secretHint?: string;
  credentialState?: GuardianCredentialState;
  isActive?: boolean;
}

const requireSuccessfulResponse = (data: GuardianRpcResponse | null, fallbackMessage: string): GuardianRpcResponse => {
  if (!data?.ok) {
    const reasonMessages: Record<string, string> = {
      already_configured: 'Guardian access is already configured for this student.',
      not_configured: 'Guardian access has not been configured for this student.',
      invalid_state: 'The requested Guardian access state is invalid.'
    };

    throw new Error((data?.reason && reasonMessages[data.reason]) || fallbackMessage);
  }

  return data;
};

export const fetchGuardianCredentialStatuses = async (
  classId: string
): Promise<GuardianCredentialStatus[]> => {
  const { data, error } = await supabase.rpc('guardian_teacher_list_credentials', {
    p_class_id: classId
  });

  if (error) throw error;

  const response = requireSuccessfulResponse(
    data as GuardianRpcResponse | null,
    'Unable to load Guardian access status.'
  );

  return response.students || [];
};

export const createGuardianCredential = async (
  studentId: string
): Promise<GuardianOneTimeCodeResult> => {
  const { data, error } = await supabase.rpc('guardian_teacher_create_credential', {
    p_student_id: studentId
  });

  if (error) throw error;

  const response = requireSuccessfulResponse(
    data as GuardianRpcResponse | null,
    'Unable to create Guardian access.'
  );

  if (!response.studentId || !response.guardianCode || !response.secretHint) {
    throw new Error('Guardian access was created, but the one-time code response was incomplete.');
  }

  return {
    studentId: response.studentId,
    guardianCode: response.guardianCode,
    secretHint: response.secretHint,
    credentialState: 'active'
  };
};

export const rotateGuardianCredential = async (
  studentId: string
): Promise<GuardianOneTimeCodeResult> => {
  const { data, error } = await supabase.rpc('guardian_teacher_rotate_credential', {
    p_student_id: studentId
  });

  if (error) throw error;

  const response = requireSuccessfulResponse(
    data as GuardianRpcResponse | null,
    'Unable to rotate Guardian access.'
  );

  if (!response.studentId || !response.guardianCode || !response.secretHint) {
    throw new Error('Guardian access was rotated, but the one-time code response was incomplete.');
  }

  return {
    studentId: response.studentId,
    guardianCode: response.guardianCode,
    secretHint: response.secretHint,
    credentialState: 'active'
  };
};

export const setGuardianCredentialActive = async (
  studentId: string,
  isActive: boolean
): Promise<void> => {
  const { data, error } = await supabase.rpc('guardian_teacher_set_credential_active', {
    p_student_id: studentId,
    p_is_active: isActive
  });

  if (error) throw error;

  requireSuccessfulResponse(
    data as GuardianRpcResponse | null,
    isActive ? 'Unable to enable Guardian access.' : 'Unable to disable Guardian access.'
  );
};
