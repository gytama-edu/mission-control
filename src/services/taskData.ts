import { supabase } from '../lib/supabaseClient';
import { Task, TaskGroup, TaskGroupMember } from '../types';
import { logActivity } from './missionControlData';

export const fetchTasksByClass = async (classId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createTask = async (taskInput: {
  class_id: string;
  title: string;
  description: string;
  task_type: 'individual' | 'group';
  due_at: string | null;
  reward_points: number;
  allow_text_submission: boolean;
  allow_attachment_submission: boolean;
  max_attachments: number;
  max_attachment_size_mb: number;
}): Promise<Task> => {
  const { data: { user } } = await supabase.auth.getUser();
  const teacherId = user?.id || null;

  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      ...taskInput,
      teacher_id: teacherId,
      status: 'draft'
    }])
    .select()
    .single();

  if (error) throw error;

  // Log activity
  await logActivity(
    taskInput.class_id,
    'task_created',
    null,
    0,
    0,
    null,
    { task_id: data.id, task_title: data.title, task_type: data.task_type }
  );

  return data;
};

export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteTask = async (taskId: string, classId: string, taskTitle: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;

  // Log activity
  await logActivity(
    classId,
    'task_deleted',
    null,
    0,
    0,
    null,
    { task_title: taskTitle }
  );
};

export const publishTask = async (taskId: string, classId: string, taskTitle: string): Promise<Task> => {
  const task = await updateTask(taskId, { status: 'published' });
  
  // Log activity
  await logActivity(
    classId,
    'task_published',
    null,
    0,
    0,
    null,
    { task_id: taskId, task_title: taskTitle }
  );

  return task;
};

export const closeTask = async (taskId: string, classId: string, taskTitle: string): Promise<Task> => {
  const task = await updateTask(taskId, { status: 'closed' });

  // Log activity
  await logActivity(
    classId,
    'task_closed',
    null,
    0,
    0,
    null,
    { task_id: taskId, task_title: taskTitle }
  );

  return task;
};

export const archiveTask = async (taskId: string, classId: string, taskTitle: string): Promise<Task> => {
  const task = await updateTask(taskId, { status: 'archived' });

  // Log activity
  await logActivity(
    classId,
    'task_archived',
    null,
    0,
    0,
    null,
    { task_id: taskId, task_title: taskTitle }
  );

  return task;
};

export const fetchTaskGroups = async (taskId: string): Promise<TaskGroup[]> => {
  // Fetch task groups
  const { data: groups, error: groupsError } = await supabase
    .from('task_groups')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (groupsError) throw groupsError;

  // Fetch group members with student info
  const { data: members, error: membersError } = await supabase
    .from('task_group_members')
    .select(`
      *,
      students (
        name
      )
    `)
    .eq('task_id', taskId);

  if (membersError) throw membersError;

  // Map members back to groups
  return (groups || []).map((group: any) => {
    const groupMembers = (members || [])
      .filter((m: any) => m.task_group_id === group.id)
      .map((m: any) => ({
        id: m.id,
        task_group_id: m.task_group_id,
        task_id: m.task_id,
        student_id: m.student_id,
        created_at: m.created_at,
        studentName: m.students?.name || 'Unknown Student'
      }));

    return {
      ...group,
      members: groupMembers
    };
  });
};

