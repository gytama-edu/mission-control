import { supabase } from '../lib/supabaseClient';
import { ClassData, Student, Meeting, ActivityLog } from '../types';

export const logActivity = async (
  classId: string,
  actionType: string,
  studentId: string | null = null,
  pointsDelta: number = 0,
  livesDelta: number = 0,
  reason: string | null = null,
  metadata: any = {},
  meetingId: string | null = null
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const teacherId = user?.id || null;
    
    let activeMeetingId = meetingId;
    if (!activeMeetingId) {
      const { data: activeMeeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('class_id', classId)
        .eq('status', 'active')
        .maybeSingle();
      if (activeMeeting) {
        activeMeetingId = activeMeeting.id;
      }
    }

    await supabase.from('activity_logs').insert([{
      class_id: classId,
      teacher_id: teacherId,
      student_id: studentId,
      meeting_id: activeMeetingId,
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

export const clearClassActivityLogs = async (classId: string): Promise<void> => {
  const { error } = await supabase
    .from('activity_logs')
    .delete()
    .eq('class_id', classId);

  if (error) {
    console.error("Error clearing activity logs:", error);
    throw error;
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
    meeting_id: log.meeting_id,
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
    meeting_id: log.meeting_id,
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
    .order('started_at', { ascending: false });

  if (meetingError) throw meetingError;

  return (classes || []).map(c => ({
    id: c.id,
    name: c.name,
    level: c.level,
    maxLives: c.max_lives,
    joinCode: c.join_code,
    teacherId: c.teacher_id,
    createdAt: c.created_at,
    isArchived: c.is_archived || false,
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
        class_id: m.class_id,
        startedAt: m.started_at,
        endedAt: m.ended_at,
        status: m.status || 'ended',
        resetLivesTo: m.reset_lives_to,
        summary: m.summary || null,
        teacherId: m.teacher_id
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

export const archiveClass = async (id: string): Promise<any> => {
  const { data, error } = await supabase
    .from('classes')
    .update({ is_archived: true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const restoreClass = async (id: string): Promise<any> => {
  const { data, error } = await supabase
    .from('classes')
    .update({ is_archived: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
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
  // Check if there is already an active meeting
  const { data: activeMeeting, error: checkError } = await supabase
    .from('meetings')
    .select('*')
    .eq('class_id', classId)
    .eq('status', 'active')
    .maybeSingle();

  if (checkError) throw checkError;

  if (activeMeeting) {
    throw new Error('A meeting is already active. End the current meeting before starting a new one.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const teacherId = user?.id || null;

  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .insert([{ 
      class_id: classId, 
      reset_lives_to: maxLives, 
      status: 'active',
      started_at: new Date().toISOString(),
      teacher_id: teacherId
    }])
    .select()
    .single();

  if (meetingError) throw meetingError;

  const { error: studentError } = await supabase
    .from('students')
    .update({ lives: maxLives })
    .eq('class_id', classId);

  if (studentError) throw studentError;

  // Log meeting started
  await logActivity(classId, 'meeting_started', null, 0, 0, null, { reset_lives_to: maxLives }, meeting.id);

  return meeting;
};

export const endClassMeeting = async (meetingId: string, classId: string): Promise<any> => {
  // Fetch meeting details
  const { data: meeting, error: meetingFetchError } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (meetingFetchError) throw meetingFetchError;
  if (!meeting) throw new Error('Meeting not found.');

  // Fetch all logs for this meeting to build summary
  const { data: logs, error: logsError } = await supabase
    .from('activity_logs')
    .select(`
      *,
      students (
        name
      )
    `)
    .eq('meeting_id', meetingId)
    .eq('undone', false);

  if (logsError) throw logsError;

  const startedAt = new Date(meeting.started_at);
  const endedAt = new Date();
  const diffMs = endedAt.getTime() - startedAt.getTime();
  
  // Format duration nicely
  const diffMins = Math.floor(diffMs / 60000);
  let durationStr = '';
  if (diffMins < 1) {
    durationStr = 'Less than a minute';
  } else if (diffMins < 60) {
    durationStr = `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  } else {
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    durationStr = `${hrs} hour${hrs > 1 ? 's' : ''}${mins > 0 ? ` ${mins} minute${mins > 1 ? 's' : ''}` : ''}`;
  }

  // Calculate totals
  let totalPoints = 0;
  let livesLost = 0;
  let livesGained = 0;
  const actionCount = logs?.length || 0;

  // Track per-student points and life changes
  const studentPoints: Record<string, { name: string; points: number }> = {};
  const studentLivesLost: Record<string, { name: string; lost: number }> = {};
  const studentActionCount: Record<string, { name: string; count: number }> = {};

  for (const log of logs || []) {
    const studentName = log.students?.name || 'Unknown Student';
    if (log.student_id) {
      if (!studentPoints[log.student_id]) {
        studentPoints[log.student_id] = { name: studentName, points: 0 };
      }
      if (!studentLivesLost[log.student_id]) {
        studentLivesLost[log.student_id] = { name: studentName, lost: 0 };
      }
      if (!studentActionCount[log.student_id]) {
        studentActionCount[log.student_id] = { name: studentName, count: 0 };
      }
      studentActionCount[log.student_id].count += 1;
    }

    if (log.action_type === 'points_changed') {
      const delta = log.points_delta || 0;
      totalPoints += delta;
      if (log.student_id) {
        studentPoints[log.student_id].points += delta;
      }
    } else if (log.action_type === 'lives_changed') {
      const delta = log.lives_delta || 0;
      if (delta < 0) {
        livesLost += Math.abs(delta);
        if (log.student_id) {
          studentLivesLost[log.student_id].lost += Math.abs(delta);
        }
      } else {
        livesGained += delta;
      }
    }
  }

  // Find most active student
  let mostActiveStudent = 'None';
  let maxActions = 0;
  for (const stId in studentActionCount) {
    if (studentActionCount[stId].count > maxActions) {
      maxActions = studentActionCount[stId].count;
      mostActiveStudent = studentActionCount[stId].name;
    }
  }

  // Find top point gainers
  const topGainers = Object.values(studentPoints)
    .filter(st => st.points > 0)
    .sort((a, b) => b.points - a.points)
    .map(st => `${st.name} (+${st.points})`);

  // Find students who lost lives
  const lostLivesStudents = Object.values(studentLivesLost)
    .filter(st => st.lost > 0)
    .sort((a, b) => b.lost - a.lost)
    .map(st => `${st.name} (lost ${st.lost})`);

  const summary = {
    started_at: meeting.started_at,
    ended_at: endedAt.toISOString(),
    duration: durationStr,
    total_point_changes: totalPoints,
    total_lives_lost: livesLost,
    total_lives_gained: livesGained,
    total_actions: actionCount,
    most_active_student: mostActiveStudent,
    top_gainers: topGainers.slice(0, 3),
    lost_lives_students: lostLivesStudents.slice(0, 3)
  };

  const { data: updatedMeeting, error: updateMeetingError } = await supabase
    .from('meetings')
    .update({
      status: 'ended',
      ended_at: endedAt.toISOString(),
      summary: summary
    })
    .eq('id', meetingId)
    .select()
    .single();

  if (updateMeetingError) throw updateMeetingError;

  // Log meeting ended
  await logActivity(classId, 'meeting_ended', null, 0, 0, null, {
    meeting_id: meetingId,
    duration: durationStr,
    total_points: totalPoints,
    lives_lost: livesLost
  }, meetingId);

  return updatedMeeting;
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
