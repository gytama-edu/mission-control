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
  isArchived?: boolean;
  category?: 'regular' | 'private';
  scoring_system?: 'points' | 'lives';
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
  allow_resubmission: boolean;
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
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

export interface TaskSubmission {
  id: string;
  task_id: string;
  class_id: string;
  student_id: string | null;
  task_group_id: string | null;
  submitted_by_student_id: string | null;
  submission_text: string | null;
  status: 'submitted' | 'reviewed' | 'returned' | 'late';
  teacher_feedback: string | null;
  awarded_points: number | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  studentName?: string;
  attachments?: SubmissionAttachment[];
}

export interface SubmissionAttachment {
  id: string;
  submission_id: string;
  task_id: string;
  class_id: string;
  student_id: string | null;
  task_group_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size_bytes: number | null;
  storage_bucket: string;
  uploaded_at: string;
}

export interface BadgeDefinition {
  id: string;
  teacher_id: string | null;
  class_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  badge_type: 'manual' | 'automatic';
  trigger_key: string | null;
  points_threshold: number | null;
  task_count_threshold: number | null;
  group_task_count_threshold: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentBadge {
  id: string;
  badge_id: string;
  class_id: string;
  student_id: string;
  awarded_by: string | null;
  awarded_reason: string | null;
  source: 'manual' | 'automatic' | 'task_review' | 'group_review' | 'meeting';
  metadata: any;
  awarded_at: string;
  badge?: BadgeDefinition;
}




