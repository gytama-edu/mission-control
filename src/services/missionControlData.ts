import { supabase } from '../lib/supabaseClient';
import { ClassData, Student, Meeting, ActivityLog } from '../types';

export const logActivity = async (
  classId: string,
  actionType: string,
  studentId: string | null = null,
  pointsDelta: number = 0,
  livesDelta: number = 0,
  reason: string | null = null,
  metadata: any = {}
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const teacherId = user?.id || null;
    await supabase.from('activity_logs').insert([{
      class_id: classId,
      teacher_id: teacherId,
      student_id: studentId,
      action_type: actionType,
      points_delta: pointsDelta,
      lives_delta: livesDelta,
      reason,
      metadata
    }]);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

export const fetchActivityLogs = async (classId: string): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(`
      *,
      students (
        name
      )
    `)
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((log: any) => ({
    id: log.id,
    teacher_id: log.teacher_id,
    class_id: log.class_id,
    student_id: log.student_id,
    action_type: log.action_type,
    points_delta: log.points_delta,
    lives_delta: log.lives_delta,
    reason: log.reason,
    metadata: log.metadata,
    undone: log.undone,
    undone_at: log.undone_at,
    undone_by: log.undone_by,
    created_at: log.created_at,
    studentName: log.students?.name || null
  }));
};

export const fetchStudentActivityLogs = async (classId: string, studentId: string): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('class_id', classId)
    .eq('student_id', studentId)
    .in('action_type', ['points_changed', 'lives_changed', 'action_undone'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data || []).map((log: any) => ({
    id: log.id,
    teacher_id: log.teacher_id,
    class_id: log.class_id,
    student_id: log.student_id,
    action_type: log.action_type,
    points_delta: log.points_delta,
    lives_delta: log.lives_delta,
    reason: log.reason,
    metadata: log.metadata,
    undone: log.undone,
    undone_at: log.undone_at,
    undone_by: log.undone_by,
    created_at: log.created_at
  }));
};

export const undoActivityLog = async (logId: string): Promise<any> => {
  const { data: log, error: logError } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('id', logId)
    .single();
    
  if (logError) throw logError;
  if (!log) throw new Error('Activity log not found');
  if (log.undone) throw new Error('Action has already been undone');
  if (log.action_type !== 'points_changed' && log.action_type !== 'lives_changed') {
    throw new Error('Only point and life changes can be undone');
  }

  const { class_id, student_id, action_type, points_delta, lives_delta } = log;
  if (!student_id) throw new Error('Student not associated with this log');

  if (action_type === 'points_changed' && points_delta !== 0) {
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('points')
      .eq('id', student_id)
      .single();
    if (studentError) throw studentError;
    
    let newPoints = student.points - points_delta;
    if (newPoints < 0) newPoints = 0;
    
    await supabase
      .from('students')
      .update({ points: newPoints })
      .eq('id', student_id);
  } else if (action_type === 'lives_changed' && lives_delta !== 0) {
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('lives')
      .eq('id', student_id)
      .single();
    if (studentError) throw studentError;
    
    const { data: cls, error: classError } = await supabase
      .from('classes')
      .select('max_lives')
      .eq('id', class_id)
      .single();
    if (classError) throw classError;
    
    let newLives = student.lives - lives_delta;
    if (newLives < 0) newLives = 0;
    if (newLives > cls.max_lives) newLives = cls.max_lives;
    
    await supabase
      .from('students')
      .update({ lives: newLives })
      .eq('id', student_id);
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: updatedLog, error: updateError } = await supabase
    .from('activity_logs')
    .update({
      undone: true,
      undone_at: new Date().toISOString(),
      undone_by: user?.id || null
    })
    .eq('id', logId)
    .select()
    .single();

  if (updateError) throw updateError;

  await supabase.from('activity_logs').insert([{
    class_id,
    teacher_id: user?.id || null,
    student_id,
    action_type: 'action_undone',
    reason: `Undid previous ${action_type === 'points_changed' ? 'points' : 'lives'} change`,
    metadata: { undone_log_id: logId }
  }]);

  return updatedLog;
};


export const fetchClasses = async (teacherId?: string | null): Promise<ClassData[]> => {
  let query = supabase.from('classes').select('*');
  if (teacherId) {
    query = query.or(`teacher_id.eq.${teacherId},teacher_id.is.null`);
  }
  const { data: classes, error: classError } = await query.order('created_at', { ascending: true });

  if (classError) throw classError;

  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('*')
    .order('points', { ascending: false });

  if (studentError) throw studentError;

  const { data: meetings, error: meetingError } = await supabase
    .from('meetings')
    .select('*')
    .order('started_at', { ascending: true });

  if (meetingError) throw meetingError;

  return (classes || []).map(c => ({
    id: c.id,
    name: c.name,
    level: c.level,
    maxLives: c.max_lives,
    joinCode: c.join_code,
    teacherId: c.teacher_id,
    createdAt: c.created_at,
    students: (students || [])
      .filter(s => s.class_id === c.id)
      .map(s => ({
        id: s.id,
        name: s.name,
        nickname: s.nickname || '',
        pin: s.pin,
        lives: s.lives,
        points: s.points,
        joinedAt: s.created_at
      })),
    meetings: (meetings || [])
      .filter(m => m.class_id === c.id)
      .map(m => ({
        id: m.id,
        startedAt: m.started_at,
        resetLivesTo: m.reset_lives_to
      }))
  }));
};

export const createClass = async (name: string, level: string, maxLives: number, joinCode: string, teacherId?: string): Promise<any> => {
  const payload: any = { name, level, max_lives: maxLives, join_code: joinCode };
  if (teacherId) {
    payload.teacher_id = teacherId;
  }
  const { data, error } = await supabase
    .from('classes')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  // Log class creation
  await logActivity(data.id, 'class_created', null, 0, 0, null, { name, level });

  return data;
};

