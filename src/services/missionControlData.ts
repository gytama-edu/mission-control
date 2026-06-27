import { supabase } from '../lib/supabaseClient';
import { ClassData, Student, Meeting } from '../types';

export const fetchClasses = async (): Promise<ClassData[]> => {
  const { data: classes, error: classError } = await supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: true });

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

export const createClass = async (name: string, level: string, maxLives: number, joinCode: string): Promise<any> => {
  const { data, error } = await supabase
    .from('classes')
    .insert([{ name, level, max_lives: maxLives, join_code: joinCode }])
    .select()
    .single();

  if (error) throw error;
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
  return data;
};

export const deleteStudent = async (studentId: string): Promise<void> => {
  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) throw error;
};

export const resetStudentPin = async (studentId: string, newPin: string): Promise<any> => {
  const { data, error } = await supabase
    .from('students')
    .update({ pin: newPin })
    .eq('id', studentId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateStudentLives = async (studentId: string, change: number, maxLives: number): Promise<any> => {
  const { data: student, error: fetchError } = await supabase
    .from('students')
    .select('lives')
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
  return data;
};

export const updateStudentPoints = async (studentId: string, change: number): Promise<any> => {
  const { data: student, error: fetchError } = await supabase
    .from('students')
    .select('points')
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
