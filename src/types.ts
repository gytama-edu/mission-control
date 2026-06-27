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

export interface Task {
  id: string;
  teacher_id: string | null;
  class_id: string;
  title: string;
  description: string | null;
  task_type: 'individual' | 'group';
  status: 'draft' | 'published' | 'closed' | 'archived';
  due_at: string | null;
  reward_points: number;
  allow_text_submission: boolean;
  allow_attachment_submission: boolean;
  max_attachments: number;
  max_attachment_size_mb: number;
  created_at: string;
  updated_at: string;
}

export interface TaskGroup {
  id: string;
  task_id: string;
  class_id: string;
  name: string;
  created_at: string;
  members?: TaskGroupMember[];
}

export interface TaskGroupMember {
  id: string;
  task_group_id: string;
  task_id: string;
  student_id: string;
  created_at: string;
  studentName?: string;
}


