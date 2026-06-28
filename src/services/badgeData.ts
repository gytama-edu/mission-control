import { supabase } from '../lib/supabaseClient';
import { BadgeDefinition, StudentBadge } from '../types';

export const fetchBadgeDefinitions = async (classId: string): Promise<BadgeDefinition[]> => {
  const { data, error } = await supabase
    .from('badge_definitions')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) {
    const isMissingTable = error.code === 'PGRST205' || 
      (error.message && (error.message.includes('badge_definitions') || error.message.includes('student_badges')) && error.message.includes('schema cache'));
    if (!isMissingTable) {
      console.error('Error fetching badge definitions:', error);
    }
    const customErr = new Error(error.message || 'Failed to load badges.');
    (customErr as any).code = error.code;
    (customErr as any).details = error.details;
    (customErr as any).hint = error.hint;
    throw customErr;
  }
  return data || [];
};

export const createBadgeDefinition = async (
  badge: Omit<BadgeDefinition, 'id' | 'created_at' | 'updated_at'>
): Promise<BadgeDefinition> => {
  const { data, error } = await supabase
    .from('badge_definitions')
    .insert([badge])
    .select()
    .single();

  if (error) {
    console.error('Error creating badge definition:', error);
    throw new Error('Failed to create badge definition.');
  }

  // Log activity
  await supabase.from('activity_logs').insert([{
    class_id: badge.class_id,
    action_type: 'badge_created',
    points_delta: 0,
    lives_delta: 0,
    reason: `Created new badge definition: ${badge.name}`,
    metadata: { badge_name: badge.name }
  }]);

  return data;
};

export const updateBadgeDefinition = async (
  id: string,
  classId: string,
  badge: Partial<BadgeDefinition>
): Promise<BadgeDefinition> => {
  const { data, error } = await supabase
    .from('badge_definitions')
    .update(badge)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating badge definition:', error);
    throw new Error('Failed to update badge definition.');
  }

  // Log activity
  await supabase.from('activity_logs').insert([{
    class_id: classId,
    action_type: 'badge_updated',
    points_delta: 0,
    lives_delta: 0,
    reason: `Updated badge definition: ${badge.name || data.name}`,
    metadata: { badge_id: id, badge_name: badge.name || data.name, is_active: badge.is_active }
  }]);

  return data;
};

export const deleteBadgeDefinition = async (id: string, classId: string, badgeName: string): Promise<void> => {
  const { error } = await supabase
    .from('badge_definitions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting badge definition:', error);
    throw new Error('Failed to delete badge definition.');
  }

  // Log activity
  await supabase.from('activity_logs').insert([{
    class_id: classId,
    action_type: 'badge_deleted',
    points_delta: 0,
    lives_delta: 0,
    reason: `Deleted badge definition: ${badgeName}`,
    metadata: { badge_id: id, badge_name: badgeName }
  }]);
};

export const fetchStudentBadges = async (classId: string, studentId?: string): Promise<StudentBadge[]> => {
  let query = supabase
    .from('student_badges')
    .select(`
      *,
      badge:badge_definitions(*)
    `)
    .eq('class_id', classId);

  if (studentId) {
    query = query.eq('student_id', studentId);
  }

  const { data, error } = await supabase.rpc('get_student_badges_helper', { class_id_input: classId });
  
  // Wait, let's write a simple query fallback or direct query that joins. Direct query with joint is standard in Supabase:
  const { data: rawData, error: rawError } = await query.order('awarded_at', { ascending: false });

  if (rawError) {
    const isMissingTable = rawError.code === 'PGRST205' || 
      (rawError.message && (rawError.message.includes('badge_definitions') || rawError.message.includes('student_badges')) && rawError.message.includes('schema cache'));
    if (!isMissingTable) {
      console.error('Error fetching student badges:', rawError);
    }
    const customErr = new Error(rawError.message || 'Failed to load student badges.');
    (customErr as any).code = rawError.code;
    (customErr as any).details = rawError.details;
    (customErr as any).hint = rawError.hint;
    throw customErr;
  }

  return (rawData || []) as unknown as StudentBadge[];
};