export const createTaskGroup = async (taskId: string, classId: string, name: string): Promise<TaskGroup> => {
  const { data, error } = await supabase
    .from('task_groups')
    .insert([{
      task_id: taskId,
      class_id: classId,
      name
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createMultipleTaskGroups = async (
  taskId: string,
  classId: string,
  taskTitle: string,
  numberOfGroups: number
): Promise<TaskGroup[]> => {
  const inserts = Array.from({ length: numberOfGroups }).map((_, idx) => ({
    task_id: taskId,
    class_id: classId,
    name: `Group ${idx + 1}`
  }));

  const { data, error } = await supabase
    .from('task_groups')
    .insert(inserts)
    .select();

  if (error) throw error;

  // Log activity
  await logActivity(
    classId,
    'task_groups_created',
    null,
    0,
    0,
    null,
    { task_id: taskId, task_title: taskTitle, number_of_groups: numberOfGroups }
  );

  return data || [];
};

export const renameTaskGroup = async (taskGroupId: string, newName: string): Promise<void> => {
  const { error } = await supabase
    .from('task_groups')
    .update({ name: newName })
    .eq('id', taskGroupId);

  if (error) throw error;
};

export const deleteTaskGroup = async (taskGroupId: string): Promise<void> => {
  // Let's check if there are members first
  const { count, error: countError } = await supabase
    .from('task_group_members')
    .select('*', { count: 'exact', head: true })
    .eq('task_group_id', taskGroupId);

  if (countError) throw countError;
  if (count && count > 0) {
    throw new Error('Cannot delete a group that has members. Remove members first.');
  }

  const { error } = await supabase
    .from('task_groups')
    .delete()
    .eq('id', taskGroupId);

  if (error) throw error;
};

export const addStudentToTaskGroup = async (
  taskGroupId: string,
  taskId: string,
  classId: string,
  studentId: string
): Promise<TaskGroupMember> => {
  // Check if student is already in ANY group for this specific task
  const { data: existing, error: checkError } = await supabase
    .from('task_group_members')
    .select('id')
    .eq('task_id', taskId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (checkError) throw checkError;
  if (existing) {
    throw new Error('This student is already assigned to a group for this task.');
  }

  const { data, error } = await supabase
    .from('task_group_members')
    .insert([{
      task_group_id: taskGroupId,
      task_id: taskId,
      student_id: studentId
    }])
    .select()
    .single();

  if (error) throw error;

  // Log activity
  await logActivity(
    classId,
    'task_group_member_added',
    studentId,
    0,
    0,
    null,
    { task_id: taskId, group_id: taskGroupId }
  );

  return data;
};

export const removeStudentFromTaskGroup = async (
  taskGroupMemberId: string,
  taskId: string,
  classId: string,
  studentId: string,
  taskGroupId: string
): Promise<void> => {
  const { error } = await supabase
    .from('task_group_members')
    .delete()
    .eq('id', taskGroupMemberId);

  if (error) throw error;

  // Log activity
  await logActivity(
    classId,
    'task_group_member_removed',
    studentId,
    0,
    0,
    null,
    { task_id: taskId, group_id: taskGroupId }
  );
};

export const submitIndividualTask = async (
  taskId: string,
  classId: string,
  studentId: string,
  taskTitle: string,
  submissionText: string | null,
  isLate: boolean = false
): Promise<any> => {
  // Check if a submission already exists for correct activity logging
  const { data: existing } = await supabase
    .from('task_submissions')
    .select('id')
    .eq('task_id', taskId)
    .eq('student_id', studentId)
    .is('task_group_id', null)
    .maybeSingle();

  // Invoke RPC for secure upsert
  const { data: submissionId, error } = await supabase
    .rpc('submit_individual_task', {
      task_id_input: taskId,
      student_id_input: studentId,
      submission_text_input: submissionText
    });

  if (error) throw error;

  // Log activity
  await logActivity(
    classId,
    existing ? 'task_resubmitted' : 'task_submitted',
    studentId,
    0,
    0,
    null,
    { task_id: taskId, task_title: taskTitle, submission_id: submissionId }
  );

  return { id: submissionId };
};

export const uploadAttachmentToStorage = async (
  classId: string,
  taskId: string,
  studentId: string,
  submissionId: string,
  file: File
): Promise<{ filePath: string; fileName: string }> => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${classId}/${taskId}/${studentId}/${submissionId}/${timestamp}-${safeName}`;

  const { data, error } = await supabase.storage
    .from('task-submissions')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;
  return { filePath, fileName: file.name };
};

export const addSubmissionAttachmentMetadata = async (metadataInput: {
  submission_id: string;
  task_id: string;
  class_id: string;
  student_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size_bytes: number;
}): Promise<any> => {
  const { data, error } = await supabase
    .rpc('add_submission_attachment_metadata', {
      submission_id_input: metadataInput.submission_id,
      task_id_input: metadataInput.task_id,
      class_id_input: metadataInput.class_id,
      student_id_input: metadataInput.student_id,
      file_name_input: metadataInput.file_name,
      file_path_input: metadataInput.file_path,
      file_type_input: metadataInput.file_type,
      file_size_bytes_input: metadataInput.file_size_bytes
    });

  if (error) throw error;

  // Log activity
  await logActivity(
    metadataInput.class_id,
    'task_attachment_uploaded',
    metadataInput.student_id,
    0,
    0,
    null,
    {
      task_id: metadataInput.task_id,
      submission_id: metadataInput.submission_id,
      file_name: metadataInput.file_name
    }
  );

  return { id: data };
};

export const deleteSubmissionAttachment = async (
  attachmentId: string,
  filePath: string,
  classId: string,
  studentId: string,
  taskId: string,
  submissionId: string
): Promise<void> => {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('task-submissions')
    .remove([filePath]);

  if (storageError) {
    console.warn('Could not delete file from storage bucket:', storageError);
  }

  // Delete from db using RPC
  const { error } = await supabase
    .rpc('delete_submission_attachment', {
      attachment_id_input: attachmentId,
      student_id_input: studentId,
      class_id_input: classId,
      task_id_input: taskId,
      submission_id_input: submissionId
    });

  if (error) throw error;
};

export const fetchStudentSubmission = async (
  taskId: string,
  studentId: string
): Promise<any | null> => {
  // Fetch submission
  const { data: submission, error: subError } = await supabase
    .from('task_submissions')
    .select('*')
    .eq('task_id', taskId)
    .eq('student_id', studentId)
    .is('task_group_id', null)
    .maybeSingle();

  if (subError) throw subError;
  if (!submission) return null;

  // Fetch attachments
  const { data: attachments, error: attachError } = await supabase
    .from('submission_attachments')
    .select('*')
    .eq('submission_id', submission.id);

  if (attachError) throw attachError;

  return {
    ...submission,
    attachments: attachments || []
  };
};

export const fetchTaskSubmissions = async (taskId: string, classId: string): Promise<any[]> => {
  // Fetch all submissions for this task with correct class_id filtering
  const { data: submissions, error: subError } = await supabase
    .from('task_submissions')
    .select(`
      *,
      students (
        name,
        nickname
      )
    `)
    .eq('task_id', taskId)
    .eq('class_id', classId);

  if (subError) throw subError;

  // Fetch all attachments for this task and class
  const { data: attachments, error: attachError } = await supabase
    .from('submission_attachments')
    .select('*')
    .eq('task_id', taskId)
    .eq('class_id', classId);

  if (attachError) throw attachError;

  return (submissions || []).map((sub: any) => {
    const subAttachments = (attachments || []).filter((a: any) => a.submission_id === sub.id);
    return {
      ...sub,
      studentName: sub.students?.nickname || sub.students?.name || 'Unknown Student',
      attachments: subAttachments
    };
  });
};

export const fetchSubmissionsByTask = async (taskId: string): Promise<any[]> => {
  // For backwards compatibility, find the class_id first from tasks
  const { data: task } = await supabase
    .from('tasks')
    .select('class_id')
    .eq('id', taskId)
    .maybeSingle();

  if (task?.class_id) {
    return fetchTaskSubmissions(taskId, task.class_id);
  }

  // Fallback
  const { data: submissions, error: subError } = await supabase
    .from('task_submissions')
    .select(`
      *,
      students (
        name,
        nickname
      )
    `)
    .eq('task_id', taskId);

  if (subError) throw subError;

  const { data: attachments, error: attachError } = await supabase
    .from('submission_attachments')
    .select('*')
    .eq('task_id', taskId);

  if (attachError) throw attachError;

  return (submissions || []).map((sub: any) => {
    const subAttachments = (attachments || []).filter((a: any) => a.submission_id === sub.id);
    return {
      ...sub,
      studentName: sub.students?.nickname || sub.students?.name || 'Unknown Student',
      attachments: subAttachments
    };
  });
};

export const getAttachmentSignedUrl = async (
  filePath: string
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from('task-submissions')
    .createSignedUrl(filePath, 3600); // 1 hour expiration

  if (error) throw error;
  return data.signedUrl;
};

export const reviewSubmission = async (
  submissionId: string,
  feedback: string,
  status: 'reviewed' | 'returned',
  score?: number
): Promise<any> => {
  const { data, error } = await supabase
    .from('task_submissions')
    .update({
      teacher_feedback: feedback,
      status: status,
      score: score,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