export const claimClass = async (classId: string, teacherId: string): Promise<any> => {
  const { data, error } = await supabase
    .from('classes')
    .update({ teacher_id: teacherId })
    .eq('id', classId)
    .select()
    .single();

  if (error) throw error;

  // Log class claiming
  await logActivity(classId, 'class_claimed', null, 0, 0, null, { name: data.name });

  return data;
};

export const updateClass = async (id: string, name: string, level: string, maxLives: number): Promise<any> => {
  const { data, error } = await supabase
    .from('classes')
    .update({ name, level, max_lives: maxLives })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  
  // Enforce new maxLives
  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('id, lives')
    .eq('class_id', id);
    
  if (studentError) throw studentError;
  
  for (const student of students || []) {
    if (student.lives > maxLives) {
      await supabase.from('students').update({ lives: maxLives }).eq('id', student.id);
    }
  }

  // Log class updated
  await logActivity(id, 'class_updated', null, 0, 0, null, { name, level, max_lives: maxLives });

  return data;
};

export const deleteClass = async (id: string): Promise<void> => {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
};

export const regenerateJoinCode = async (id: string, newCode: string): Promise<any> => {
  const { data, error } = await supabase
    .from('classes')
    .update({ join_code: newCode })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Log join code regenerated
  await logActivity(id, 'join_code_regenerated', null, 0, 0, null, { new_code: newCode });

  return data;
};

export const addStudent = async (classId: string, name: string, maxLives: number, pin: string): Promise<any> => {
  const { data, error } = await supabase
    .from('students')
    .insert([{
      class_id: classId,
      name,
      pin,
      lives: maxLives,
      points: 0
    }])
    .select()
    .single();

  if (error) throw error;

  // Log student added
  await logActivity(classId, 'student_added', data.id, 0, 0, null, { student_name: name });

  return data;
};

export const updateStudent = async (studentId: string, name: string, nickname: string | undefined): Promise<any> => {
  const { data, error } = await supabase
    .from('students')
    .update({ name, nickname: nickname || null })
    .eq('id', studentId)
    .select()
    .single();

  if (error) throw error;

  // Log student updated
  await logActivity(data.class_id, 'student_updated', studentId, 0, 0, null, { name, nickname });

  return data;
};

export const deleteStudent = async (studentId: string): Promise<void> => {
  // Fetch student details first to know class_id and name
  const { data: student, error: fetchError } = await supabase
    .from('students')
    .select('class_id, name')
    .eq('id', studentId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) throw error;

  // Log student deleted
  await logActivity(student.class_id, 'student_deleted', null, 0, 0, null, { student_name: student.name });
};

export const resetStudentPin = async (studentId: string, newPin: string): Promise<any> => {
  const { data, error } = await supabase
    .from('students')
    .update({ pin: newPin })
    .eq('id', studentId)
    .select()
    .single();

  if (error) throw error;

  // Log student PIN reset
  await logActivity(data.class_id, 'student_pin_reset', studentId, 0, 0, null, { student_name: data.name });

  return data;
};

export const updateStudentLives = async (studentId: string, change: number, maxLives: number, reason?: string | null): Promise<any> => {
  const { data: student, error: fetchError } = await supabase
    .from('students')
    .select('class_id, lives')
    .eq('id', studentId)
    .single();

  if (fetchError) throw fetchError;

  let newLives = student.lives + change;
  if (newLives > maxLives) newLives = maxLives;
  if (newLives < 0) newLives = 0;

  const { data, error } = await supabase
    .from('students')
    .update({ lives: newLives })
    .eq('id', studentId)
    .select()
    .single();

  if (error) throw error;

  // Log lives changed
  await logActivity(student.class_id, 'lives_changed', studentId, 0, change, reason);

  return data;
};

export const updateStudentPoints = async (studentId: string, change: number, reason?: string | null): Promise<any> => {
  const { data: student, error: fetchError } = await supabase
    .from('students')
    .select('class_id, points')
    .eq('id', studentId)
    .single();

  if (fetchError) throw fetchError;

  let newPoints = student.points + change;
  if (newPoints < 0) newPoints = 0;

  const { data, error } = await supabase
    .from('students')
    .update({ points: newPoints })
    .eq('id', studentId)
    .select()
    .single();

  if (error) throw error;

  // Log points changed
  await logActivity(student.class_id, 'points_changed', studentId, change, 0, reason);

  return data;
};

export const startNewMeeting = async (classId: string, maxLives: number): Promise<any> => {
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .insert([{ class_id: classId, reset_lives_to: maxLives }])
    .select()
    .single();

  if (meetingError) throw meetingError;

  const { error: studentError } = await supabase
    .from('students')
    .update({ lives: maxLives })
    .eq('class_id', classId);

  if (studentError) throw studentError;

  // Log meeting started
  await logActivity(classId, 'meeting_started', null, 0, 0, null, { reset_lives_to: maxLives });

  return meeting;
};

export const findClassByJoinCode = async (joinCode: string): Promise<any> => {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('join_code', joinCode)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const findStudentByClassAndPin = async (classId: string, pin: string): Promise<any> => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .eq('pin', pin)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const getStudentDashboardData = async (classId: string, studentId: string): Promise<{ classData: ClassData | null, studentData: Student | null }> => {
  const classes = await fetchClasses();
  const c = classes.find(cl => cl.id === classId);
  if (!c) return { classData: null, studentData: null };
  const s = c.students.find(st => st.id === studentId);
  return { classData: c, studentData: s || null };
};
