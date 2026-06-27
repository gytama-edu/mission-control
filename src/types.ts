export interface Student {
  id: string;
  name: string;
  nickname?: string;
  lives: number;
  points: number;
  joinedAt: string;
  pin: string;
}

export interface Meeting {
  id: string;
  class_id: string;
  startedAt: string;
  endedAt?: string | null;
  status: 'active' | 'ended';
  resetLivesTo: number;
  summary?: {
    started_at?: string;
    ended_at?: string;
    duration?: string;
    total_point_changes?: number;
    total_lives_lost?: number;
    total_lives_gained?: number;
    total_actions?: number;
    most_active_student?: string;
    top_gainers?: string[];
    lost_lives_students?: string[];
    [key: string]: any;
  } | null;
  teacherId?: string | null;
}

export interface ClassData {
  id: string;
  name: string;
  level: string;
  maxLives: number;
  students: Student[];
  meetings: Meeting[];
  createdAt: string;
  joinCode: string;
  teacherId?: string | null;
}

export interface ActivityLog {
  id: string;
  teacher_id?: string | null;
  class_id: string;
  student_id?: string | null;
  meeting_id?: string | null;
  action_type: string;
  points_delta?: number;
  lives_delta?: number;
  reason?: string | null;
  metadata?: any;
  undone: boolean;
  undone_at?: string | null;
  undone_by?: string | null;
  created_at: string;
  studentName?: string | null;
}

