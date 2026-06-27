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
  startedAt: string;
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

