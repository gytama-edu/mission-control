import React, { useState, useEffect } from 'react';
import { ClassData, Student, ActivityLog, Task, StudentBadge } from '../types';
import { ArrowLeft, Key, Rocket, Shield, Star, Trophy, Clock, LogOut, Loader2, CheckSquare, Users, Upload, FileText, Trash2, Paperclip, AlertTriangle, Check, CheckCircle, Award } from 'lucide-react';
import * as db from '../services/missionControlData';
import * as taskDb from '../services/taskData';
import * as badgeDb from '../services/badgeData';
import { supabase } from '../lib/supabaseClient';

interface StudentAccessProps {
  onBack: () => void;
}

const PROFILE_KEY = 'mission_control_student_profile';

export function StudentAccess({ onBack }: StudentAccessProps) {
  const [joinCode, setJoinCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [restoringProfile, setRestoringProfile] = useState(false);
  
  const [loggedInClass, setLoggedInClass] = useState<ClassData | null>(null);
  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(null);

  const [studentLogs, setStudentLogs] = useState<ActivityLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [isTableMissing, setIsTableMissing] = useState(false);

  // Badges state
  const [earnedBadges, setEarnedBadges] = useState<StudentBadge[]>([]);
  const [isBadgesLoading, setIsBadgesLoading] = useState(false);
  const [isBadgesTableMissing, setIsBadgesTableMissing] = useState(false);

  // Task states for student preview
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [isTasksTableMissing, setIsTasksTableMissing] = useState(false);
  const [studentGroups, setStudentGroups] = useState<Record<string, { id: string; name: string }>>({});
  const [groupMembers, setGroupMembers] = useState<Record<string, string[]>>({});
  const [studentSubmissions, setStudentSubmissions] = useState<Record<string, any>>({});

  const loadStudentTasks = async (classId: string, studentId: string) => {
    setIsTasksLoading(true);
    try {
      const allTasks = await taskDb.fetchTasksByClass(classId);
      const visibleTasks = allTasks.filter(t => t.status === 'published' || t.status === 'closed');
      setTasks(visibleTasks);
      setIsTasksTableMissing(false);

      // Fetch task groups assigned to this student
      const { data: memberRows, error: memberErr } = await supabase
        .from('task_group_members')
        .select(`
          task_id,
          task_group_id,
          task_groups (
            name
          )
        `)
        .eq('student_id', studentId);

      const groupMap: Record<string, { id: string; name: string }> = {};
      const groupIds: string[] = [];
      if (!memberErr && memberRows) {
        memberRows.forEach((row: any) => {
          if (row.task_groups && row.task_group_id) {
            const gName = Array.isArray(row.task_groups) 
              ? row.task_groups[0]?.name 
              : row.task_groups?.name;
            groupMap[row.task_id] = { id: row.task_group_id, name: gName };
            groupIds.push(row.task_group_id);
          }
        });
        setStudentGroups(groupMap);
      }

      // Fetch members of these student groups
      const membersMap: Record<string, string[]> = {};
      if (groupIds.length > 0) {
        const { data: allMembers, error: membersErr } = await supabase
          .from('task_group_members')
          .select(`
            task_group_id,
            students (
              name,
              nickname
            )
          `)
          .in('task_group_id', groupIds);

        if (!membersErr && allMembers) {
          allMembers.forEach((m: any) => {
            const gId = m.task_group_id;
            const sName = m.students 
              ? (m.students.nickname ? `${m.students.name} (${m.students.nickname})` : m.students.name) 
              : 'Unknown Student';
            if (!membersMap[gId]) {
              membersMap[gId] = [];
            }
            membersMap[gId].push(sName);
          });
          setGroupMembers(membersMap);
        }
      } else {
        setGroupMembers({});
      }

      // Fetch task submissions (individual + group)
      let subQuery = supabase.from('task_submissions').select('*');
      if (groupIds.length > 0) {
        subQuery = subQuery.or(`student_id.eq.${studentId},task_group_id.in.(${groupIds.join(',')})`);
      } else {
        subQuery = subQuery.eq('student_id', studentId);
      }
      const { data: subRows, error: subErr } = await subQuery.eq('class_id', classId);

      // Fetch submission attachments (individual + group)
      let attachQuery = supabase.from('submission_attachments').select('*');
      if (groupIds.length > 0) {
        attachQuery = attachQuery.or(`student_id.eq.${studentId},task_group_id.in.(${groupIds.join(',')})`);
      } else {
        attachQuery = attachQuery.eq('student_id', studentId);
      }
      const { data: attachRows, error: attachErr } = await attachQuery.eq('class_id', classId);

      if (!subErr && subRows) {
        const subMap: Record<string, any> = {};
        subRows.forEach((s: any) => {
          const sAttachments = (attachRows || []).filter((a: any) => a.submission_id === s.id);
          subMap[s.task_id] = {
            ...s,
            attachments: sAttachments
          };
        });
        setStudentSubmissions(subMap);
      }
    } catch (err: any) {
      if (err && (err.code === 'PGRST205' || (err.message && err.message.includes('tasks') && err.message.includes('schema cache')))) {
        setIsTasksTableMissing(true);
        console.warn('Tasks table is missing in Supabase. Mission Control is disabled for student until migration is run.');
      } else {
        console.error('Failed to load student tasks:', err);
      }
    } finally {
      setIsTasksLoading(false);
    }
  };

  const getSubmitterName = (sub: any) => {
    if (!sub || !sub.submitted_by_student_id || !loggedInClass || !loggedInStudent) return '';
    if (sub.submitted_by_student_id === loggedInStudent.id) return 'You';
    const found = loggedInClass.students?.find((s: any) => s.id === sub.submitted_by_student_id);
    return found ? (found.nickname ? `${found.name} (${found.nickname})` : found.name) : 'A classmate';
  };

  useEffect(() => {
    if (loggedInClass && loggedInStudent) {
      loadEarnedBadges(loggedInClass.id, loggedInStudent.id);
    } else {
      setEarnedBadges([]);
    }
  }, [loggedInClass?.id, loggedInStudent?.id]);

  useEffect(() => {
    if (!loggedInClass || !loggedInStudent) {
      setTasks([]);
      setStudentGroups({});
      return;
    }
    loadStudentTasks(loggedInClass.id, loggedInStudent.id);

    if (isTasksTableMissing) return;

    const tasksChannel = supabase
      .channel(`student-tasks-${loggedInStudent.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `class_id=eq.${loggedInClass.id}`
        },
        () => {
          if (loggedInClass && loggedInStudent) {
            loadStudentTasks(loggedInClass.id, loggedInStudent.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_group_members',
          filter: `student_id=eq.${loggedInStudent.id}`
        },
        () => {
          if (loggedInClass && loggedInStudent) {
            loadStudentTasks(loggedInClass.id, loggedInStudent.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
    };
  }, [loggedInClass?.id, loggedInStudent?.id, isTasksTableMissing]);

  // Student task submission states
  const [selectedTaskForSubmission, setSelectedTaskForSubmission] = useState<Task | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const openSubmissionModal = (task: Task) => {
    setSelectedTaskForSubmission(task);
    const existing = studentSubmissions[task.id];
    if (existing) {
      setSubmissionText(existing.submission_text || '');
    } else {
      setSubmissionText('');
    }
    setSubmissionFiles([]);
    setSubmissionError('');
    setSubmissionSuccess(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedTaskForSubmission) return;
    const filesArray = Array.from(e.target.files) as File[];
    
    // File validation!
    // 1. Check max attachments count
    if (filesArray.length > selectedTaskForSubmission.max_attachments) {
      setSubmissionError(`You can only upload up to ${selectedTaskForSubmission.max_attachments} file(s).`);
      return;
    }

    // 2. Check each file size and type
    const maxBytes = selectedTaskForSubmission.max_attachment_size_mb * 1024 * 1024;
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'video/mp4'
    ];

    for (const file of filesArray) {
      if (file.size > maxBytes) {
        setSubmissionError(`File "${file.name}" exceeds the size limit of ${selectedTaskForSubmission.max_attachment_size_mb}MB.`);
        return;
      }
      
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const allowedExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp', 'mp3', 'wav', 'mp4'];
      
      if (!allowedTypes.includes(file.type) && (!fileExt || !allowedExts.includes(fileExt))) {
        setSubmissionError(`File "${file.name}" has unsupported type. Allowed: PDF, DOC, DOCX, PPT, PPTX, JPG, JPEG, PNG, WEBP, MP3, WAV, MP4.`);
        return;
      }
    }

    setSubmissionError('');
    setSubmissionFiles(filesArray);
  };

  const handleDeleteExistingAttachment = async (attachmentId: string, filePath: string) => {
    if (!loggedInClass || !loggedInStudent || !selectedTaskForSubmission) return;
    const existingSub = studentSubmissions[selectedTaskForSubmission.id];
    if (!existingSub) return;

    try {
      await taskDb.deleteSubmissionAttachment(
        attachmentId,
        filePath,
        loggedInClass.id,
        loggedInStudent.id,
        selectedTaskForSubmission.id,
        existingSub.id
      );

      // Reload tasks and submissions to refresh the list of attachments
      await loadStudentTasks(loggedInClass.id, loggedInStudent.id);
    } catch (err: any) {
      console.error('Failed to delete attachment:', err);
      setSubmissionError(err.message || 'Failed to delete attachment.');
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInClass || !loggedInStudent || !selectedTaskForSubmission) return;

    // Determine if late
    const isLate = selectedTaskForSubmission.due_at 
      ? new Date() > new Date(selectedTaskForSubmission.due_at)
      : false;

    setIsSubmittingTask(true);
    setSubmissionError('');
    setSubmissionSuccess(false);

    try {
      let submission: { id: string };

      if (selectedTaskForSubmission.task_type === 'group') {
        const assignedGroup = studentGroups[selectedTaskForSubmission.id];
        if (!assignedGroup) {
          throw new Error('You are not assigned to a group for this task.');
        }

        // 1. Submit group task
        submission = await taskDb.submitGroupTask(
          selectedTaskForSubmission.id,
          loggedInClass.id,
          assignedGroup.id,
          loggedInStudent.id,
          submissionText || null
        );

        // 2. Upload group attachments
        if (selectedTaskForSubmission.allow_attachment_submission && submissionFiles.length > 0) {
          for (const file of submissionFiles) {
            const { filePath, fileName } = await taskDb.uploadGroupAttachmentToStorage(
              loggedInClass.id,
              selectedTaskForSubmission.id,
              assignedGroup.id,
              submission.id,
              file
            );

            await taskDb.addGroupSubmissionAttachmentMetadata({
              submission_id: submission.id,
              task_id: selectedTaskForSubmission.id,
              class_id: loggedInClass.id,
              submitted_by_student_id: loggedInStudent.id,
              task_group_id: assignedGroup.id,
              file_name: fileName,
              file_path: filePath,
              file_type: file.type || file.name.split('.').pop() || 'unknown',
              file_size_bytes: file.size
            });
          }
        }
      } else {
        // 1. Submit individual task
        submission = await taskDb.submitIndividualTask(
          selectedTaskForSubmission.id,
          loggedInClass.id,
          loggedInStudent.id,
          selectedTaskForSubmission.title,
          submissionText || null,
          isLate
        );

        // 2. Upload individual attachments
        if (selectedTaskForSubmission.allow_attachment_submission && submissionFiles.length > 0) {
          for (const file of submissionFiles) {
            const { filePath, fileName } = await taskDb.uploadAttachmentToStorage(
              loggedInClass.id,
              selectedTaskForSubmission.id,
              loggedInStudent.id,
              submission.id,
              file
            );

            await taskDb.addSubmissionAttachmentMetadata({
              submission_id: submission.id,
              task_id: selectedTaskForSubmission.id,
              class_id: loggedInClass.id,
              student_id: loggedInStudent.id,
              file_name: fileName,
              file_path: filePath,
              file_type: file.type || file.name.split('.').pop() || 'unknown',
              file_size_bytes: file.size
            });
          }
        }
      }

      setSubmissionSuccess(true);
      // Reload everything
      await loadStudentTasks(loggedInClass.id, loggedInStudent.id);
      await loadEarnedBadges(loggedInClass.id, loggedInStudent.id);
      
      // Keep modal open briefly to show success, then auto-close or let user dismiss
      setTimeout(() => {
        setSelectedTaskForSubmission(null);
      }, 1500);

    } catch (err: any) {
      console.error('Submission failed:', err);
      setSubmissionError(err.message || 'Failed to submit task. Please check your storage bucket configuration or contact teacher.');
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const loadEarnedBadges = async (classId: string, studentId: string) => {
    setIsBadgesLoading(true);
    try {
      // Background passive automatic badge evaluation
      await badgeDb.checkAndAwardAutomaticBadges(studentId, classId);
      // Retrieve earned badges list
      const badges = await badgeDb.fetchStudentBadges(classId, studentId);
      setEarnedBadges(badges);
      setIsBadgesTableMissing(false);
    } catch (err: any) {
      if (err && (err.code === 'PGRST205' || (err.message && (err.message.includes('badge_definitions') || err.message.includes('student_badges')) && err.message.includes('schema cache')))) {
        setIsBadgesTableMissing(true);
        console.warn('Badges tables are missing in Supabase. Badges display is disabled until migration is run.');
      } else {
        console.error('Failed to load earned badges:', err);
      }
    } finally {
      setIsBadgesLoading(false);
    }
  };

  const loadStudentLogs = async (classId: string, studentId: string) => {
    setIsLogsLoading(true);
    try {
      const logs = await db.fetchStudentActivityLogs(classId, studentId);
      setStudentLogs(logs);
      setIsTableMissing(false);
    } catch (err: any) {
      if (err && (err.code === 'PGRST205' || (err.message && err.message.includes('activity_logs') && err.message.includes('schema cache')))) {
        setIsTableMissing(true);
        console.warn('Activity logs table is missing in Supabase. Student log view is disabled until migration is run.');
      } else {
        console.error('Failed to load student activity logs:', err);
      }
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!loggedInClass || !loggedInStudent) {
      setStudentLogs([]);
      return;
    }
    const classId = loggedInClass.id;
    const studentId = loggedInStudent.id;
    loadStudentLogs(classId, studentId);

    if (isTableMissing) return;

    // Subscribe to realtime updates on activity_logs for this student
    const channel = supabase
      .channel(`student-logs-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_logs',
          filter: `student_id=eq.${studentId}`
        },
        () => {
          loadStudentLogs(classId, studentId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loggedInClass?.id, loggedInStudent?.id, isTableMissing]);

  // Auto-restore profile on refresh/mount
  useEffect(() => {
    const autoRestore = async () => {
      try {
        const saved = window.localStorage.getItem(PROFILE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.classId && parsed.studentId) {
            setRestoringProfile(true);
            setError('');
            const { classData, studentData } = await db.getStudentDashboardData(parsed.classId, parsed.studentId);
            if (classData && studentData) {
              setLoggedInClass(classData);
              setLoggedInStudent(studentData);
            } else {
              setError('Profile no longer exists. Please log in again.');
              window.localStorage.removeItem(PROFILE_KEY);
            }
          }
        }
      } catch (e) {
        console.error(e);
        setError('Failed to restore profile.');
      } finally {
        setRestoringProfile(false);
      }
    };
    autoRestore();
  }, []);

  const handleLogout = () => {
    window.localStorage.removeItem(PROFILE_KEY);
    setLoggedInClass(null);
    setLoggedInStudent(null);
    setJoinCode('');
    setPin('');
  };

  // Fetch the latest dashboard data helper
  const fetchDashboardData = async (classId: string, studentId: string) => {
    setIsLoading(true);
    setError('');
    try {
      const { classData, studentData } = await db.getStudentDashboardData(classId, studentId);
      if (classData && studentData) {
        setLoggedInClass(classData);
        setLoggedInStudent(studentData);
        loadStudentTasks(classId, studentId);
        // Automatically save session to localStorage when logged in successfully!
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify({
          classId,
          studentId,
        }));
      } else {
        setError('Profile no longer exists. Please log in again.');
        window.localStorage.removeItem(PROFILE_KEY);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect.');
    } finally {
      setIsLoading(false);
    }
  };

  // Realtime subscription setup
  useEffect(() => {
    if (!loggedInClass || !loggedInStudent) return;

    const classId = loggedInClass.id;
    const studentId = loggedInStudent.id;

    // Helper to refresh in background
    const refreshData = async () => {
      try {
        const { classData, studentData } = await db.getStudentDashboardData(classId, studentId);
        if (classData && studentData) {
          setLoggedInClass(classData);
          setLoggedInStudent(studentData);
          loadStudentTasks(classId, studentId);
        } else {
          // If data isn't found during refresh, they might have been deleted
          handleLogout();
          setError('Your profile or class has been removed by the teacher.');
        }
      } catch (err) {
        console.error("Failed to fetch updated real-time data:", err);
      }
    };

    // 1. Subscribe to the logged-in student row specifically (for instantaneous updates)
    const studentSubscription = supabase
      .channel(`student-self-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'students',
          filter: `id=eq.${studentId}`,
        },
        (payload) => {
          const updatedRow = payload.new as any;
          if (updatedRow) {
            setLoggedInStudent(prev => {
              if (!prev) return null;
              return {
                ...prev,
                name: updatedRow.name,
                nickname: updatedRow.nickname || '',
                lives: updatedRow.lives,
                points: updatedRow.points,
                pin: updatedRow.pin,
              };
            });
          }
          // Also trigger background refresh of full class data to keep things in perfect sync
          refreshData();
        }
      )
      .subscribe();

    // 2. Subscribe to all student changes in the same class (to recalculate rank/leaderboard)
    const classStudentsSubscription = supabase
      .channel(`class-students-${classId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          // If logged-in student got deleted, log them out!
          if (payload.eventType === 'DELETE' && payload.old && (payload.old as any).id === studentId) {
            handleLogout();
            setError('Your student profile was removed by the teacher.');
            return;
          }
          // Otherwise pull fresh class list/rankings
          refreshData();
        }
      )
      .subscribe();

    // 3. Subscribe to current class detail updates (e.g., changing maxLives, level, or name, or DELETE)
    const classSubscription = supabase
      .channel(`class-details-${classId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'classes',
          filter: `id=eq.${classId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            handleLogout();
            setError('This class has been deleted by the teacher.');
            return;
          }
          refreshData();
        }
      )
      .subscribe();

    // 4. Subscribe to meetings updates (start/end) for this class
    const meetingsSubscription = supabase
      .channel(`class-meetings-${classId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings',
          filter: `class_id=eq.${classId}`,
        },
        () => {
          refreshData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentSubscription);
      supabase.removeChannel(classStudentsSubscription);
      supabase.removeChannel(classSubscription);
      supabase.removeChannel(meetingsSubscription);
    };
  }, [loggedInClass?.id, loggedInStudent?.id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const normalizedEnteredCode = joinCode.trim().toUpperCase();
    const normalizedEnteredPin = pin.trim();

    try {
      const targetClass = await db.findClassByJoinCode(normalizedEnteredCode);
      if (!targetClass) {
        setError('Class code not found.');
        setIsLoading(false);
        return;
      }

      const student = await db.findStudentByClassAndPin(targetClass.id, normalizedEnteredPin);
      if (!student) {
        setError('PIN not found in this class.');
        setIsLoading(false);
        return;
      }

      await fetchDashboardData(targetClass.id, student.id);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
      setIsLoading(false);
    }
  };

  if (restoringProfile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
          <Loader2 className="mx-auto h-12 w-12 text-emerald-500 animate-spin mb-4" />
          <p className="text-slate-400">Loading student profile...</p>
        </div>
      </div>
    );
  }


  if (loggedInClass && loggedInStudent) {
    const student = loggedInStudent;
    const status = student.lives === 0 ? 'Out' : student.lives <= loggedInClass.maxLives / 2 ? 'Warning' : 'Safe';
    const statusColor = status === 'Out' ? 'text-red-500 bg-red-500/10 border-red-500/20' 
      : status === 'Warning' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
      : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';

    const sortedStudents = [...loggedInClass.students].sort((a, b) => b.points - a.points);
    const rank = sortedStudents.findIndex(s => s.id === student.id) + 1;

    const activeMeeting = loggedInClass.meetings.find(m => m.status === 'active');

    const latestMeeting = loggedInClass.meetings.length > 0 
      ? new Date(loggedInClass.meetings[loggedInClass.meetings.length - 1].startedAt).toLocaleDateString()
      : 'No meetings yet';

    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Rocket className="text-emerald-500" /> Mission Control
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => fetchDashboardData(loggedInClass.id, student.id)}
              className="text-slate-400 hover:text-white transition-colors"
              title="Refresh Data"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Refresh'}
            </button>
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-display font-bold text-white mb-1">{student.nickname || student.name}</h2>
                  <p className="text-slate-400 flex items-center gap-2">
                    Class: <span className="text-white font-medium">{loggedInClass.name}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className={`px-3 py-1 rounded-lg text-sm font-medium border ${statusColor}`}>
                    Status: {status}
                  </div>
                  {activeMeeting ? (
                    <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Class Session Active
                    </span>
                  ) : (
                    <span className="bg-slate-850 text-slate-500 border border-slate-800 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                      No Active Session
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-slate-400 mb-2 font-medium">
                    <Shield size={16} className="text-red-400" /> Lives
                  </div>
                  <div className="text-3xl font-mono font-bold text-white">
                    {student.lives} <span className="text-lg text-slate-500">/ {loggedInClass.maxLives}</span>
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-slate-400 mb-2 font-medium">
                    <Star size={16} className="text-yellow-400" /> Points
                  </div>
                  <div className="text-3xl font-mono font-bold text-yellow-400">
                    {student.points}
                  </div>
                </div>
              </div>
            </div>

            {/* Classroom Tasks & Missions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <CheckSquare size={18} className="text-purple-400" /> Classroom Tasks & Missions
              </h3>

              {isTasksTableMissing ? (
                <div className="py-8 px-4 text-center bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-2 animate-fade-in">
                  <div className="text-slate-500 font-mono text-sm font-semibold">🛰️ Mission Control Offline</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed italic">
                    The classroom task board is currently offline. Your commander (teacher) is configuring the sub-database tables. Stay tuned, explorer!
                  </p>
                </div>
              ) : isTasksLoading ? (
                <div className="py-6 text-center text-slate-500 text-sm font-medium">Loading missions...</div>
              ) : tasks.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm bg-slate-950/40 rounded-xl border border-slate-800/60 italic">
                  No active tasks assigned yet. Stay tuned, explorer!
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => {
                    const assignedGroup = studentGroups[task.id];
                    const isClosed = task.status === 'closed';

                    const submission = studentSubmissions[task.id];
                    const submitterName = getSubmitterName(submission);
                    const formattedSubTime = submission ? new Date(submission.created_at).toLocaleString() : '';

                    let submissionStatus = 'Not submitted';
                    let statusBadgeColor = 'bg-slate-900 text-slate-500 border-slate-800';

                    if (submission) {
                      if (submission.status === 'reviewed') {
                        submissionStatus = 'Reviewed';
                        statusBadgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                      } else if (submission.status === 'returned') {
                        submissionStatus = 'Returned';
                        statusBadgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                      } else if (submission.status === 'late') {
                        submissionStatus = 'Late Submission';
                        statusBadgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                      } else {
                        submissionStatus = 'Submitted';
                        statusBadgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                      }
                    }

                    let subTypeLabel = '';
                    if (task.allow_text_submission && task.allow_attachment_submission) {
                      subTypeLabel = 'Text & Attachment';
                    } else if (task.allow_text_submission) {
                      subTypeLabel = 'Text Response';
                    } else if (task.allow_attachment_submission) {
                      subTypeLabel = 'Attachment Upload';
                    } else {
                      subTypeLabel = 'No submission required';
                    }

                    return (
                      <div
                        key={task.id}
                        className={`bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-3 transition-all relative ${
                          isClosed ? 'opacity-70' : 'border-purple-500/10 hover:border-purple-500/20'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${
                              isClosed
                                ? 'bg-slate-900 text-slate-500 border-slate-800'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {isClosed ? 'Closed' : 'Active Mission'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-slate-400 border border-slate-800 capitalize">
                              {task.task_type}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border capitalize ${statusBadgeColor}`}>
                              {submissionStatus}
                            </span>
                          </div>

                          <span className="text-yellow-500 text-xs font-mono font-bold flex items-center gap-1 bg-yellow-500/5 px-2 py-0.5 rounded border border-yellow-500/10">
                            ⭐ {task.reward_points} pts
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-white leading-snug">{task.title}</h4>
                          {task.description && (
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed whitespace-pre-wrap">{task.description}</p>
                          )}
                          {submission && task.task_type === 'group' && (
                            <div className="text-[10px] text-slate-500 font-mono mt-1.5 flex items-center gap-1">
                              <span>📢 Submitted by</span>
                              <span className="text-slate-300 font-semibold">{submitterName}</span>
                              <span>on {formattedSubTime}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 bg-slate-900/40 p-2 rounded-lg border border-slate-850">
                          <div>
                            <span className="text-slate-500">Submission:</span> <span className="font-medium text-slate-300">{subTypeLabel}</span>
                          </div>
                          {task.allow_attachment_submission && (
                            <div>
                              <span className="text-slate-500">Files Max:</span> <span className="font-mono font-medium text-slate-300">{task.max_attachments} • {task.max_attachment_size_mb}MB each</span>
                            </div>
                          )}
                        </div>

                        {submission && (submission.awarded_points !== undefined && submission.awarded_points !== null) && (
                          <div className="bg-yellow-500/5 border border-yellow-500/10 p-2.5 rounded-lg text-xs space-y-1">
                            <span className="font-bold text-yellow-500 flex items-center gap-1">⭐ Points Awarded: {submission.awarded_points} / {task.reward_points} pts</span>
                            {submission.teacher_feedback && (
                              <p className="text-slate-300 italic">💬 Feedback: "{submission.teacher_feedback}"</p>
                            )}
                          </div>
                        )}

                        {task.task_type === 'group' && (
                          <div className="bg-slate-900/65 border border-slate-850 rounded-lg p-2.5 space-y-1.5 text-xs animate-fade-in">
                            <div className="flex items-center gap-2">
                              <Users className="text-purple-400" size={14} />
                              {assignedGroup ? (
                                <span className="text-slate-300 font-medium">
                                  Assigned Team: <span className="text-purple-400 font-bold">{assignedGroup.name}</span>
                                </span>
                              ) : (
                                <span className="text-amber-500 font-medium italic">
                                  You are not assigned to a group for this task yet. Please contact your teacher.
                                </span>
                              )}
                            </div>
                            {assignedGroup && groupMembers[assignedGroup.id] && (
                              <div className="text-[11px] text-slate-500 pl-5">
                                <span className="text-slate-400 font-medium font-sans">Members:</span> {groupMembers[assignedGroup.id].join(', ')}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-900/60 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            📅 Due: {task.due_at ? new Date(task.due_at).toLocaleString() : 'No due date set'}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => {
                              if (task.task_type === 'group' && !assignedGroup) return;
                              openSubmissionModal(task);
                            }}
                            disabled={isClosed || (task.task_type === 'group' && !assignedGroup)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isClosed
                                ? 'bg-slate-900 text-slate-500 border border-slate-850 cursor-not-allowed'
                                : (task.task_type === 'group' && !assignedGroup)
                                ? 'bg-slate-900 text-slate-600 border border-slate-850 cursor-not-allowed'
                                : submission
                                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md animate-pulse hover:animate-none'
                            }`}
                          >
                            {(task.task_type === 'group' && !assignedGroup)
                              ? 'Unassigned'
                              : isClosed
                              ? 'View Submission'
                              : submission
                              ? 'Update Submission'
                              : 'Open Mission Form'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My Recent Updates (Personal Timeline) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                <Clock size={18} className="text-indigo-400" /> My Recent Updates
              </h3>
              
              {isTableMissing ? (
                <div className="py-4 text-center text-slate-500 text-xs italic leading-relaxed">
                  Timeline features are disabled until the database tables are initialized in Supabase by the teacher.
                </div>
              ) : isLogsLoading && studentLogs.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm font-medium">Loading history...</div>
              ) : studentLogs.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm">
                  No point or life updates recorded yet. Keep up the good work!
                </div>
              ) : (
                <div className="space-y-3">
                  {studentLogs.map((log) => {
                    const isPoints = log.action_type === 'points_changed';
                    const isLives = log.action_type === 'lives_changed';
                    const isUndone = log.undone;

                    let title = '';
                    let badgeColor = 'bg-slate-800 text-slate-400 border border-slate-750';

                    if (isPoints) {
                      const delta = log.points_delta || 0;
                      const sign = delta > 0 ? '+' : '';
                      title = `${sign}${delta} Points`;
                      badgeColor = delta > 0 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20';
                    } else if (isLives) {
                      const delta = log.lives_delta || 0;
                      const sign = delta > 0 ? '+' : '';
                      title = `${sign}${delta} Lives`;
                      badgeColor = delta > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20';
                    } else {
                      title = 'Update';
                    }

                    return (
                      <div
                        key={log.id}
                        className={`bg-slate-950 border border-slate-800/60 rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all ${
                          isUndone ? 'opacity-45 select-none' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold shrink-0 border ${badgeColor}`}>
                            {title}
                          </span>
                          <div className="space-y-1">
                            {log.reason ? (
                              <p className={`text-sm font-medium text-slate-200 ${isUndone ? 'line-through' : ''}`}>
                                "{log.reason}"
                              </p>
                            ) : (
                              <p className={`text-sm text-slate-400 ${isUndone ? 'line-through' : ''}`}>
                                {isPoints ? (log.points_delta! > 0 ? 'Earned points' : 'Lost points') : (log.lives_delta! > 0 ? 'Restored lives' : 'Lost lives')}
                              </p>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono block font-sans">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {isUndone && (
                          <span className="text-xs bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-md font-bold font-mono shrink-0">
                            UNDONE
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" /> Leaderboard Info
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <span className="text-slate-400">Your Rank</span>
                  <span className="font-mono font-bold text-white">#{rank > 0 ? rank : '-'}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <span className="text-slate-400">Total Students</span>
                  <span className="font-mono font-bold text-white">{loggedInClass.students.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1"><Clock size={14} /> Last Meeting</span>
                  <span className="text-sm font-medium text-slate-300">{latestMeeting}</span>
                </div>
              </div>
            </div>

            {/* Achievements & Badges Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-lg font-display font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Award size={18} className="text-purple-400" /> Achievements
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {earnedBadges.length} Earned
                </span>
              </h3>

              {isBadgesTableMissing ? (
                <div className="py-8 px-4 text-center bg-slate-950/40 rounded-xl border border-slate-850 text-slate-500 text-xs italic space-y-1">
                  <p>Achievements Module Offline</p>
                  <p className="text-[10px] text-slate-600 font-sans leading-relaxed">
                    Ask your classroom Commander (teacher) to complete the database migration inside Class Settings to activate badges and achievements!
                  </p>
                </div>
              ) : isBadgesLoading && earnedBadges.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm font-medium">Scanning cockpit...</div>
              ) : earnedBadges.length === 0 ? (
                <div className="py-8 px-4 text-center bg-slate-950/40 rounded-xl border border-slate-850 text-slate-500 text-xs italic space-y-1">
                  <p>No badges earned yet.</p>
                  <p className="text-[10px] text-slate-600 font-sans leading-relaxed">
                    Complete tasks, maintain perfect flight status, or impress your teacher to unlock achievements!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {earnedBadges.map((sb) => {
                    const badge = sb.badge;
                    if (!badge) return null;
                    return (
                      <div
                        key={sb.id}
                        className="bg-slate-950 border border-slate-850/80 rounded-xl p-3.5 space-y-2 transition-all hover:border-purple-500/20 animate-fade-in"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl shrink-0" role="img" aria-label={badge.name}>
                            {badge.icon || '🏅'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-white truncate">{badge.name}</h4>
                            <p className="text-[10px] text-slate-400 line-clamp-2 leading-normal mt-0.5">
                              {badge.description}
                            </p>
                          </div>
                        </div>

                        {sb.awarded_reason && (
                          <div className="bg-slate-900/60 p-2 rounded text-[10px] text-slate-300 italic border border-slate-850/40">
                            💬 "{sb.awarded_reason}"
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono border-t border-slate-900/40 pt-2 font-sans">
                          <span className="capitalize text-slate-400">
                            {sb.source === 'automatic' ? '🤖 System Unlocked' : '⭐ Commander Handed'}
                          </span>
                          <span>
                            {new Date(sb.awarded_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Submission Modal */}
        {selectedTaskForSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <CheckSquare size={18} className="text-purple-400" />
                    {selectedTaskForSubmission.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Reward: <span className="text-yellow-500 font-semibold font-mono">⭐ {selectedTaskForSubmission.reward_points} pts</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTaskForSubmission(null)}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {/* Task Details */}
                {selectedTaskForSubmission.description && (
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Mission Directive</h4>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedTaskForSubmission.description}</p>
                  </div>
                )}

                {/* Due Date Indicator */}
                <div className="flex items-center gap-2 text-xs bg-slate-950 border border-slate-850 p-3 rounded-xl">
                  <Clock size={14} className="text-slate-500" />
                  <span className="text-slate-400">
                    📅 Due: {selectedTaskForSubmission.due_at ? new Date(selectedTaskForSubmission.due_at).toLocaleString() : 'No due date'}
                  </span>
                  {selectedTaskForSubmission.due_at && new Date() > new Date(selectedTaskForSubmission.due_at) && (
                    <span className="text-red-400 font-mono font-extrabold uppercase bg-red-500/10 px-1.5 py-0.5 rounded ml-auto text-[9px] border border-red-500/20">
                      LATE
                    </span>
                  )}
                </div>

                {/* Existing Submission Details */}
                {studentSubmissions[selectedTaskForSubmission.id] && (
                  <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Saved Submission</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
                        studentSubmissions[selectedTaskForSubmission.id].status === 'reviewed'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : studentSubmissions[selectedTaskForSubmission.id].status === 'returned'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : studentSubmissions[selectedTaskForSubmission.id].status === 'late'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {studentSubmissions[selectedTaskForSubmission.id].status}
                      </span>
                    </div>

                    {studentSubmissions[selectedTaskForSubmission.id].submission_text && (
                      <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-850 italic">
                        "{studentSubmissions[selectedTaskForSubmission.id].submission_text}"
                      </div>
                    )}

                    {studentSubmissions[selectedTaskForSubmission.id].awarded_points !== undefined && 
                     studentSubmissions[selectedTaskForSubmission.id].awarded_points !== null && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg text-xs space-y-1">
                        <div className="font-bold text-yellow-500 flex items-center gap-1">⭐ Points Awarded:</div>
                        <p className="text-white font-mono font-bold text-sm">
                          {studentSubmissions[selectedTaskForSubmission.id].awarded_points} / {selectedTaskForSubmission.reward_points} pts
                        </p>
                      </div>
                    )}

                    {/* Teacher Feedback if reviewed/returned */}
                    {studentSubmissions[selectedTaskForSubmission.id].teacher_feedback && (
                      <div className="bg-purple-950/25 border border-purple-900/40 p-3 rounded-lg text-xs space-y-1">
                        <div className="font-bold text-purple-400 flex items-center gap-1">💬 Teacher Feedback:</div>
                        <p className="text-slate-300 italic">{studentSubmissions[selectedTaskForSubmission.id].teacher_feedback}</p>
                      </div>
                    )}

                    {/* Attachments list if any */}
                    {studentSubmissions[selectedTaskForSubmission.id].attachments && 
                     studentSubmissions[selectedTaskForSubmission.id].attachments.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Saved Attachments:</h5>
                        <div className="space-y-1.5">
                          {studentSubmissions[selectedTaskForSubmission.id].attachments.map((file: any) => (
                            <div key={file.id} className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-850 text-xs">
                              <span className="text-slate-300 font-mono flex items-center gap-1.5 truncate">
                                <Paperclip size={12} className="text-slate-500 shrink-0" />
                                {file.file_name}
                              </span>
                              {selectedTaskForSubmission.status !== 'closed' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExistingAttachment(file.id, file.file_path)}
                                  className="text-red-400 hover:text-red-300 p-1 transition-colors hover:bg-red-500/10 rounded"
                                  title="Delete attachment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Submission form */}
                {selectedTaskForSubmission.status === 'closed' ? (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl flex items-center gap-2.5 text-xs">
                    <AlertTriangle size={16} />
                    <span>This task is closed. You can no longer make or update submissions.</span>
                  </div>
                ) : submissionSuccess ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium">
                    <CheckCircle size={16} />
                    <span>Directive logged! Transmitting to commander...</span>
                  </div>
                ) : (
                  <form onSubmit={handleTaskSubmit} className="space-y-4">
                    {/* Text Area Input */}
                    {selectedTaskForSubmission.allow_text_submission && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Your Text Answer
                        </label>
                        <textarea
                          rows={4}
                          value={submissionText}
                          onChange={(e) => setSubmissionText(e.target.value)}
                          placeholder="Type your response or directive log here..."
                          required={!selectedTaskForSubmission.allow_attachment_submission}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    )}

                    {/* File Attachment Upload */}
                    {selectedTaskForSubmission.allow_attachment_submission && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Upload Files & Documentations
                        </label>
                        <div className="border border-dashed border-slate-800 bg-slate-950 hover:bg-slate-950/65 rounded-xl p-4 text-center cursor-pointer transition-colors relative">
                          <input
                            type="file"
                            multiple
                            maxLength={selectedTaskForSubmission.max_attachments}
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <Upload className="mx-auto text-slate-500 mb-2" size={20} />
                          <p className="text-xs text-slate-400">Drag or browse to attach files</p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Up to {selectedTaskForSubmission.max_attachments} file(s) • Max size: {selectedTaskForSubmission.max_attachment_size_mb}MB each
                          </p>
                        </div>

                        {/* Selected files listing */}
                        {submissionFiles.length > 0 && (
                          <div className="space-y-1.5">
                            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Selected files to upload:</h5>
                            <div className="space-y-1">
                              {submissionFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-850 text-xs">
                                  <span className="text-slate-300 font-mono flex items-center gap-1.5 truncate">
                                    <FileText size={12} className="text-slate-500 shrink-0" />
                                    {file.name}
                                    <span className="text-[10px] text-slate-500">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSubmissionFiles(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-red-400 hover:text-red-300 p-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {submissionError && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-center gap-2 text-xs">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>{submissionError}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedTaskForSubmission(null)}
                        className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingTask}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                      >
                        {isSubmittingTask ? (
                          <>
                            <Loader2 className="animate-spin" size={14} /> Transmitting...
                          </>
                        ) : studentSubmissions[selectedTaskForSubmission.id] ? (
                          'Update Submission'
                        ) : (
                          'Submit Directive'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-4">
      <header className="mb-auto">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors w-fit"
        >
          <ArrowLeft size={20} /> Back to Main
        </button>
      </header>

      <div className="w-full max-w-md mx-auto my-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <Rocket className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
          <h1 className="text-3xl font-display font-bold text-white mb-2">Student Access</h1>
          <p className="text-slate-400">Enter your credentials to view your status.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Class Code</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. SPACE1"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Student PIN</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="password"
                required
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-digit PIN"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold transition-colors mt-2 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Access Dashboard'}
          </button>
        </form>
      </div>
      <div className="mt-auto" />
    </div>
  );
}
