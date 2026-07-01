import React, { useState, useEffect } from 'react';
import { ClassData, Student, ActivityLog, Task, StudentBadge } from '../types';
import { ArrowLeft, Key, Rocket, Shield, Star, Trophy, Clock, LogOut, Loader2, CheckSquare, Users, Upload, FileText, Trash2, Paperclip, AlertTriangle, Check, CheckCircle, Award, GraduationCap, X } from 'lucide-react';
import * as db from '../services/missionControlData';
import * as taskDb from '../services/taskData';
import * as badgeDb from '../services/badgeData';
import { getEffectiveClassroomMode } from '../utils/classroomUtils';
import { supabase } from '../lib/supabaseClient';

interface StudentAccessProps {
  onBack: () => void;
}

const PROFILE_KEY = 'mission_control_student_profile';

const countWords = (value: string | null): number => {
  const text = (value || "").trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

export function StudentAccess({ onBack }: StudentAccessProps) {
  const [joinCode, setJoinCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
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
    // Disabled in Phase 18G - Data fetched via RPC in fetchDashboardData
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

    // Disabled in Phase 18I - Data fetched via polling/visibility changes instead
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
      const saved = window.localStorage.getItem(PROFILE_KEY);
      const p = saved ? JSON.parse(saved).pin : pin;
      if (p) {
        await fetchDashboardData(loggedInClass.id, loggedInStudent.id, p);
      }
      
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
    // Disabled in Phase 18G - Data fetched via RPC in fetchDashboardData
  };

  const loadStudentLogs = async (classId: string, studentId: string) => {
    // Disabled in Phase 18G - Data fetched via RPC in fetchDashboardData
  };

  useEffect(() => {
    if (!loggedInClass || !loggedInStudent) {
      setStudentLogs([]);
      return;
    }
    const classId = loggedInClass.id;
    const studentId = loggedInStudent.id;
    loadStudentLogs(classId, studentId);

    // Disabled in Phase 18I - Data fetched via polling/visibility changes instead
  }, [loggedInClass?.id, loggedInStudent?.id, isTableMissing]);

  // Auto-restore profile on refresh/mount
  useEffect(() => {
    const autoRestore = async () => {
      try {
        const saved = window.localStorage.getItem(PROFILE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.classId && parsed.studentId && parsed.pin) {
            setRestoringProfile(true);
            setError('');
            const result = await db.fetchStudentDashboardDataSecure(parsed.classId, parsed.studentId, parsed.pin);
            if (result.ok && result.classData && result.studentData) {
              setLoggedInClass(result.classData);
              setLoggedInStudent(result.studentData);
              setTasks(result.tasks || []);
              setStudentGroups(
                (result.taskGroups || []).reduce((acc: any, tg: any) => ({ ...acc, [tg.task_id]: { id: tg.task_group_id, name: tg.name } }), {})
              );
              setGroupMembers(
                (result.groupMembers || []).reduce((acc: any, m: any) => {
                  const sName = m.student_nickname ? `${m.student_name} (${m.student_nickname})` : m.student_name;
                  if (!acc[m.task_group_id]) acc[m.task_group_id] = [];
                  acc[m.task_group_id].push(sName);
                  return acc;
                }, {})
              );
              
              const subMap: Record<string, any> = {};
              (result.submissions || []).forEach((s: any) => {
                const sAttachments = (result.attachments || []).filter((a: any) => a.submission_id === s.id);
                subMap[s.task_id] = { ...s, attachments: sAttachments };
              });
              setStudentSubmissions(subMap);
              
              setEarnedBadges(result.badges || []);
              setStudentLogs(result.logs || []);
            } else {
              if (result.reason === 'archived_class') {
                setError('This class is currently archived. Please contact your teacher.');
              } else if (result.reason === 'invalid_session') {
                setError('Your session could not be verified. Please log in again.');
              } else {
                setError('Profile no longer exists. Please log in again.');
              }
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
  const fetchDashboardData = async (classId: string, studentId: string, studentPin: string) => {
    setIsLoading(true);
    setError('');
    try {
      const result = await db.fetchStudentDashboardDataSecure(classId, studentId, studentPin);
      if (result.ok && result.classData && result.studentData) {
        setLoggedInClass(result.classData);
        setLoggedInStudent(result.studentData);
        setTasks(result.tasks || []);
        setStudentGroups(
          (result.taskGroups || []).reduce((acc: any, tg: any) => ({ ...acc, [tg.task_id]: { id: tg.task_group_id, name: tg.name } }), {})
        );
        setGroupMembers(
          (result.groupMembers || []).reduce((acc: any, m: any) => {
            const sName = m.student_nickname ? `${m.student_name} (${m.student_nickname})` : m.student_name;
            if (!acc[m.task_group_id]) acc[m.task_group_id] = [];
            acc[m.task_group_id].push(sName);
            return acc;
          }, {})
        );
        
        const subMap: Record<string, any> = {};
        (result.submissions || []).forEach((s: any) => {
          const sAttachments = (result.attachments || []).filter((a: any) => a.submission_id === s.id);
          subMap[s.task_id] = { ...s, attachments: sAttachments };
        });
        setStudentSubmissions(subMap);
        
        setEarnedBadges(result.badges || []);
        setStudentLogs(result.logs || []);
        
        setLastSynced(new Date());
        
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify({
          classId,
          studentId,
          pin: studentPin,
        }));
      } else {
        handleLogout();
        if (result.reason === 'archived_class') {
          setError('This class is currently archived. Please contact your teacher.');
        } else if (result.reason === 'invalid_session') {
          setError('Your session could not be verified. Please log in again.');
        } else {
          setError('Profile no longer exists. Please log in again.');
        }
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
        const saved = window.localStorage.getItem(PROFILE_KEY);
        const savedPin = saved ? JSON.parse(saved).pin : pin;
        if (!savedPin) return;
        const result = await db.fetchStudentDashboardDataSecure(classId, studentId, savedPin);
        if (result.ok && result.classData && result.studentData) {
          setLoggedInClass(result.classData);
          setLoggedInStudent(result.studentData);
          setTasks(result.tasks || []);
          setStudentGroups(
            (result.taskGroups || []).reduce((acc: any, tg: any) => ({ ...acc, [tg.task_id]: { id: tg.task_group_id, name: tg.name } }), {})
          );
          setGroupMembers(
            (result.groupMembers || []).reduce((acc: any, m: any) => {
              const sName = m.student_nickname ? `${m.student_name} (${m.student_nickname})` : m.student_name;
              if (!acc[m.task_group_id]) acc[m.task_group_id] = [];
              acc[m.task_group_id].push(sName);
              return acc;
            }, {})
          );
          
          const subMap: Record<string, any> = {};
          (result.submissions || []).forEach((s: any) => {
            const sAttachments = (result.attachments || []).filter((a: any) => a.submission_id === s.id);
            subMap[s.task_id] = { ...s, attachments: sAttachments };
          });
          setStudentSubmissions(subMap);
          
          setEarnedBadges(result.badges || []);
          setStudentLogs(result.logs || []);
        } else {
          // If data isn't found or session is invalid, log them out
          handleLogout();
          if (result.reason === 'archived_class') {
            setError('This class is currently archived. Please contact your teacher.');
          } else if (result.reason === 'invalid_session') {
            setError('Your session could not be verified. Please log in again.');
          } else {
            setError('Your profile or class has been removed by the teacher.');
          }
        }
      } catch (err) {
        console.error("Failed to fetch updated real-time data:", err);
      }
    };

    // 1. Polling interval (e.g., every 30 seconds)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    }, 30000);

    // 2. Visibility change listener (refresh when tab becomes visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loggedInClass?.id, loggedInStudent?.id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const normalizedEnteredCode = joinCode.trim().toUpperCase();
    const normalizedEnteredPin = pin.trim();

    try {
      // Use the secure RPC foundation for Phase 18E
      const result = await db.loginStudentByCodeAndPin(normalizedEnteredCode, normalizedEnteredPin);

      if (!result.ok) {
        if (result.reason === 'archived_class') {
          setError('This class is currently archived. Please contact your teacher.');
        } else {
          setError('Class Code or PIN is incorrect. Please check with your teacher.');
        }
        setIsLoading(false);
        return;
      }

      if (result.classData && result.studentData) {
        await fetchDashboardData(result.classData.id, result.studentData.id, normalizedEnteredPin);
      } else {
        setError('Login failed. Please try again.');
        setIsLoading(false);
      }
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

    // Calculate today's progress
    const todayStr = new Date().toDateString();
    const todayLogs = studentLogs.filter(log => {
      if (log.undone) return false;
      const logDate = new Date(log.created_at).toDateString();
      return logDate === todayStr && typeof log.points_delta === 'number';
    });

    const todayPointsDelta = todayLogs.reduce((acc, log) => acc + (log.points_delta || 0), 0);
    const latestLog = todayLogs.length > 0 ? todayLogs[0] : null;

    // Calculate recent progress (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentLogs = studentLogs.filter(log => {
      if (log.undone) return false;
      const logDate = new Date(log.created_at);
      return logDate >= sevenDaysAgo && typeof log.points_delta === 'number';
    });
    const recentPointsDelta = recentLogs.reduce((acc, log) => acc + (log.points_delta || 0), 0);

    const isPointsOnly = getEffectiveClassroomMode(loggedInClass.category, loggedInClass.scoring_system) === 'points';
    const isPrivate = loggedInClass.category === 'private';

    const showRankCard = !isPrivate;
    const showLivesCard = !isPointsOnly;

    // Private + Points needs 2 extra cards to fill the row (Today's Progress & Recent Progress)
    const showRecentProgressCard = isPrivate && isPointsOnly;


    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 select-none">
        {/* Compact Polished Header */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900/60 pb-4">
          <div>
            <h1 className="text-xl font-display font-black text-white flex items-center gap-2 tracking-tight">
              <Rocket className="text-emerald-500" size={20} /> Mission Control
            </h1>
            <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 block uppercase">
              Presented by GYTama EDU
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col items-end">
              <button
                onClick={() => {
                  const saved = window.localStorage.getItem(PROFILE_KEY);
                  const p = saved ? JSON.parse(saved).pin : pin;
                  if (p) fetchDashboardData(loggedInClass.id, student.id, p);
                }}
                className="text-xs font-semibold text-slate-400 hover:text-white transition-all bg-slate-900/60 hover:bg-slate-900 border border-slate-800/85 hover:border-slate-700/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer focus:outline-none relative"
                title="Sync: Updates your points, tasks, feedback, and badges."
              >
                {isLoading ? (
                  <Loader2 size={13} className="animate-spin text-emerald-400" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
                <span>{isLoading ? 'Syncing...' : 'Sync'}</span>
              </button>
              {lastSynced && !isLoading && (
                <span className="text-[8px] text-slate-500 whitespace-nowrap mt-0.5 pr-1 hidden sm:block">
                  Last: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <button 
              onClick={handleLogout}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-all bg-slate-900/60 hover:bg-slate-900 border border-slate-800/85 hover:border-slate-700/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </header>

        {/* Real-time active meeting alert banner */}
        {activeMeeting && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg select-none animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Class Meeting in Session</p>
                <p className="text-[11px] text-slate-400 leading-normal">Your teacher is hosting a meeting. Complete tasks to earn points in real-time!</p>
              </div>
            </div>
          </div>
        )}

        {/* Student Terminal Summary Area */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 mb-6 shadow-xl relative overflow-hidden select-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block font-mono">Student Profile</span>
              <h2 className="text-2xl font-display font-bold text-white tracking-tight mt-0.5">{student.nickname || student.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                <span>Class: <strong className="text-slate-200">{loggedInClass.name}</strong></span>
                {loggedInClass.level && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>Level: <strong className="text-slate-200">{loggedInClass.level}</strong></span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1.5">
              {showLivesCard && (
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border select-none ${statusColor}`}>
                  Status: {status}
                </span>
              )}
              {!activeMeeting && (
                <span className="bg-slate-900/60 text-slate-500 border border-slate-850 px-2.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider">
                  No Active Session
                </span>
              )}
            </div>
          </div>

          {/* Core Stat Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-800/60">
            {/* Card 1: Points */}
            <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shrink-0">
                <Star className="text-yellow-400" size={18} />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                  {isPointsOnly ? 'Points' : 'Points Earned'}
                </span>
                <span className="text-xl font-mono font-bold text-yellow-400 leading-tight">{student.points}</span>
              </div>
            </div>

            {/* Card 2: Lives */}
            {showLivesCard && (
              <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                  <Shield className="text-red-400" size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                    {isPointsOnly ? 'Lives' : 'Lives Remaining'}
                  </span>
                  <span className="text-xl font-mono font-bold text-white leading-tight">
                    {student.lives}<span className="text-xs text-slate-500 font-sans font-medium">/{loggedInClass.maxLives}</span>
                  </span>
                </div>
              </div>
            )}

            {/* Card 3: Rank */}
            {showRankCard && (
              <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                  <Trophy className="text-blue-400" size={16} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Rank</span>
                  <span className="text-xl font-mono font-bold text-white leading-tight">
                    #{rank > 0 ? rank : '-'}<span className="text-xs text-slate-500 font-sans font-medium">/{loggedInClass.students.length}</span>
                  </span>
                </div>
              </div>
            )}

            {/* Card 4: Badges */}
            <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shrink-0">
                <Award className="text-purple-400" size={18} />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Badges</span>
                <span className="text-xl font-mono font-bold text-purple-400 leading-tight">
                  {earnedBadges.length}
                </span>
              </div>
            </div>

            {/* Card 5: Today's Progress / Personal Progress */}
            {(!showLivesCard || !showRankCard) && (
              <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <Rocket className="text-emerald-400" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block truncate">
                    {isPrivate && !isPointsOnly ? 'Personal Progress' : "Today's Progress"}
                  </span>
                  <div className="flex flex-col">
                    <span className={`text-lg sm:text-xl font-mono font-bold leading-tight ${todayPointsDelta > 0 ? 'text-emerald-400' : todayPointsDelta < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {todayPointsDelta > 0 ? '+' : ''}{todayPointsDelta} <span className="text-xs text-slate-500 font-sans font-medium">pts today</span>
                    </span>
                    {latestLog ? (
                      <span className="text-[9px] text-slate-400 truncate mt-0.5" title={`Latest: ${latestLog.reason || latestLog.action_type.replace(/_/g, ' ')}`}>
                        Latest: {latestLog.reason || latestLog.action_type.replace(/_/g, ' ')}
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 truncate mt-0.5">
                        No progress logged yet today.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Card 6: Recent Progress (Only for Private + Points to get to 4 cards) */}
            {showRecentProgressCard && (
              <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shrink-0">
                  <CheckCircle className="text-cyan-400" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block truncate">
                    Recent Progress
                  </span>
                  <div className="flex flex-col">
                    <span className={`text-lg sm:text-xl font-mono font-bold leading-tight ${recentPointsDelta > 0 ? 'text-cyan-400' : recentPointsDelta < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {recentPointsDelta > 0 ? '+' : ''}{recentPointsDelta} <span className="text-xs text-slate-500 font-sans font-medium">pts (7d)</span>
                    </span>
                    <span className="text-[9px] text-slate-500 truncate mt-0.5">
                      Past 7 days
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main tasks list and recent logs (col-span-2) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Classroom Tasks & Missions */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="text-base font-display font-bold text-white flex items-center justify-between border-b border-slate-800/60 pb-3">
                <span className="flex items-center gap-2">
                  <CheckSquare size={16} className="text-purple-400" /> Classroom Tasks
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                  {tasks.filter(t => t.status === 'published').length} Active
                </span>
              </h3>

              {isTasksTableMissing ? (
                <div className="py-8 px-4 text-center bg-slate-950/40 rounded-xl border border-slate-850 text-slate-500 text-xs italic space-y-1">
                  <p className="font-semibold text-slate-400">Class Tasks Module Offline</p>
                  <p className="text-[10px] text-slate-650 max-w-sm mx-auto leading-relaxed mt-1">
                    Your teacher is setting this up. Please check again later.
                  </p>
                </div>
              ) : isTasksLoading ? (
                <div className="py-12 text-center text-slate-500 text-xs font-semibold font-mono animate-pulse">Syncing tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="py-10 text-center bg-slate-900/10 rounded-xl border border-dashed border-slate-800 px-4 select-none">
                  <p className="text-slate-400 font-medium text-sm">No Active Tasks</p>
                  <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
                    Your classroom task board is completely clear. Enjoy the break or ask your teacher for upcoming tasks!
                  </p>
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
                    let statusBadgeColor = 'bg-slate-950 text-slate-500 border-slate-850';

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
                      subTypeLabel = 'Text & File';
                    } else if (task.allow_text_submission) {
                      subTypeLabel = 'Text Response';
                    } else if (task.allow_attachment_submission) {
                      subTypeLabel = 'File Upload';
                    } else {
                      subTypeLabel = 'No submission required';
                    }

                    return (
                      <div
                        key={task.id}
                        className={`bg-slate-950/50 border border-slate-850/80 rounded-xl p-3.5 space-y-3 transition-all relative hover:bg-slate-900/20 ${
                          isClosed ? 'opacity-65' : 'border-purple-500/10 hover:border-purple-500/25 hover:shadow-[0_0_15px_rgba(168,85,247,0.02)]'
                        }`}
                      >
                        {/* Task Header line */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900/60 pb-2 select-none">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider border ${
                              isClosed
                                ? 'bg-slate-900 text-slate-500 border-slate-800'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {isClosed ? 'Closed' : 'Active'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-900 text-slate-400 border border-slate-850 uppercase tracking-wider">
                              {task.task_type}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${statusBadgeColor}`}>
                              {submissionStatus}
                            </span>
                          </div>

                          <span className="text-yellow-500 text-[10px] font-mono font-bold flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                            ⭐ {task.reward_points} pts
                          </span>
                        </div>

                        {/* Title and Description */}
                        <div>
                          <h4 className="text-sm font-bold text-slate-100 leading-snug">{task.title}</h4>
                          {task.description && (
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed whitespace-pre-wrap max-w-2xl">{task.description}</p>
                          )}
                          {submission && task.task_type === 'group' && (
                            <div className="text-[9px] text-slate-500 font-mono mt-1.5 flex items-center gap-1 flex-wrap">
                              <span>📢 Submitted by</span>
                              <span className="text-slate-300 font-semibold">{submitterName}</span>
                              <span>on {formattedSubTime}</span>
                            </div>
                          )}
                        </div>

                        {/* Allowed submission formats or limitations */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 bg-slate-900/50 p-2 rounded-lg border border-slate-850/60 font-mono select-none">
                          <div>
                            <span className="text-slate-500">Submission:</span> <span className="font-semibold text-slate-300">{subTypeLabel}</span>
                          </div>
                          {task.allow_attachment_submission && (
                            <div>
                              <span className="text-slate-500">Limit:</span> <span className="font-semibold text-slate-300">{task.max_attachments} file{task.max_attachments > 1 ? 's' : ''} • {task.max_attachment_size_mb}MB each</span>
                            </div>
                          )}
                        </div>

                        {/* Group detail */}
                        {task.task_type === 'group' && (
                          <div className="bg-slate-900/40 border border-slate-850/60 rounded-lg p-2.5 space-y-1 text-xs select-none">
                            <div className="flex items-center gap-2">
                              <Users className="text-purple-400" size={13} />
                              {assignedGroup ? (
                                <span className="text-slate-300 font-medium">
                                  Assigned Team: <span className="text-purple-400 font-bold">{assignedGroup.name}</span>
                                </span>
                              ) : (
                                <span className="text-amber-500 font-semibold italic">
                                  Not assigned to a team yet. Please contact your teacher.
                                </span>
                              )}
                            </div>
                            {assignedGroup && groupMembers[assignedGroup.id] && (
                              <div className="text-[10px] text-slate-500 pl-5 font-mono">
                                <span className="text-slate-400 font-sans font-medium">Members:</span> {groupMembers[assignedGroup.id].join(', ')}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Submissions Details & Teacher Feedback Area */}
                        {submission && (
                          <div className="mt-2 text-xs bg-slate-950/60 rounded-xl border border-slate-850 p-3 space-y-2.5 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-slate-905 pb-1.5 select-none">
                              <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider font-bold">Your Submitted Data</span>
                              <span className="text-[9px] text-slate-500 font-mono">
                                {new Date(submission.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {submission.submitted_text && (
                              <div className="text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-850/40 max-h-24 overflow-y-auto text-[11px] whitespace-pre-wrap leading-relaxed font-sans">
                                {submission.submitted_text}
                              </div>
                            )}
                            {submission.attachments && submission.attachments.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[9px] text-slate-500 block font-mono select-none uppercase tracking-wider font-bold">Uploaded files ({submission.attachments.length}):</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {submission.attachments.map((att: any) => (
                                    <a
                                      key={att.id}
                                      href={att.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-750/80 rounded px-2 py-1 text-[10px] text-slate-300 hover:text-white transition-all shadow-sm"
                                    >
                                      <Paperclip size={10} className="text-slate-400" />
                                      <span className="max-w-[150px] truncate font-medium">{att.file_name}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(submission.awarded_points !== undefined && submission.awarded_points !== null) && (
                              <div className="pt-2 border-t border-slate-900 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-yellow-500 flex items-center gap-1">
                                    ⭐ Score Awarded: {submission.awarded_points} / {task.reward_points} pts
                                  </span>
                                  {submission.status === 'reviewed' && (
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase font-bold font-mono tracking-wider">Approved</span>
                                  )}
                                </div>
                                {submission.teacher_feedback && (
                                  <div className="text-slate-300 bg-purple-950/10 border border-purple-500/10 p-2.5 rounded-lg text-[11px] leading-relaxed">
                                    <span className="font-bold text-purple-400 block mb-0.5 text-[10px] uppercase font-mono tracking-wider select-none">💬 Teacher Feedback</span>
                                    <p className="italic">"{submission.teacher_feedback}"</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Task Footer / Bottom Control bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-900/60 text-[10px] text-slate-500 select-none">
                          <span className="flex items-center gap-1">
                            📅 Due: {task.due_at ? new Date(task.due_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No deadline'}
                          </span>
                          
                          <div className="flex items-center gap-2 ml-auto">
                            {task.task_type === 'group' && !assignedGroup && (
                              <span className="text-[10px] text-amber-500/80 italic text-right hidden sm:block">
                                You are not assigned to a group for this task yet. Please ask your teacher.
                              </span>
                            )}
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
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md cursor-pointer'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md animate-pulse hover:animate-none cursor-pointer'
                              }`}
                            >
                              {(task.task_type === 'group' && !assignedGroup)
                                ? 'Not Assigned Yet'
                                : isClosed
                                ? 'View Submission'
                                : submission
                                ? 'Update Submission'
                                : 'Open Task Form'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My Recent Updates (Personal Timeline) */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="text-base font-display font-bold text-white flex items-center gap-2 border-b border-slate-800/60 pb-3">
                <Clock size={16} className="text-indigo-400" /> Recent Updates
              </h3>
              
              {isTableMissing ? (
                <div className="py-4 text-center text-slate-500 text-xs italic leading-relaxed">
                  Timeline features are disabled until the database tables are initialized in Supabase by the teacher.
                </div>
              ) : isLogsLoading && studentLogs.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm font-medium">Loading history...</div>
              ) : studentLogs.length === 0 ? (
                <div className="py-8 px-4 text-center bg-slate-950/20 rounded-xl border border-slate-850 text-slate-500 text-xs italic">
                  No point or life updates recorded yet. Keep up the good work!
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {studentLogs.map((log) => {
                    const isPoints = log.action_type === 'points_changed';
                    const isLives = log.action_type === 'lives_changed';
                    const isUndone = log.undone;

                    let title = '';
                    let badgeColor = 'bg-slate-800 text-slate-400 border border-slate-750';

                    if (isPoints) {
                      const delta = log.points_delta || 0;
                      const sign = delta > 0 ? '+' : '';
                      title = `${sign}${delta} Pts`;
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
                        className={`bg-slate-950/40 border border-slate-850/60 rounded-xl p-3 flex items-center justify-between gap-4 transition-all ${
                          isUndone ? 'opacity-45 select-none' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 border ${badgeColor}`}>
                            {title}
                          </span>
                          <div className="space-y-0.5">
                            {log.reason ? (
                              <p className={`text-xs font-semibold text-slate-200 leading-snug ${isUndone ? 'line-through' : ''}`}>
                                "{log.reason}"
                              </p>
                            ) : (
                              <p className={`text-xs text-slate-400 leading-snug ${isUndone ? 'line-through' : ''}`}>
                                {isPoints ? (log.points_delta! > 0 ? 'Earned points' : 'Lost points') : (log.lives_delta! > 0 ? 'Restored lives' : 'Lost lives')}
                              </p>
                            )}
                            <span className="text-[9px] text-slate-500 font-mono block">
                              {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {isUndone && (
                          <span className="text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded font-bold font-mono shrink-0">
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

          {/* Right sidebar column: Badges and Achievements */}
          <div className="space-y-6">
            {/* Achievements & Badges Panel */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="text-base font-display font-bold text-white flex items-center justify-between border-b border-slate-800/60 pb-3">
                <span className="flex items-center gap-2">
                  <Award size={16} className="text-purple-400" /> Badges & Medals
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {earnedBadges.length}
                </span>
              </h3>

              {isBadgesTableMissing ? (
                <div className="py-8 px-4 text-center bg-slate-950/40 rounded-xl border border-slate-850 text-slate-500 text-xs italic space-y-1">
                  <p className="font-semibold text-slate-400">Achievements Module Offline</p>
                  <p className="text-[10px] text-slate-600 leading-relaxed font-sans mt-1">
                    Ask your teacher to complete the database migration in Class Settings to activate badges and achievements!
                  </p>
                </div>
              ) : isBadgesLoading && earnedBadges.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs font-medium font-mono animate-pulse">Loading your dashboard...</div>
              ) : earnedBadges.length === 0 ? (
                <div className="py-8 px-4 text-center bg-slate-950/40 rounded-xl border border-slate-850 text-slate-500 text-xs italic space-y-1">
                  <p className="font-semibold text-slate-400">No Badges Yet</p>
                  <p className="text-[10px] text-slate-600 leading-relaxed font-sans mt-1">
                    Complete classroom tasks, maintain full health status, or show extra effort to unlock special achievements!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {earnedBadges.map((sb) => {
                    const badge = sb.badge;
                    if (!badge) return null;
                    return (
                      <div
                        key={sb.id}
                        className="bg-slate-950/50 border border-slate-850 rounded-xl p-3 space-y-2 transition-all hover:border-purple-500/20 hover:bg-slate-900/10 duration-200"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-2xl shrink-0 p-1 bg-slate-900 rounded-lg border border-slate-850 shadow-sm" role="img" aria-label={badge.name}>
                            {badge.icon || '🏅'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-white leading-normal truncate">{badge.name}</h4>
                            <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                              {badge.description}
                            </p>
                          </div>
                        </div>

                        {sb.awarded_reason && (
                          <div className="bg-slate-900/50 p-2 rounded text-[10px] text-slate-300 italic border border-slate-850/40 leading-relaxed">
                            💬 "{sb.awarded_reason}"
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono border-t border-slate-900/60 pt-2 select-none">
                          <span className="capitalize text-slate-400 font-medium">
                            {sb.source === 'automatic' ? '🤖 Automated' : '⭐ Awarded'}
                          </span>
                          <span>
                            {new Date(sb.awarded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border-0 sm:border border-slate-800 rounded-none sm:rounded-2xl w-full h-full sm:h-auto sm:max-h-[90vh] max-w-2xl overflow-hidden shadow-2xl flex flex-col">
              {/* Modal Header */}
              <div className="p-5 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl sm:text-lg font-bold text-white flex items-center gap-2">
                    <CheckSquare size={20} className="text-purple-400" />
                    {selectedTaskForSubmission.title}
                  </h3>
                  <p className="text-sm sm:text-xs text-slate-500 mt-1 sm:mt-0.5">
                    Reward: <span className="text-yellow-500 font-semibold font-mono">⭐ {selectedTaskForSubmission.reward_points} pts</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTaskForSubmission(null)}
                  className="text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors p-2 rounded-xl"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 sm:space-y-4 flex-1">
                {/* Task Details */}
                {selectedTaskForSubmission.description && (
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Task Instructions</h4>
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
                    <span>Submission sent! Your teacher can now review it.</span>
                  </div>
                ) : (
                  <form onSubmit={handleTaskSubmit} className="space-y-4">
                    {/* Text Area Input */}
                    {selectedTaskForSubmission.allow_text_submission && (
                      <div className="space-y-2">
                        <label className="block text-sm sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Your Text Answer
                        </label>
                        <div className="relative">
                          <textarea
                            rows={6}
                            value={submissionText}
                            onChange={(e) => setSubmissionText(e.target.value)}
                            placeholder="Type your response here..."
                            required={!selectedTaskForSubmission.allow_attachment_submission}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 min-h-[160px] sm:min-h-[220px] leading-relaxed resize-y pb-8"
                          />
                          <div className="absolute bottom-3 right-4 text-xs font-mono text-slate-500 select-none pointer-events-none">
                            {countWords(submissionText)} {countWords(submissionText) === 1 ? 'word' : 'words'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* File Attachment Upload */}
                    {selectedTaskForSubmission.allow_attachment_submission && (
                      <div className="space-y-3">
                        <label className="block text-sm sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Upload Files & Documentations
                        </label>
                        <div className="border border-dashed border-slate-800 bg-slate-950 hover:bg-slate-950/65 rounded-xl p-6 sm:p-5 text-center cursor-pointer transition-colors relative group">
                          <input
                            type="file"
                            multiple
                            maxLength={selectedTaskForSubmission.max_attachments}
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          <Upload className="mx-auto text-slate-500 mb-3 group-hover:text-slate-400 transition-colors" size={28} />
                          <p className="text-sm sm:text-xs text-slate-300 font-medium">Drag or browse to attach files</p>
                          <p className="text-xs sm:text-[10px] text-slate-500 mt-1.5">
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

                    {!selectedTaskForSubmission.allow_text_submission && !selectedTaskForSubmission.allow_attachment_submission && (
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center text-xs text-slate-400">
                        This task does not require an upload or written answer. Please follow your teacher's classroom instructions.
                      </div>
                    )}

                    {submissionError && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 sm:p-3 rounded-xl flex items-center gap-3 sm:gap-2 text-sm sm:text-xs">
                        <AlertTriangle size={18} className="shrink-0" />
                        <span>{submissionError}</span>
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 sm:justify-end mt-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedTaskForSubmission(null)}
                        className="w-full sm:w-auto bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white px-5 py-3.5 sm:py-2.5 rounded-xl text-sm sm:text-xs font-bold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingTask}
                        className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-3.5 sm:py-2.5 rounded-xl text-sm sm:text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
                      >
                        {isSubmittingTask ? (
                          <>
                            <Loader2 className="animate-spin" size={18} /> Transmitting...
                          </>
                        ) : studentSubmissions[selectedTaskForSubmission.id] ? (
                          'Update Submission'
                        ) : (
                          'Submit Task'
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 font-sans relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-950/15 via-slate-950/40 to-slate-950 pointer-events-none" />

      {/* Top Navigation Row */}
      <div className="w-full max-w-md mx-auto relative z-10 pt-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg bg-slate-900/40 hover:bg-slate-900 border border-slate-800/60 cursor-pointer"
        >
          <ArrowLeft size={13} /> Back to Main Menu
        </button>
      </div>

      {/* Center Form Container */}
      <div className="max-w-md w-full mx-auto my-auto py-8 relative z-10">
        <div className="bg-slate-900/65 backdrop-blur-md border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative">
          
          {/* Header */}
          <div className="text-center mb-6 select-none">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 mb-3.5">
              Presented by GYTama EDU
            </div>
            <div className="relative inline-block mb-3.5">
              <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/20">
                <GraduationCap size={20} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Student Access</h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Enter your Class Code and secure student PIN to enter your dashboard.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3.5 py-3 rounded-xl text-xs flex items-start gap-2 leading-relaxed">
                <AlertTriangle size={14} className="shrink-0 text-red-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Class Code</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ALPHA1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono uppercase text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Student PIN</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="password"
                  required
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="4-digit PIN"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono text-xs"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">
                * Ask your teacher for your custom classroom access credentials.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold transition-all duration-200 mt-2 flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Loading dashboard...</span>
                </>
              ) : (
                <span>Access Dashboard</span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="w-full flex justify-center py-4 select-none relative z-10 border-t border-slate-900/40">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
          Mission Control &copy; {new Date().getFullYear()} &bull; GYTama EDU
        </p>
      </div>
    </div>
  );
}