export const awardBadgeManually = async (
  badgeId: string,
  studentId: string,
  reason: string
): Promise<string> => {
  const { data, error } = await supabase.rpc('award_badge_to_student', {
    badge_id_input: badgeId,
    student_id_input: studentId,
    reason_input: reason
  });

  if (error) {
    console.error('Error in award_badge_to_student:', error);
    if (error.message && error.message.includes('unique')) {
      throw new Error('Badge already awarded to this student.');
    }
    throw new Error(error.message || 'Failed to award badge.');
  }

  if (!data) {
    throw new Error('Badge already awarded to this student.');
  }

  return data;
};

export const checkAndAwardAutomaticBadges = async (
  studentId: string,
  classId: string
): Promise<any[]> => {
  const { data, error } = await supabase.rpc('check_and_award_automatic_badges', {
    student_id_input: studentId,
    class_id_input: classId
  });

  if (error) {
    console.error('Error in check_and_award_automatic_badges:', error);
    // Silent fail for automatic checks, just return empty array so UI is not blocked
    return [];
  }

  return data || [];
};

export const addStarterBadges = async (classId: string, teacherId: string): Promise<void> => {
  const starters = [
    {
      class_id: classId,
      teacher_id: teacherId,
      name: 'First Mission',
      description: 'Complete your very first mission submission!',
      icon: '🚀',
      badge_type: 'automatic' as const,
      trigger_key: 'first_submission',
      is_active: true
    },
    {
      class_id: classId,
      teacher_id: teacherId,
      name: 'Team Player',
      description: 'Complete a group mission task as a team!',
      icon: '🤝',
      badge_type: 'automatic' as const,
      trigger_key: 'group_tasks_completed',
      group_task_count_threshold: 1,
      is_active: true
    },
    {
      class_id: classId,
      teacher_id: teacherId,
      name: 'Homework Hero',
      description: 'Successfully complete 3 individual tasks.',
      icon: '📚',
      badge_type: 'automatic' as const,
      trigger_key: 'individual_tasks_completed',
      task_count_threshold: 3,
      is_active: true
    },
    {
      class_id: classId,
      teacher_id: teacherId,
      name: 'Top Contributor',
      description: 'Reach a points milestone of 100 points.',
      icon: '👑',
      badge_type: 'automatic' as const,
      trigger_key: 'points_threshold',
      points_threshold: 100,
      is_active: true
    },
    {
      class_id: classId,
      teacher_id: teacherId,
      name: 'Comeback Pilot',
      description: 'Recover and return to safe flight status after hitting zero lives.',
      icon: '❤️',
      badge_type: 'automatic' as const,
      trigger_key: 'comeback_from_zero_lives',
      is_active: true
    },
    {
      class_id: classId,
      teacher_id: teacherId,
      name: 'Perfect Meeting',
      description: 'Complete a class meeting without losing any lives!',
      icon: '💯',
      badge_type: 'automatic' as const,
      trigger_key: 'no_lives_lost_meeting',
      is_active: true
    },
    {
      class_id: classId,
      teacher_id: teacherId,
      name: 'Speaking Star',
      description: 'Teacher-awarded badge for exceptional speaking effort and engagement.',
      icon: '⭐',
      badge_type: 'manual' as const,
      trigger_key: 'teacher_choice',
      is_active: true
    }
  ];

  const { error } = await supabase
    .from('badge_definitions')
    .insert(starters);

  if (error) {
    console.error('Error inserting starter badges:', error);
    throw new Error('Failed to create starter badges.');
  }

  // Log activity for bulk creation
  await supabase.from('activity_logs').insert([{
    class_id: classId,
    action_type: 'badge_created',
    points_delta: 0,
    lives_delta: 0,
    reason: 'Added starter badge definitions template suite',
    metadata: { starter_count: starters.length }
  }]);
};
