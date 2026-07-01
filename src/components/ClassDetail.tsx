import React, { useState, useEffect } from 'react';
import { ClassData, ActivityLog, Task, TaskGroup, TaskGroupMember } from '../types';
import { ArrowLeft, Users, Shield, Plus, Minus, Star, Play, Trophy, Settings, Trash2, Edit2, X, AlertTriangle, Key, Copy, RefreshCw, Clock, Undo2, Folder, CheckSquare, PlusCircle, FileText, Paperclip, Loader2, Award, BarChart2, Printer, TrendingUp, Archive } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import * as db from '../services/missionControlData';
import * as taskDb from '../services/taskData';
import * as badgeDb from '../services/badgeData';
import { getEffectiveClassroomMode } from '../utils/classroomUtils';
import { getSubmissionStatus, getSubmissionStatusBadgeColor, getTaskSubmissionSummary } from '../utils/submissionStatusUtils';
import { getPointActionMessage } from '../utils/pointActionUtils';
import { downloadCsv, sanitizeFilename } from '../utils/exportUtils';
import { ConfirmActionModal } from './ConfirmActionModal';
import { AiWritingCheck } from './AiWritingCheck';

interface ClassDetailProps {
  classData: ClassData;
  onBack: () => void;
  onEditClass: (name: string, level: string, maxLives: number, category: 'regular' | 'private', scoringSystem: 'points' | 'lives') => void;
  onArchiveClass: () => void;
  onDeleteClass: () => void;
  onRegenerateJoinCode: () => void;
  onAddStudent: (name: string) => void;
  onEditStudent: (studentId: string, name: string, nickname?: string) => void;
  onDeleteStudent: (studentId: string) => void;
  onRegenerateStudentPin: (studentId: string) => void;
  onUpdateLives: (studentId: string, change: number, reason?: string | null) => Promise<void> | void;
  onUpdatePoints: (studentId: string, change: number, reason?: string | null) => Promise<void> | void;
  onStartMeeting: () => void;
  onEndMeeting: (meetingId: string) => void;
  onSync: () => void;
}

export function ClassDetail({
  classData,
  onBack,
  onEditClass,
  onArchiveClass,
  onDeleteClass,
  onRegenerateJoinCode,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onRegenerateStudentPin,
  onUpdateLives,
  onUpdatePoints,
  onStartMeeting,
  onEndMeeting,
  onSync
}: ClassDetailProps) {
  const [newStudentName, setNewStudentName] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'leaderboard' | 'activity_log' | 'meetings' | 'tasks' | 'settings' | 'badges' | 'reports'>('roster');
  
  const handleUpdatePoints = (studentId: string, change: number, reason?: string | null) => {
    let finalReason = reason;
    if (!finalReason) {
      finalReason = getPointActionMessage(change);
    }
    onUpdatePoints(studentId, change, finalReason);
  };

  const handleUpdateLives = (studentId: string, change: number, reason?: string | null) => {
    onUpdateLives(studentId, change, reason);
  };

  // Reports & Analytics States
  const [reportsSubTab, setReportsSubTab] = useState<'overview' | 'students' | 'tasks' | 'meetings' | 'badges' | 'activity'>('overview');
  const [reportSubmissions, setReportSubmissions] = useState<any[]>([]);
  const [reportGroups, setReportGroups] = useState<any[]>([]);
  const [reportGroupMembers, setReportGroupMembers] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [selectedReportStudentId, setSelectedReportStudentId] = useState<string | null>(null);
  const [reportsActivityFilter, setReportsActivityFilter] = useState<'all' | 'points' | 'lives' | 'tasks' | 'badges' | 'meetings'>('all');

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Badge States
  const [badgeDefinitions, setBadgeDefinitions] = useState<any[]>([]);
  const [studentBadges, setStudentBadges] = useState<any[]>([]);
  const [isBadgesLoading, setIsBadgesLoading] = useState(false);
  const [isBadgesTableMissing, setIsBadgesTableMissing] = useState(false);
  const [copiedBadgesSql, setCopiedBadgesSql] = useState(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any | null>(null);

  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    helperNote?: string;
    confirmLabel?: string;
    variant?: 'default' | 'warning' | 'danger';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const closeConfirmModal = () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
  
  // Badge Form States
  const [badgeFormName, setBadgeFormName] = useState('');
  const [badgeFormDescription, setBadgeFormDescription] = useState('');
  const [badgeFormIcon, setBadgeFormIcon] = useState('⭐');
  const [badgeFormType, setBadgeFormType] = useState<'manual' | 'automatic'>('manual');
  const [badgeFormTrigger, setBadgeFormTrigger] = useState<string>('teacher_choice');
  const [badgeFormPointsThreshold, setBadgeFormPointsThreshold] = useState<number | ''>('');
  const [badgeFormTaskCount, setBadgeFormTaskCount] = useState<number | ''>('');
  const [badgeFormGroupTaskCount, setBadgeFormGroupTaskCount] = useState<number | ''>('');

  // Manual Awarding Modal States
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [awardSelectedStudentId, setAwardSelectedStudentId] = useState('');
  const [awardSelectedBadgeId, setAwardSelectedBadgeId] = useState('');
  const [awardReason, setAwardReason] = useState('');
  const [isAwardingBadge, setIsAwardingBadge] = useState(false);
  const [badgeAwardError, setBadgeAwardError] = useState('');

  const loadBadgesData = async () => {
    setIsBadgesLoading(true);
    try {
      const defs = await badgeDb.fetchBadgeDefinitions(classData.id);
      setBadgeDefinitions(defs);
      const sBadges = await badgeDb.fetchStudentBadges(classData.id);
      setStudentBadges(sBadges);
      setIsBadgesTableMissing(false);
    } catch (err: any) {
      if (err && (err.code === 'PGRST205' || (err.message && (err.message.includes('badge_definitions') || err.message.includes('student_badges')) && err.message.includes('schema cache')))) {
        setIsBadgesTableMissing(true);
        console.warn('Badges tables are missing in Supabase. Badge management is disabled until migration is run.');
      } else {
        console.error('Failed to load badges data:', err);
      }
    } finally {
      setIsBadgesLoading(false);
    }
  };

  useEffect(() => {
    loadBadgesData();
  }, [classData.id, activeTab]);

  const handleAddStarterBadges = async () => {
    if (confirm('Create the default starter badge suite (7 badges) for this class?')) {
      setIsBadgesLoading(true);
      try {
        await badgeDb.addStarterBadges(classData.id, classData.teacherId);
        await loadBadgesData();
      } catch (err: any) {
        alert(err.message || 'Failed to add starter badges.');
      } finally {
        setIsBadgesLoading(false);
      }
    }
  };

  const handleOpenBadgeModal = (badge: any = null) => {
    if (badge) {
      setEditingBadge(badge);
      setBadgeFormName(badge.name);
      setBadgeFormDescription(badge.description || '');
      setBadgeFormIcon(badge.icon || '⭐');
      setBadgeFormType(badge.badge_type as 'manual' | 'automatic');
      setBadgeFormTrigger(badge.trigger_key || 'teacher_choice');
      setBadgeFormPointsThreshold(badge.points_threshold ?? '');
      setBadgeFormTaskCount(badge.task_count_threshold ?? '');
      setBadgeFormGroupTaskCount(badge.group_task_count_threshold ?? '');
    } else {
      setEditingBadge(null);
      setBadgeFormName('');
      setBadgeFormDescription('');
      setBadgeFormIcon('⭐');
      setBadgeFormType('manual');
      setBadgeFormTrigger('teacher_choice');
      setBadgeFormPointsThreshold('');
      setBadgeFormTaskCount('');
      setBadgeFormGroupTaskCount('');
    }
    setIsBadgeModalOpen(true);
  };

  const handleSaveBadgeDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeFormName.trim()) return;

    setIsBadgesLoading(true);
    try {
      const badgeDataObj = {
        class_id: classData.id,
        teacher_id: classData.teacherId,
        name: badgeFormName.trim(),
        description: badgeFormDescription.trim() || null,
        icon: badgeFormIcon,
        badge_type: badgeFormType,
        trigger_key: badgeFormType === 'automatic' ? badgeFormTrigger : 'teacher_choice',
        points_threshold: (badgeFormType === 'automatic' && badgeFormTrigger === 'points_threshold') ? Number(badgeFormPointsThreshold) : null,
        task_count_threshold: (badgeFormType === 'automatic' && badgeFormTrigger === 'individual_tasks_completed') ? Number(badgeFormTaskCount) : null,
        group_task_count_threshold: (badgeFormType === 'automatic' && badgeFormTrigger === 'group_tasks_completed') ? Number(badgeFormGroupTaskCount) : null,
        is_active: true
      };

      if (editingBadge) {
        await badgeDb.updateBadgeDefinition(editingBadge.id, classData.id, badgeDataObj);
      } else {
        await badgeDb.createBadgeDefinition(badgeDataObj);
      }

      setIsBadgeModalOpen(false);
      await loadBadgesData();
    } catch (err: any) {
      alert(err.message || 'Failed to save badge definition.');
    } finally {
      setIsBadgesLoading(false);
    }
  };

  const handleDeleteBadgeDefinition = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?\nAll students who earned this badge will lose it. This cannot be undone.`)) {
      setIsBadgesLoading(true);
      try {
        await badgeDb.deleteBadgeDefinition(id, classData.id, name);
        await loadBadgesData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete badge definition.');
      } finally {
        setIsBadgesLoading(false);
      }
    }
  };

  const handleOpenAwardModal = (studentId: string = '') => {
    setAwardSelectedStudentId(studentId);
    setAwardSelectedBadgeId('');
    setAwardReason('');
    setBadgeAwardError('');
    setIsAwardModalOpen(true);
  };

  const handleAwardBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardSelectedStudentId || !awardSelectedBadgeId) {
      setBadgeAwardError('Please select both a student and a badge.');
      return;
    }

    setIsAwardingBadge(true);
    setBadgeAwardError('');
    try {
      await badgeDb.awardBadgeManually(awardSelectedBadgeId, awardSelectedStudentId, awardReason.trim());
      setIsAwardModalOpen(false);
      await loadBadgesData();
    } catch (err: any) {
      setBadgeAwardError(err.message || 'Failed to award badge.');
    } finally {
      setIsAwardingBadge(false);
    }
  };


  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'points' | 'lives' | 'system'>('all');
  const [timelineMeetingFilter, setTimelineMeetingFilter] = useState<'current' | 'all'>('all');
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isEndMeetingModalOpen, setIsEndMeetingModalOpen] = useState(false);
  const [selectedMeetingForSummary, setSelectedMeetingForSummary] = useState<any | null>(null);

  const loadReportData = async () => {
    setIsReportsLoading(true);
    setReportsError('');
    try {
      // 1. Fetch tasks
      const fetchedTasks = await taskDb.fetchTasksByClass(classData.id);
      setAllTasks(fetchedTasks);

      // 2. Fetch submissions, groups, group members
      const reportsData = await taskDb.fetchClassReportsData(classData.id);
      setReportSubmissions(reportsData.submissions);
      setReportGroups(reportsData.groups);
      setReportGroupMembers(reportsData.groupMembers);
      
      // 3. Load badges if missing table isn't true
      if (!isBadgesTableMissing) {
        await loadBadgesData();
      }

      // 4. Load activity logs
      await loadLogs();
    } catch (err: any) {
      console.error('Failed to load reports data:', err);
      setReportsError('Failed to load some report datasets. Please retry.');
    } finally {
      setIsReportsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReportData();
    }
  }, [classData.id, activeTab]);

  const loadLogs = async () => {
    setIsLogsLoading(true);
    try {
      const logs = await db.fetchActivityLogs(classData.id);
      setActivityLogs(logs);
      setIsTableMissing(false);
    } catch (err: any) {
      if (err && (err.code === 'PGRST205' || (err.message && err.message.includes('activity_logs') && err.message.includes('schema cache')))) {
        setIsTableMissing(true);
        console.warn('Activity logs table is missing in Supabase. Logging is disabled until migration is run.');
      } else {
        console.error('Failed to load activity logs:', err);
      }
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();

    if (isTableMissing) return;

    const channel = supabase
      .channel(`class-logs-${classData.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_logs',
          filter: `class_id=eq.${classData.id}`
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classData.id, isTableMissing]);

  // Task States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [isTasksTableMissing, setIsTasksTableMissing] = useState(false);
  const [copiedTasksSql, setCopiedTasksSql] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskDeleteConfirmId, setTaskDeleteConfirmId] = useState<string | null>(null);

  // Group task management states
  const [selectedTaskForGroups, setSelectedTaskForGroups] = useState<Task | null>(null);
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [isGroupsLoading, setIsGroupsLoading] = useState(false);

  // Teacher Submission Viewer states
  const [selectedTaskForSubmissions, setSelectedTaskForSubmissions] = useState<Task | null>(null);
  const [taskSubmissions, setTaskSubmissions] = useState<any[]>([]);
  const [isFetchingSubmissions, setIsFetchingSubmissions] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [selectedSubmissionForReview, setSelectedSubmissionForReview] = useState<any | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewScore, setReviewScore] = useState<number>(0);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);

  // Task form states
  const [taskFormTitle, setTaskFormTitle] = useState('');
  const [taskFormDescription, setTaskFormDescription] = useState('');
  const [taskFormType, setTaskFormType] = useState<'individual' | 'group'>('individual');
  const [taskFormDueAt, setTaskFormDueAt] = useState('');
  const [taskFormRewardPoints, setTaskFormRewardPoints] = useState(0);
  const [taskFormAllowText, setTaskFormAllowText] = useState(true);
  const [taskFormAllowAttachment, setTaskFormAllowAttachment] = useState(false);
  const [taskFormMaxAttachments, setTaskFormMaxAttachments] = useState(1);
  const [taskFormMaxSizeMb, setTaskFormMaxSizeMb] = useState(10);
  const [taskFormAllowResubmission, setTaskFormAllowResubmission] = useState(true);

  // Auto-group states
  const [numGroupsToCreate, setNumGroupsToCreate] = useState(3);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameGroupValue, setRenameGroupValue] = useState('');

  const loadTasks = async () => {
    setIsTasksLoading(true);
    try {
      const data = await taskDb.fetchTasksByClass(classData.id);
      setTasks(data);
      setIsTasksTableMissing(false);

      // Fetch submission counts and queue data
      const { data: subsData, error: subsErr } = await supabase
        .from('task_submissions')
        .select('id, task_id, student_id, task_group_id, status, created_at, updated_at')
        .eq('class_id', classData.id);
      
      if (!subsErr && subsData) {
        setAllSubmissions(subsData);
        const counts: Record<string, number> = {};
        subsData.forEach(sub => {
          counts[sub.task_id] = (counts[sub.task_id] || 0) + 1;
        });
        setSubmissionCounts(counts);
      }
    } catch (err: any) {
      if (err && (err.code === 'PGRST205' || (err.message && err.message.includes('tasks') && err.message.includes('schema cache')))) {
        setIsTasksTableMissing(true);
        console.warn('Tasks table is missing in Supabase. Task management is disabled until migration is run.');
      } else {
        console.error('Failed to load tasks:', err);
      }
    } finally {
      setIsTasksLoading(false);
    }
  };

  const loadTaskGroups = async (taskId: string) => {
    setIsGroupsLoading(true);
    try {
      const data = await taskDb.fetchTaskGroups(taskId);
      setTaskGroups(data);
    } catch (err: any) {
      console.error('Failed to load task groups:', err);
    } finally {
      setIsGroupsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();

    if (isTasksTableMissing) return;

    const tasksChannel = supabase
      .channel(`class-tasks-${classData.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `class_id=eq.${classData.id}`
        },
        () => {
          loadTasks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_groups',
          filter: `class_id=eq.${classData.id}`
        },
        () => {
          if (selectedTaskForGroups) {
            loadTaskGroups(selectedTaskForGroups.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_group_members'
        },
        () => {
          if (selectedTaskForGroups) {
            loadTaskGroups(selectedTaskForGroups.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
    };
  }, [classData.id, selectedTaskForGroups?.id, isTasksTableMissing]);

  const openCreateTaskModal = () => {
    setEditingTask(null);
    setTaskFormTitle('');
    setTaskFormDescription('');
    setTaskFormType('individual');
    setTaskFormDueAt('');
    setTaskFormRewardPoints(0);
    setTaskFormAllowText(true);
    setTaskFormAllowAttachment(false);
    setTaskFormMaxAttachments(1);
    setTaskFormMaxSizeMb(10);
    setTaskFormAllowResubmission(true);
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setTaskFormTitle(task.title);
    setTaskFormDescription(task.description || '');
    setTaskFormType(task.task_type);
    setTaskFormDueAt(task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : '');
    setTaskFormRewardPoints(task.reward_points);
    setTaskFormAllowText(task.allow_text_submission);
    setTaskFormAllowAttachment(task.allow_attachment_submission);
    setTaskFormMaxAttachments(task.max_attachments);
    setTaskFormMaxSizeMb(task.max_attachment_size_mb);
    setTaskFormAllowResubmission(task.allow_resubmission !== false);
    setIsTaskModalOpen(true);
  };

  const handleQuickDueDate = (preset: 'none' | 'today' | 'tomorrow' | 'nextWeek') => {
    if (preset === 'none') {
      setTaskFormDueAt('');
      return;
    }
    const d = new Date();
    if (preset === 'tomorrow') d.setDate(d.getDate() + 1);
    if (preset === 'nextWeek') d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    setTaskFormDueAt(`${year}-${month}-${date}T${hours}:${minutes}`);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskFormTitle.trim()) {
      alert('Title is required');
      return;
    }
    try {
      const taskInput = {
        class_id: classData.id,
        title: taskFormTitle.trim(),
        description: taskFormDescription.trim(),
        task_type: taskFormType,
        due_at: taskFormDueAt ? new Date(taskFormDueAt).toISOString() : null,
        reward_points: Number(taskFormRewardPoints),
        allow_text_submission: taskFormAllowText,
        allow_attachment_submission: taskFormAllowAttachment,
        max_attachments: Number(taskFormMaxAttachments),
        max_attachment_size_mb: Number(taskFormMaxSizeMb),
        allow_resubmission: taskFormAllowResubmission
      };

      if (editingTask) {
        await taskDb.updateTask(editingTask.id, taskInput);
        alert('Task updated successfully!');
      } else {
        await taskDb.createTask(taskInput);
        alert('Task created successfully!');
      }
      setIsTaskModalOpen(false);
      loadTasks();
    } catch (err: any) {
      alert('Error saving task: ' + err.message);
    }
  };

  const handleDeleteTask = async (taskId: string, title: string) => {
    try {
      await taskDb.deleteTask(taskId, classData.id, title);
      setTaskDeleteConfirmId(null);
      alert('Task deleted!');
      loadTasks();
    } catch (err: any) {
      alert('Failed to delete task: ' + err.message);
    }
  };

  const handlePublishTask = async (task: Task) => {
    try {
      await taskDb.publishTask(task.id, classData.id, task.title);
      alert('Task published!');
      loadTasks();
    } catch (err: any) {
      alert('Failed to publish task: ' + err.message);
    }
  };

  const handleCloseTask = async (task: Task) => {
    try {
      await taskDb.closeTask(task.id, classData.id, task.title);
      alert('Task closed for submissions!');
      loadTasks();
    } catch (err: any) {
      alert('Failed to close task: ' + err.message);
    }
  };

  const handleArchiveTask = async (task: Task) => {
    try {
      await taskDb.archiveTask(task.id, classData.id, task.title);
      alert('Task archived!');
      loadTasks();
    } catch (err: any) {
      alert('Failed to archive task: ' + err.message);
    }
  };

  const handleReopenTask = async (task: Task) => {
    try {
      await taskDb.reopenTask(task.id, classData.id, task.title);
      alert('Task reopened successfully!');
      loadTasks();
    } catch (err: any) {
      alert('Failed to reopen task: ' + err.message);
    }
  };

  const handleOpenSubmissionsModal = async (task: Task) => {
    setSelectedTaskForSubmissions(task);
    setIsFetchingSubmissions(true);
    setSubmissionsError(null);
    setSelectedSubmissionForReview(null);
    
    const normalizedTaskType = String(task.task_type).toLowerCase();
    
    try {
      let subs;
      if (normalizedTaskType === 'group') {
        const rawSubs = await taskDb.fetchGroupTaskSubmissions(task.id, classData.id);
        subs = rawSubs.map((s: any) => ({
          ...s,
          id: s.submission_id || s.group_id, // Stable ID for select/selection mapping
          studentName: s.group_name, // Renders group name instead of a student name
          isGroup: true,
          status: s.submission_status || 'not submitted',
          created_at: s.created_at || null,
          members: (s.group_members || []).map((m: any) => m.nickname ? `${m.name} (${m.nickname})` : m.name),
          group_members_raw: s.group_members || []
        }));
      } else {
        subs = await taskDb.fetchTaskSubmissions(task.id, classData.id);
      }

      setTaskSubmissions(subs);
    } catch (err: any) {
      console.error('[DEBUG] handleOpenSubmissionsModal fetch error:', err, {
        selectedTaskId: task.id,
        selectedTaskType: task.task_type,
        currentClassId: classData.id
      });
      if (normalizedTaskType === 'group') {
        setSubmissionsError('Failed to load group submissions: ' + err.message);
      } else {
        setSubmissionsError('Failed to load submissions: ' + err.message);
      }
    } finally {
      setIsFetchingSubmissions(false);
    }
  };

  const openSubmissionsViewer = handleOpenSubmissionsModal;

  const handleSelectSubmissionForReview = (sub: any) => {
    setSelectedSubmissionForReview(sub);
    setReviewFeedback(sub.teacher_feedback || '');
    setReviewScore(sub.awarded_points || 0);
  };

  const handleSaveReview = async (status: 'reviewed' | 'returned') => {
    if (!selectedSubmissionForReview || !selectedTaskForSubmissions) return;
    setIsSavingReview(true);
    setSubmissionsError(null);
    try {
      if (selectedTaskForSubmissions.task_type === 'group') {
        if (!selectedSubmissionForReview.submission_id) {
          throw new Error('This group has not submitted a response yet.');
        }
        await taskDb.reviewGroupSubmission(
          selectedSubmissionForReview.submission_id,
          reviewFeedback,
          reviewScore
        );
      } else {
        await taskDb.reviewSubmission(
          selectedSubmissionForReview.id,
          reviewFeedback,
          status,
          reviewScore
        );
      }
      
      // Refresh list
      let subs;
      if (selectedTaskForSubmissions.task_type === 'group') {
        const rawSubs = await taskDb.fetchGroupTaskSubmissions(selectedTaskForSubmissions.id, classData.id);
        subs = rawSubs.map((s: any) => ({
          ...s,
          id: s.submission_id || s.group_id,
          studentName: s.group_name,
          isGroup: true,
          status: s.submission_status || 'not submitted',
          created_at: s.created_at || null,
          members: (s.group_members || []).map((m: any) => m.nickname ? `${m.name} (${m.nickname})` : m.name),
          group_members_raw: s.group_members || []
        }));
      } else {
        subs = await taskDb.fetchTaskSubmissions(selectedTaskForSubmissions.id, classData.id);
      }
      setTaskSubmissions(subs);
      
      // Update local selected submission
      const updatedSub = subs.find(s => s.id === selectedSubmissionForReview.id);
      if (updatedSub) setSelectedSubmissionForReview(updatedSub);
      
      // Refresh class-wide data to update the Review Queue counts
      loadTasks();
      setSelectedSubmissionForReview(updatedSub || null);
      
      // Also refresh the class data (points, logs) in the background so the roster updates
      onSync();

      alert("Review saved and points awarded.");
    } catch (err: any) {
      console.error('[DEBUG] handleSaveReview error:', err, {
        selectedTaskId: selectedTaskForSubmissions.id,
        selectedTaskType: selectedTaskForSubmissions.task_type,
        currentClassId: classData.id
      });
      setSubmissionsError('Failed to save review: ' + err.message);
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleDownloadAttachment = async (filePath: string) => {
    try {
      const url = await taskDb.getAttachmentSignedUrl(filePath);
      window.open(url, '_blank');
    } catch (err: any) {
      alert('Failed to generate download link: ' + err.message);
    }
  };

  const handleCreateMultipleGroups = async () => {
    if (!selectedTaskForGroups) return;
    if (numGroupsToCreate < 1 || numGroupsToCreate > 20) {
      alert('Number of groups must be between 1 and 20.');
      return;
    }
    try {
      await taskDb.createMultipleTaskGroups(
        selectedTaskForGroups.id,
        classData.id,
        selectedTaskForGroups.title,
        numGroupsToCreate
      );
      alert(`${numGroupsToCreate} groups created successfully!`);
      loadTaskGroups(selectedTaskForGroups.id);
    } catch (err: any) {
      alert('Failed to create groups: ' + err.message);
    }
  };

  const handleRenameGroup = async (groupId: string) => {
    if (!renameGroupValue.trim()) return;
    try {
      await taskDb.renameTaskGroup(groupId, renameGroupValue.trim());
      setRenamingGroupId(null);
      setRenameGroupValue('');
      if (selectedTaskForGroups) {
        loadTaskGroups(selectedTaskForGroups.id);
      }
    } catch (err: any) {
      alert('Failed to rename group: ' + err.message);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await taskDb.deleteTaskGroup(groupId);
      alert('Group deleted.');
      if (selectedTaskForGroups) {
        loadTaskGroups(selectedTaskForGroups.id);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddStudentToGroup = async (groupId: string, studentId: string) => {
    if (!selectedTaskForGroups) return;
    try {
      await taskDb.addStudentToTaskGroup(groupId, selectedTaskForGroups.id, classData.id, studentId);
      if (selectedTaskForGroups) {
        loadTaskGroups(selectedTaskForGroups.id);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveStudentFromGroup = async (memberId: string, studentId: string, groupId: string) => {
    if (!selectedTaskForGroups) return;
    try {
      await taskDb.removeStudentFromTaskGroup(memberId, selectedTaskForGroups.id, classData.id, studentId, groupId);
      if (selectedTaskForGroups) {
        loadTaskGroups(selectedTaskForGroups.id);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getActiveReason = () => {
    if (selectedReason === 'custom') {
      return customReason.trim() || null;
    }
    return selectedReason || null;
  };

  // Student Edit State
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentNickname, setEditStudentNickname] = useState('');

  // Class Edit State
  const [editClassName, setEditClassName] = useState(classData.name);
  const [editClassLevel, setEditClassLevel] = useState(classData.level);
  const [editClassMaxLives, setEditClassMaxLives] = useState(classData.maxLives);
  const [editClassCategory, setEditClassCategory] = useState(classData.category || 'regular');
  const [editClassScoringSystem, setEditClassScoringSystem] = useState(classData.scoring_system || (classData.category === 'private' ? 'lives' : 'points'));

  useEffect(() => {
    setEditClassName(classData.name);
    setEditClassLevel(classData.level);
    setEditClassMaxLives(classData.maxLives);
    setEditClassCategory(classData.category || 'regular');
    setEditClassScoringSystem(classData.scoring_system || (classData.category === 'private' ? 'lives' : 'points'));
  }, [classData.name, classData.level, classData.maxLives, classData.category, classData.scoring_system]);

  const activeMeeting = classData.meetings?.find(m => m.status === 'active');

  const handleEndMeeting = async () => {
    if (!activeMeeting) return;
    try {
      await onEndMeeting(activeMeeting.id);
      setIsEndMeetingModalOpen(false);
      alert('Class meeting ended and session summary created!');
    } catch (err: any) {
      alert(err.message || 'Failed to end meeting.');
    }
  };

  const handleExportRoster = () => {
    const rows = (classData.students || []).map(s => ({
      'Student Name': s.name,
      'Nickname': s.nickname || '',
      'Student PIN': s.pin,
      'Current Points': s.points,
      'Current Lives': s.lives,
      'Joined Date': new Date(s.joinedAt).toLocaleString()
    }));
    const filename = sanitizeFilename(`mission-control-roster-${classData.name}-${new Date().toISOString().split('T')[0]}`) + '.csv';
    downloadCsv(filename, rows);
  };

  const handleExportActivityLogs = () => {
    const rows = activityLogs.map(log => {
      const studentName = classData.students?.find(s => s.id === log.student_id)?.name || '';
      return {
        'Date/Time': new Date(log.created_at || Date.now()).toLocaleString(),
        'Student Name': studentName,
        'Action Type': log.action_type,
        'Points Change': log.points_delta || 0,
        'Lives Change': log.lives_delta || 0,
        'Reason / Metadata': log.reason || JSON.stringify(log.metadata || {})
      };
    });
    const filename = sanitizeFilename(`mission-control-activity-logs-${classData.name}-${new Date().toISOString().split('T')[0]}`) + '.csv';
    downloadCsv(filename, rows);
  };

  const handleExportTasksSubmissions = async () => {
    try {
      let subs = reportSubmissions;
      let tasks = allTasks;
      let groups = reportGroups;
      
      if (!tasks.length || !subs.length) {
        const reportsData = await taskDb.fetchClassReportsData(classData.id);
        subs = reportsData.submissions;
        groups = reportsData.groups;
        tasks = await taskDb.fetchTasksByClass(classData.id);
      }
      
      const rows = subs.map(sub => {
        const task = tasks.find(t => t.id === sub.task_id);
        const isGroup = task?.task_type === 'group';
        let submitterName = '';
        if (isGroup) {
          submitterName = groups.find(g => g.id === sub.task_group_id)?.name || 'Unknown Group';
        } else {
          submitterName = classData.students?.find(s => s.id === sub.student_id)?.name || 'Unknown Student';
        }
        
        return {
          'Task Title': task?.title || 'Unknown Task',
          'Task Type': isGroup ? 'Group' : 'Individual',
          'Student or Group Name': submitterName,
          'Submission Status': sub.status,
          'Submitted Date': sub.created_at ? new Date(sub.created_at).toLocaleString() : '',
          'Awarded Points': sub.awarded_points ?? '',
          'Max Points': task?.reward_points || 0,
          'Teacher Feedback': sub.teacher_feedback || ''
        };
      });
      const filename = sanitizeFilename(`mission-control-tasks-submissions-${classData.name}-${new Date().toISOString().split('T')[0]}`) + '.csv';
      downloadCsv(filename, rows);
    } catch (err: any) {
      alert('Failed to generate export: ' + err.message);
    }
  };

  const handleExportBadges = async () => {
    try {
      let badgesToExport = studentBadges;
      let defs = badgeDefinitions;
      if (!badgesToExport.length && !isBadgesTableMissing) {
         badgesToExport = await badgeDb.fetchStudentBadges(classData.id);
      }
      if (!defs.length && !isBadgesTableMissing) {
         defs = await badgeDb.fetchBadgeDefinitions(classData.id);
      }
      const rows = badgesToExport.map(sb => {
        const studentName = classData.students?.find(s => s.id === sb.student_id)?.name || 'Unknown Student';
        const badgeName = defs.find(bd => bd.id === sb.badge_id)?.title || 'Unknown Badge';
        return {
          'Student Name': studentName,
          'Badge Name': badgeName,
          'Source': sb.source,
          'Awarded Reason': sb.awarded_reason || '',
          'Awarded Date': new Date(sb.awarded_at).toLocaleString()
        };
      });
      const filename = sanitizeFilename(`mission-control-badges-${classData.name}-${new Date().toISOString().split('T')[0]}`) + '.csv';
      downloadCsv(filename, rows);
    } catch (err: any) {
      alert('Failed to generate export: ' + err.message);
    }
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    onAddStudent(newStudentName.trim());
    setNewStudentName('');
  };

  const sortedStudents = [...classData.students].sort((a, b) => b.points - a.points);

  const studentNameCollator = React.useMemo(() => new Intl.Collator(undefined, {
    sensitivity: "base",
    numeric: true,
  }), []);

  const rosterStudents = React.useMemo(() => {
    return [...(classData.students || [])].sort((a, b) => {
      const nameCompare = studentNameCollator.compare(
        (a.name || "").trim(),
        (b.name || "").trim()
      );

      if (nameCompare !== 0) return nameCompare;

      return String(a.joinedAt || a.id || "").localeCompare(
        String(b.joinedAt || b.id || "")
      );
    });
  }, [classData.students, studentNameCollator]);

  const getStudentStatus = (lives: number, maxLives: number) => {
    if (lives === 0) return { label: 'Out', color: 'text-red-500 bg-red-500/10 border-red-500/20' };
    if (lives <= maxLives / 2) return { label: 'Warning', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    return { label: 'Safe', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    onEditClass(editClassName, editClassLevel, editClassMaxLives, editClassCategory, editClassScoringSystem);
    alert('Class settings updated!');
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // onSync is typed as () => void, but syncData in App actually returns a Promise. 
      // We'll wrap it in Promise.resolve() just in case to safely await it if it's asynchronous.
      await Promise.resolve(onSync());
      
      // Refresh common data blindly
      loadTasks();
      const logs = await db.fetchActivityLogs(classData.id);
      setActivityLogs(logs);

      // Refresh specific tab data
      if (activeTab === 'reports') {
        const reportsData = await taskDb.fetchClassReportsData(classData.id);
        setReportSubmissions(reportsData.submissions);
        setReportGroups(reportsData.groups);
        setReportGroupMembers(reportsData.groupMembers);
      } else if (activeTab === 'badges') {
        const [defs, sBadges] = await Promise.all([
          badgeDb.fetchBadgeDefinitions(classData.id),
          badgeDb.fetchStudentBadges(classData.id)
        ]);
        setBadgeDefinitions(defs);
        setStudentBadges(sBadges);
      }
      
      // Refresh tasks tab specific if needed
      const fetchedTasks = await taskDb.fetchTasksByClass(classData.id);
      setAllTasks(fetchedTasks);
      
      // Refresh modal data if open
      if (selectedTaskForSubmissions) {
        let subs;
        if (selectedTaskForSubmissions.task_type === 'group') {
          const rawSubs = await taskDb.fetchGroupTaskSubmissions(selectedTaskForSubmissions.id, classData.id);
          subs = rawSubs.map((s: any) => ({
            ...s,
            id: s.submission_id || s.group_id,
            studentName: s.group_name,
            isGroup: true,
            created_at: s.created_at || null,
            members: (s.group_members || []).map((m: any) => m.nickname ? `${m.name} (${m.nickname})` : m.name),
            group_members_raw: s.group_members || []
          }));
        } else {
          subs = await taskDb.fetchTaskSubmissions(selectedTaskForSubmissions.id, classData.id);
        }
        setTaskSubmissions(subs);
        if (selectedSubmissionForReview) {
          const updated = subs.find((s: any) => s.id === selectedSubmissionForReview.id);
          setSelectedSubmissionForReview(updated || null);
        }
      }

      setLastSynced(new Date());
    } catch (err) {
      console.error(err);
      alert('Could not sync data. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-8">
        <button
          onClick={onBack}
          className="mc-back-link mb-6"
        >
          <ArrowLeft size={14} className="mc-back-icon" />
          Back to Dashboard
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/50 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden select-none">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight truncate flex items-center gap-2">
                {classData.name}
              </h1>
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 shadow-inner">
                <Key size={12} className="text-rose-400" />
                <span className="font-mono font-bold text-xs text-rose-400 tracking-wider">{classData.joinCode}</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(classData.joinCode);
                    alert('Join code copied!');
                  }}
                  className="text-slate-500 hover:text-white p-0.5 ml-1 transition-colors cursor-pointer"
                  title="Copy Join Code"
                >
                  <Copy size={11} />
                </button>
                <button 
                  onClick={() => {
                    if (confirm('Regenerate join code? Students will need the new code to log in.')) {
                      onRegenerateJoinCode();
                    }
                  }}
                  className="text-slate-500 hover:text-white p-0.5 transition-colors cursor-pointer"
                  title="Regenerate Join Code"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-900 text-slate-300 font-mono">
                <Users size={12} className="text-rose-500/70" /> LEVEL: <strong className="text-white font-semibold">{classData.level}</strong>
              </span>
              {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-900 text-slate-300 font-mono">
                  <Shield size={12} className="text-rose-500/70" /> MAX LIVES: <strong className="text-white font-semibold">{classData.maxLives}</strong>
                </span>
              )}
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-900 text-slate-300 font-mono">
                <Play size={12} className="text-rose-500/70" /> SESSIONS: <strong className="text-white font-semibold">{classData.meetings.length}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:ml-auto shrink-0">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="bg-slate-950 hover:bg-slate-900 text-blue-400 hover:text-blue-300 px-4 py-2.5 rounded-xl font-mono uppercase tracking-wider text-xs font-bold border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm h-full relative min-h-[42px]"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
              {lastSynced && !isSyncing && (
                <span className="absolute -bottom-5 right-0 text-[8px] text-slate-500 whitespace-nowrap hidden lg:block">
                  Last: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </button>
            {activeMeeting ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <div className="text-left">
                    <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">Active Stream</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Started: {new Date(activeMeeting.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsEndMeetingModalOpen(true)}
                  className="bg-red-950/40 hover:bg-red-600 border border-red-500/20 hover:border-red-500/50 text-red-400 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all font-bold cursor-pointer"
                >
                  End Meeting
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsMeetingModalOpen(true)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/15"
              >
                <Play size={14} className="fill-current text-white" />
                Initialize Meeting
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-wrap gap-2 mb-6 select-none bg-slate-900/30 p-1.5 rounded-2xl border border-slate-800/60 backdrop-blur-sm">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-xl transition-all border cursor-pointer ${
            activeTab === 'roster'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold shadow-[0_0_10px_rgba(244,63,94,0.12)]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <Users size={13} /> Roster
        </button>
        {classData.category !== 'private' && (
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-xl transition-all border cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold shadow-[0_0_10px_rgba(245,158,11,0.12)]'
                : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-900/40'
            }`}
          >
            <Trophy size={13} /> Leaderboard
          </button>
        )}
        <button
          onClick={() => setActiveTab('activity_log')}
          className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-xl transition-all border cursor-pointer ${
            activeTab === 'activity_log'
              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 font-bold shadow-[0_0_10px_rgba(99,102,241,0.12)]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <Clock size={13} /> Activity Log
        </button>
        <button
          onClick={() => setActiveTab('meetings')}
          className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-xl transition-all border cursor-pointer ${
            activeTab === 'meetings'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold shadow-[0_0_10px_rgba(16,185,129,0.12)]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <Play size={13} /> Session History
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-xl transition-all border cursor-pointer ${
            activeTab === 'tasks'
              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 font-bold shadow-[0_0_10px_rgba(168,85,247,0.12)]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <CheckSquare size={13} /> Tasks
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-xl transition-all border cursor-pointer ${
            activeTab === 'badges'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold shadow-[0_0_10px_rgba(245,158,11,0.12)]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <Award size={13} /> Badges
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-xl transition-all border cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold shadow-[0_0_10px_rgba(244,63,94,0.12)]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <BarChart2 size={13} /> Reports
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-xl transition-all border cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-slate-500/10 text-slate-300 border-slate-500/30 font-bold shadow-[0_0_10px_rgba(100,116,139,0.12)]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <Settings size={13} /> Settings
        </button>
      </div>

      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* Roster Command Bar (Integrated Form & Reason modifier) */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-4 rounded-2xl shadow-xl flex flex-col xl:flex-row gap-6 xl:items-end justify-between select-none">
            {/* Left: Add Student form */}
            <div className="flex-1 max-w-2xl">
              <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
                Add Student
              </span>
              <form onSubmit={handleAddStudent} className="flex flex-col sm:flex-row items-stretch gap-2.5">
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Enter new student name..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/50 transition-all text-sm font-sans"
                />
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-rose-600/15"
                >
                  <Plus size={15} /> Add
                </button>
              </form>
              <p className="text-[10px] text-slate-500 mt-2 font-mono ml-1">New students start with 50 points.</p>
            </div>

            {/* Right: Attach Reason (Quick Change modifier) */}
            {classData.students.length > 0 && (
              <div className="shrink-0 border-t xl:border-t-0 xl:border-l border-slate-800/80 pt-4 xl:pt-0 xl:pl-6">
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
                  Reason for Point/Life Changes
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedReason}
                    onChange={(e) => {
                      setSelectedReason(e.target.value);
                      if (e.target.value !== 'custom') setCustomReason('');
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all min-w-[180px] max-w-[220px] font-sans"
                  >
                    <option value="">-- No Reason (Quick Change) --</option>
                    <optgroup label="Points Options">
                      <option value="Good answer">Good answer</option>
                      <option value="Great effort">Great effort</option>
                      <option value="Teamwork">Teamwork</option>
                      <option value="Completed homework">Completed homework</option>
                      <option value="Excellent participation">Excellent participation</option>
                    </optgroup>
                    <optgroup label="Lives Options">
                      <option value="Using native language">Using native language</option>
                      <option value="Off-task behavior">Off-task behavior</option>
                      <option value="Arriving late">Arriving late</option>
                      <option value="Disruptive behavior">Disruptive behavior</option>
                      <option value="No homework">No homework</option>
                    </optgroup>
                    <option value="custom">-- Custom Reason --</option>
                  </select>
                  
                  {selectedReason === 'custom' && (
                    <input
                      type="text"
                      placeholder="Enter custom reason..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all w-40 font-sans"
                    />
                  )}

                  {selectedReason !== '' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReason('');
                        setCustomReason('');
                      }}
                      className="text-slate-400 hover:text-rose-400 text-xs font-mono uppercase tracking-wider underline cursor-pointer px-2 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Roster Grid */}
          {classData.students.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/35 border border-dashed border-slate-800/80 rounded-2xl backdrop-blur-sm px-6 max-w-xl mx-auto my-12">
              <Users className="mx-auto h-12 w-12 text-slate-600 mb-4" />
              <h3 className="text-xl font-display font-bold text-white mb-2">Roster Empty</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                Add your first student to this class roster using the form above to begin monitoring stats, tracking lives, and awarding points.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop/Tablet Table View */}
              <div className="hidden sm:block overflow-hidden bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/60 text-[10px] font-mono uppercase tracking-widest text-slate-500 select-none bg-slate-950/20">
                      <th className="py-2.5 px-4 font-semibold">Student Name</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-24">PIN</th>
                      {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                        <th className="py-2.5 px-4 font-semibold text-center w-36">Lives</th>
                      )}
                      <th className="py-2.5 px-4 font-semibold text-center w-64">Points Control</th>
                      <th className="py-2.5 px-4 font-semibold text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {rosterStudents.map((student) => {
                      const status = getStudentStatus(student.lives, classData.maxLives);
                      return (
                        <tr key={student.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-sm text-white">
                                {student.nickname || student.name}
                              </span>
                              {student.nickname && (
                                <span className="text-[10px] text-slate-500 font-medium font-sans">
                                  ({student.name})
                                </span>
                              )}
                              {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${status.color} select-none`}>
                                  {status.label}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-4 text-center font-mono text-xs text-slate-300 font-bold select-none">
                            {student.pin}
                          </td>
                          {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                            <td className="py-2 px-4">
                              <div className="flex items-center justify-center gap-2 select-none">
                                <button
                                  onClick={() => handleUpdateLives(student.id, -1, getActiveReason())}
                                  disabled={student.lives <= 0}
                                  className="w-6 h-6 rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                >
                                  <Minus size={11} />
                                </button>
                                <span className={`font-mono font-bold text-sm ${student.lives === 0 ? 'text-red-500' : 'text-white'} w-6 text-center`}>
                                  {student.lives}
                                </span>
                                <button
                                  onClick={() => handleUpdateLives(student.id, 1, getActiveReason())}
                                  disabled={student.lives >= classData.maxLives}
                                  className="w-6 h-6 rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>
                          )}
                          <td className="py-2 px-4">
                            <div className="flex items-center justify-center gap-3 select-none">
                              <span className="font-mono font-bold text-white text-sm w-10 text-right pr-2 border-r border-slate-800">
                                {student.points}
                              </span>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => handleUpdatePoints(student.id, -5, getActiveReason())} 
                                  disabled={student.points < 5} 
                                  className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  -5
                                </button>
                                <button 
                                  onClick={() => handleUpdatePoints(student.id, -3, getActiveReason())} 
                                  disabled={student.points < 3} 
                                  className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  -3
                                </button>
                                <button 
                                  onClick={() => handleUpdatePoints(student.id, -1, getActiveReason())} 
                                  disabled={student.points < 1} 
                                  className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  -1
                                </button>
                                <button 
                                  onClick={() => handleUpdatePoints(student.id, 1, getActiveReason())} 
                                  className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                                >
                                  +1
                                </button>
                                <button 
                                  onClick={() => handleUpdatePoints(student.id, 3, getActiveReason())} 
                                  className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-medium cursor-pointer"
                                >
                                  +3
                                </button>
                                <button 
                                  onClick={() => handleUpdatePoints(student.id, 5, getActiveReason())} 
                                  className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-semibold cursor-pointer"
                                >
                                  +5
                                </button>
                                <button 
                                  onClick={() => handleUpdatePoints(student.id, 10, getActiveReason())} 
                                  className="text-[9px] px-1.5 py-0.5 font-mono rounded bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/30 text-white font-bold cursor-pointer"
                                >
                                  +10
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenAwardModal(student.id)}
                                className="text-slate-500 hover:text-amber-400 p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Award Badge"
                              >
                                <Award size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingStudentId(student.id);
                                  setEditStudentName(student.name);
                                  setEditStudentNickname(student.nickname || '');
                                }}
                                className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Edit Student"
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Grid Card View */}
              <div className="grid grid-cols-1 gap-3 sm:hidden">
                {rosterStudents.map((student) => {
                  const status = getStudentStatus(student.lives, classData.maxLives);
                  return (
                    <div key={student.id} className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 relative group hover:border-slate-700/60 transition-all duration-200 shadow-md">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display font-bold text-sm text-white truncate flex items-center gap-1.5">
                            {student.nickname || student.name}
                          </h3>
                          {student.nickname && (
                            <p className="text-[10px] text-slate-500 font-medium truncate">
                              Real Name: {student.name}
                            </p>
                          )}
                          {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                            <div className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${status.color} select-none`}>
                              {status.label}
                            </div>
                          )}
                          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 font-mono select-none">
                            <Key size={10} className="text-rose-500/70" /> PIN: <strong className="text-slate-300 font-semibold">{student.pin}</strong>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenAwardModal(student.id)}
                            className="text-slate-500 hover:text-amber-400 p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Award Badge"
                          >
                            <Award size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingStudentId(student.id);
                              setEditStudentName(student.name);
                              setEditStudentNickname(student.nickname || '');
                            }}
                            className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Edit Student"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className={`grid ${getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5`}>
                        {/* Lives Control */}
                        {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 flex flex-col justify-between select-none">
                            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1.5">
                              <Shield size={12} className="text-red-400" /> Lives
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <button
                                onClick={() => handleUpdateLives(student.id, -1, getActiveReason())}
                                disabled={student.lives <= 0}
                                className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                              >
                                <Minus size={16} />
                              </button>
                              <span className={`font-mono text-xl font-bold ${student.lives === 0 ? 'text-red-500' : 'text-white'}`}>
                                {student.lives}
                              </span>
                              <button
                                onClick={() => handleUpdateLives(student.id, 1, getActiveReason())}
                                disabled={student.lives >= classData.maxLives}
                                className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Points Control */}
                        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 flex flex-col justify-between select-none">
                          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><Star size={12} className="text-amber-400" /> Points</span>
                            <span className="font-mono font-bold text-white text-sm">{student.points}</span>
                          </div>
                          <div className="flex flex-col gap-2 mt-2">
                            <div className="flex items-center justify-between gap-2">
                              <button onClick={() => handleUpdatePoints(student.id, -5, getActiveReason())} disabled={student.points < 5} className="flex-1 text-sm py-2.5 font-mono rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">-5</button>
                              <button onClick={() => handleUpdatePoints(student.id, -3, getActiveReason())} disabled={student.points < 3} className="flex-1 text-sm py-2.5 font-mono rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">-3</button>
                              <button onClick={() => handleUpdatePoints(student.id, -1, getActiveReason())} disabled={student.points < 1} className="flex-1 text-sm py-2.5 font-mono rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">-1</button>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <button onClick={() => handleUpdatePoints(student.id, 1, getActiveReason())} className="flex-1 text-sm py-2.5 font-mono rounded-lg bg-rose-950/60 border border-rose-500/30 hover:bg-rose-500/30 text-rose-400 cursor-pointer font-medium">+1</button>
                              <button onClick={() => handleUpdatePoints(student.id, 3, getActiveReason())} className="flex-1 text-sm py-2.5 font-mono rounded-lg bg-rose-950/60 border border-rose-500/30 hover:bg-rose-500/30 text-rose-400 cursor-pointer font-medium">+3</button>
                              <button onClick={() => handleUpdatePoints(student.id, 5, getActiveReason())} className="flex-1 text-sm py-2.5 font-mono rounded-lg bg-rose-950/60 border border-rose-500/30 hover:bg-rose-500/30 text-rose-400 cursor-pointer font-bold">+5</button>
                              <button onClick={() => handleUpdatePoints(student.id, 10, getActiveReason())} className="flex-1 text-sm py-2.5 font-mono rounded-lg bg-rose-600/30 border border-rose-500/40 hover:bg-rose-600/40 text-white font-bold cursor-pointer">+10</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {classData.category !== 'private' && activeTab === 'leaderboard' && (
        <div className="space-y-4 animate-fade-in">
          <div className="overflow-hidden bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl shadow-xl max-w-2xl">
            {sortedStudents.length === 0 ? (
              <div className="p-6 text-center text-slate-500 font-sans text-xs">No students registered to display on the leaderboard.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/60 text-[10px] font-mono uppercase tracking-widest text-slate-500 select-none bg-slate-950/25">
                    <th className="py-2 px-3.5 font-bold w-16 text-center">Rank</th>
                    <th className="py-2 px-3.5 font-bold">Student Name</th>
                    <th className="py-2 px-3.5 font-bold text-center w-28">Status / Lives</th>
                    <th className="py-2 px-3.5 font-bold text-right w-28">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {sortedStudents.map((student, idx) => {
                    const rank = idx + 1;
                    const maxLives = classData.maxLives || 5;
                    const livesArr = Array.from({ length: maxLives });

                    return (
                      <tr key={student.id} className="hover:bg-slate-900/30 transition-all text-xs">
                        <td className="py-1.5 px-3.5 text-center select-none">
                          {rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs" title="1st Place">🥇</span>
                          ) : rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full bg-slate-400/10 border border-slate-400/20 text-slate-300 font-bold text-xs" title="2nd Place">🥈</span>
                          ) : rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full bg-amber-700/10 border border-amber-700/20 text-amber-600 font-bold text-xs" title="3rd Place">🥉</span>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px] font-bold">#{rank}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display font-bold text-slate-200">
                              {student.nickname || student.name}
                            </span>
                            {student.nickname && (
                              <span className="text-[10px] text-slate-500 font-medium font-sans">
                                ({student.name})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-3.5 text-center">
                          <div className="inline-flex items-center gap-0.5 justify-center">
                            {livesArr.map((_, i) => (
                              <span
                                key={i}
                                className={`text-[10px] ${
                                  i < (student.lives ?? 5) ? 'text-red-500 drop-shadow-[0_0_2px_rgba(239,68,68,0.2)]' : 'text-slate-800'
                                }`}
                              >
                                ❤️
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-1.5 px-3.5 text-right font-mono text-xs text-rose-400 font-extrabold">{student.points.toLocaleString()} pts</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'activity_log' && (
        <div className="space-y-6">
          {isTableMissing ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-white mb-2">
                    Initialize Classroom Timeline & Logs
                  </h3>
                  <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                    To track points history, customize rewards/behaviors, and unlock the <strong>Undo/Redo</strong> capabilities, you need to execute a database migration inside your Supabase dashboard.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <h4 className="text-sm font-semibold text-slate-300">How to Setup:</h4>
                <ol className="list-decimal list-inside text-slate-400 space-y-2">
                  <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Supabase Dashboard</a>.</li>
                  <li>Select your project, then open the <strong>SQL Editor</strong> in the left sidebar.</li>
                  <li>Click <strong>New Query</strong>, paste the SQL schema below, and click <strong>Run</strong>.</li>
                  <li>Return here and click <button onClick={loadLogs} className="text-indigo-400 hover:underline font-semibold cursor-pointer">Sync Logs</button> to unlock the timeline!</li>
                </ol>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-mono">SUPABASE MIGRATION SQL</span>
                  <button
                    onClick={() => {
                      const sqlBlock = `CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  points_delta integer DEFAULT 0,
  lives_delta integer DEFAULT 0,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  undone boolean DEFAULT false,
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow teachers to select activity logs for owned classes" ON public.activity_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

CREATE POLICY "Allow students to select their own logs" ON public.activity_logs
  FOR SELECT TO anon USING (
    student_id IS NOT NULL
  );

CREATE POLICY "Allow teachers to insert activity logs for owned classes" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

CREATE POLICY "Allow teachers to update activity logs for owned classes" ON public.activity_logs
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

alter publication supabase_realtime add table public.activity_logs;`;
                      navigator.clipboard.writeText(sqlBlock);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer"
                  >
                    {copiedSql ? 'Copied!' : 'Copy SQL Script'}
                  </button>
                </div>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 font-mono overflow-x-auto max-h-60 leading-relaxed scrollbar-thin">
                  {`CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  points_delta integer DEFAULT 0,
  lives_delta integer DEFAULT 0,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  undone boolean DEFAULT false,
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow teachers to select activity logs for owned classes" ON public.activity_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

CREATE POLICY "Allow students to select their own logs" ON public.activity_logs
  FOR SELECT TO anon USING (
    student_id IS NOT NULL
  );

CREATE POLICY "Allow teachers to insert activity logs for owned classes" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

CREATE POLICY "Allow teachers to update activity logs for owned classes" ON public.activity_logs
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

alter publication supabase_realtime add table public.activity_logs;`}
                </pre>
              </div>
            </div>
          ) : (
            <>
              {/* Filtering */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex gap-4 flex-wrap items-center">
                  <div className="flex gap-1.5 flex-wrap">
                    {(['all', 'points', 'lives', 'system'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setLogFilter(filter)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize cursor-pointer ${
                          logFilter === filter
                            ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/15'
                            : 'bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800/60'
                        }`}
                      >
                        {filter === 'all' ? 'All Activities' : filter === 'system' ? 'Roster / Class' : `${filter} changes`}
                      </button>
                    ))}
                  </div>

                  {activeMeeting && (
                    <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800/60">
                      <button
                        onClick={() => setTimelineMeetingFilter('all')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                          timelineMeetingFilter === 'all'
                            ? 'bg-slate-800 text-white font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        All History
                      </button>
                      <button
                        onClick={() => setTimelineMeetingFilter('current')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                          timelineMeetingFilter === 'current'
                            ? 'bg-rose-600 text-white font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Current Session
                      </button>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={loadLogs}
                  className="text-xs text-rose-400 hover:text-rose-300 font-mono flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-xl border border-rose-500/20 cursor-pointer transition-all"
                >
                  <RefreshCw size={12} className={isLogsLoading ? 'animate-spin' : ''} />
                  Sync Logs
                </button>
              </div>

              {/* Activity Logs Timeline */}
              {isLogsLoading && activityLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3">
                  <Loader2 className="animate-spin text-slate-600" size={24} />
                  <span className="font-medium text-sm">Loading classroom timeline...</span>
                </div>
              ) : (
                (() => {
                  const filtered = activityLogs.filter((log) => {
                    if (timelineMeetingFilter === 'current') {
                      if (!activeMeeting) return false;
                      if (log.meeting_id !== activeMeeting.id) return false;
                    }

                    if (logFilter === 'all') return true;
                    if (logFilter === 'points') return log.action_type === 'points_changed';
                    if (logFilter === 'lives') return log.action_type === 'lives_changed';
                    if (logFilter === 'system') {
                      return [
                        'class_created',
                        'class_claimed',
                        'class_updated',
                        'join_code_regenerated',
                        'student_added',
                        'student_updated',
                        'student_deleted',
                        'student_pin_reset',
                        'meeting_started',
                        'meeting_ended'
                      ].includes(log.action_type);
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
                        No matching activity logs found.
                      </div>
                    );
                  }

                  const handleUndo = async (logId: string) => {
                    if (!confirm('Are you sure you want to undo this action? This will reverse the score/lives change.')) return;
                    try {
                      await db.undoActivityLog(logId);
                      await loadLogs();
                    } catch (err: any) {
                      alert(err.message || 'Failed to undo action.');
                    }
                  };

                  return (
                    <div className="space-y-3 max-w-3xl">
                      {filtered.map((log) => {
                        const isPoints = log.action_type === 'points_changed';
                        const isLives = log.action_type === 'lives_changed';
                        const isUndoable = (isPoints || isLives) && !log.undone;
                        const isCurrentSessionLog = activeMeeting && log.meeting_id === activeMeeting.id;

                        // Formulate nice human-readable message
                        let title = '';
                        let details = '';
                        let badgeColor = 'bg-slate-800 text-slate-400';

                        if (log.action_type === 'points_changed') {
                           const delta = log.points_delta || 0;
                           const sign = delta > 0 ? '+' : '';
                           title = `${sign}${delta} points`;
                           details = `awarded to ${log.studentName || 'Student'}`;
                           badgeColor = delta > 0 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20';
                        } else if (log.action_type === 'lives_changed') {
                           const delta = log.lives_delta || 0;
                           const sign = delta > 0 ? '+' : '';
                           title = `${sign}${delta} lives`;
                           details = `for ${log.studentName || 'Student'}`;
                           badgeColor = delta > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20';
                        } else if (log.action_type === 'class_created') {
                           title = 'Class Created';
                           details = `"${log.metadata?.name || 'Class'}" initialized`;
                           badgeColor = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                        } else if (log.action_type === 'class_claimed') {
                           title = 'Class Claimed';
                           details = `Linked securely to teacher account`;
                           badgeColor = 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
                        } else if (log.action_type === 'class_updated') {
                           title = 'Class Edited';
                           details = `Max Lives: ${log.metadata?.max_lives || 'N/A'}`;
                           badgeColor = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
                        } else if (log.action_type === 'join_code_regenerated') {
                           title = 'Join Code Reset';
                           details = `New code: ${log.metadata?.new_code || 'N/A'}`;
                           badgeColor = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
                        } else if (log.action_type === 'student_added') {
                           title = 'Student Registered';
                           details = `"${log.metadata?.student_name || 'Student'}" joined the roster`;
                           badgeColor = 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
                        } else if (log.action_type === 'student_updated') {
                           title = 'Student Profile Edited';
                           details = `"${log.metadata?.name || 'Student'}" updated`;
                           badgeColor = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
                        } else if (log.action_type === 'student_deleted') {
                           title = 'Student Removed';
                           details = `"${log.metadata?.student_name || 'Student'}" removed`;
                           badgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                        } else if (log.action_type === 'student_pin_reset') {
                           title = 'Student PIN Reset';
                           details = `New credentials generated`;
                           badgeColor = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
                        } else if (log.action_type === 'meeting_started') {
                           title = 'New Session Started';
                           details = `All student lives restored to ${log.metadata?.reset_lives_to || classData.maxLives}`;
                           badgeColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                        } else if (log.action_type === 'meeting_ended') {
                           title = 'Session Ended';
                           details = `Duration: ${log.metadata?.duration || 'N/A'}. Point changes: ${log.metadata?.total_points || 0}. Lives lost: ${log.metadata?.lives_lost || 0}.`;
                           badgeColor = 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
                        } else if (log.action_type === 'action_undone') {
                           title = 'Action Undone';
                           details = log.reason || '';
                           badgeColor = 'bg-slate-850 text-slate-400 border border-slate-800';
                        }

                        return (
                          <div
                            key={log.id}
                            className={`bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-xl p-2 px-3.5 flex items-center justify-between gap-4 transition-all ${
                              log.undone ? 'opacity-30 select-none' : ''
                            }`}
                          >
                            <div className="flex flex-1 items-center gap-3 min-w-0">
                              {/* Left: action type badge */}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 border ${badgeColor}`}>
                                {title}
                              </span>

                              {/* Middle: Name/Detail info and Timestamp */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-0.5 flex-1 min-w-0">
                                <p className={`text-xs font-semibold text-slate-200 truncate ${log.undone ? 'line-through' : ''}`}>
                                  {details}
                                  {log.reason && (
                                    <span className="text-slate-400 font-sans italic text-[11px] ml-2 normal-case">
                                      — "{log.reason}"
                                    </span>
                                  )}
                                </p>
                                {isCurrentSessionLog && (
                                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-extrabold px-1.5 py-0.25 rounded uppercase tracking-wider shrink-0 self-start sm:self-auto">
                                    Current Session
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500 font-mono sm:ml-auto shrink-0 select-none">
                                  {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                            </div>

                            {/* Right: Actions */}
                            {isUndoable && (
                              <button
                                onClick={() => handleUndo(log.id)}
                                className="text-[10px] bg-slate-950 border border-slate-850 hover:border-slate-750 hover:text-red-400 text-slate-400 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all font-bold uppercase tracking-wider cursor-pointer shrink-0"
                              >
                                <Undo2 size={10} />
                                Undo
                              </button>
                            )}

                            {log.undone && (
                              <span className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded font-extrabold font-mono tracking-wider uppercase shrink-0">
                                Undone
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'meetings' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Meeting History</h2>
              <p className="text-sm text-slate-400">Review class sessions, summaries, and performance metrics.</p>
            </div>
          </div>

          {classData.meetings.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl text-slate-500">
              Start a class session to automatically generate meeting logs and summaries.
            </div>
          ) : (
            <div className="space-y-3 max-w-4xl animate-fade-in">
              {classData.meetings.map((meeting) => {
                const isActive = meeting.status === 'active';
                const startedTime = new Date(meeting.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                const endedTime = meeting.endedAt 
                  ? new Date(meeting.endedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) 
                  : 'Active Now';

                return (
                  <div
                    key={meeting.id}
                    className={`bg-slate-900/30 backdrop-blur-sm border rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      isActive ? 'border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.04)] bg-slate-900/80' : 'border-slate-800/80 hover:border-slate-700/60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                      {/* Left: Status and Timing info */}
                      <div className="space-y-1 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          {isActive ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider animate-pulse">
                              <span className="h-1 w-1 rounded-full bg-emerald-400" />
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">
                              Ended
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono">
                            Lives reset: {meeting.resetLivesTo}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 space-y-0.5">
                          <div><span className="text-slate-500 text-[11px]">Start:</span> <span className="font-semibold">{startedTime}</span></div>
                          {!isActive && <div><span className="text-slate-500 text-[11px]">End:</span> <span className="font-semibold text-slate-400">{endedTime}</span></div>}
                        </div>
                      </div>

                      {/* Middle: Summary Stats */}
                      {meeting.summary ? (
                        <div className={`grid grid-cols-2 gap-x-4 gap-y-1 bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-850/60 flex-1 max-w-xl text-[11px] font-mono text-slate-400 ${getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                          <div>Duration: <span className="text-slate-200 font-bold">{meeting.summary.duration}</span></div>
                          <div>Actions: <span className="text-slate-200 font-bold">{meeting.summary.total_actions}</span></div>
                          <div>Points: <span className="text-rose-400 font-bold">{meeting.summary.total_point_changes}</span></div>
                          {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                            <div>Lives Lost: <span className="text-red-400 font-bold">❤️ {meeting.summary.total_lives_lost}</span></div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic bg-slate-950/20 px-3 py-2 rounded-lg border border-slate-850/30 flex-1 max-w-xl">
                          No intermediate summary statistics generated yet
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center font-sans">
                      {isActive ? (
                        <button
                          onClick={() => setIsEndMeetingModalOpen(true)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                        >
                          End Meeting
                        </button>
                      ) : meeting.summary ? (
                        <button
                          onClick={() => setSelectedMeetingForSummary(meeting)}
                          className="bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow"
                        >
                          Summary Report
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic font-mono uppercase">No Report</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {isTasksTableMissing ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-white mb-2">
                    Initialize Tasks & Mission Control Tables
                  </h3>
                  <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                    To enable task creation, reward points assignment, team collaborations, and mission control, you need to execute a database migration inside your Supabase dashboard.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <h4 className="text-sm font-semibold text-slate-300">How to Setup:</h4>
                <ol className="list-decimal list-inside text-slate-400 space-y-2">
                  <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Supabase Dashboard</a>.</li>
                  <li>Select your project, then open the <strong>SQL Editor</strong> in the left sidebar.</li>
                  <li>Click <strong>New Query</strong>, paste the SQL schema below, and click <strong>Run</strong>.</li>
                  <li>Return here and click <button onClick={loadTasks} className="text-purple-400 hover:underline font-semibold cursor-pointer font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">Sync Tasks</button> to unlock the missions!</li>
                </ol>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-mono">SUPABASE TASKS MIGRATION SQL</span>
                  <button
                    onClick={() => {
                      const sqlBlock = `CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'individual',
  status text NOT NULL DEFAULT 'draft',
  due_at timestamptz,
  reward_points integer NOT NULL DEFAULT 0,
  allow_text_submission boolean NOT NULL DEFAULT true,
  allow_attachment_submission boolean NOT NULL DEFAULT false,
  max_attachments integer NOT NULL DEFAULT 1,
  max_attachment_size_mb integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_task_type CHECK (task_type IN ('individual', 'group')),
  CONSTRAINT check_status CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  CONSTRAINT check_reward_points CHECK (reward_points >= 0),
  CONSTRAINT check_max_attachments CHECK (max_attachments >= 0 AND max_attachments <= 5),
  CONSTRAINT check_max_attachment_size CHECK (max_attachment_size_mb >= 1 AND max_attachment_size_mb <= 25)
);

CREATE TABLE IF NOT EXISTS public.task_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_group_id uuid NOT NULL REFERENCES public.task_groups(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_group_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  task_group_id uuid REFERENCES public.task_groups(id) ON DELETE CASCADE,
  submitted_by_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  submission_text text,
  status text NOT NULL DEFAULT 'submitted',
  teacher_feedback text,
  awarded_points integer,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_submission_status CHECK (status IN ('submitted', 'reviewed', 'returned', 'late'))
);

CREATE TABLE IF NOT EXISTS public.submission_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.task_submissions(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  task_group_id uuid REFERENCES public.task_groups(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size_bytes bigint,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can select tasks for owned classes" ON public.tasks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classes WHERE classes.id = tasks.class_id AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL))
);
CREATE POLICY "Teachers can insert tasks for owned classes" ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.classes WHERE classes.id = tasks.class_id AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL))
);
CREATE POLICY "Teachers can update tasks for owned classes" ON public.tasks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classes WHERE classes.id = tasks.class_id AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.classes WHERE classes.id = tasks.class_id AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL))
);
CREATE POLICY "Teachers can delete tasks for owned classes" ON public.tasks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classes WHERE classes.id = tasks.class_id AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL))
);
CREATE POLICY "Students can view published tasks" ON public.tasks FOR SELECT TO anon USING (
  status = 'published' OR status = 'closed' OR status = 'archived'
);

CREATE POLICY "Teachers can manage task groups" ON public.task_groups FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classes WHERE classes.id = task_groups.class_id AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL))
);
CREATE POLICY "Students can view task groups" ON public.task_groups FOR SELECT TO anon USING (true);

CREATE POLICY "Teachers can manage group members" ON public.task_group_members FOR ALL TO authenticated USING (true);
CREATE POLICY "Students can view group members" ON public.task_group_members FOR SELECT TO anon USING (true);

CREATE POLICY "Teachers can manage submissions" ON public.task_submissions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classes WHERE classes.id = task_submissions.class_id AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL))
);
CREATE POLICY "Students can view their own submissions" ON public.task_submissions FOR SELECT TO anon USING (true);

CREATE POLICY "Teachers can view attachments" ON public.submission_attachments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classes WHERE classes.id = submission_attachments.class_id AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL))
);
CREATE POLICY "Students can view their own attachments" ON public.submission_attachments FOR SELECT TO anon USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_group_members;`;
                      navigator.clipboard.writeText(sqlBlock);
                      setCopiedTasksSql(true);
                      setTimeout(() => setCopiedTasksSql(false), 2000);
                    }}
                    className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer"
                  >
                    {copiedTasksSql ? 'Copied!' : 'Copy SQL Script'}
                  </button>
                </div>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 font-mono overflow-x-auto max-h-60 leading-relaxed scrollbar-thin">
                  {`CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'individual',
  status text NOT NULL DEFAULT 'draft',
  due_at timestamptz,
  reward_points integer NOT NULL DEFAULT 0,
  allow_text_submission boolean NOT NULL DEFAULT true,
  allow_attachment_submission boolean NOT NULL DEFAULT false,
  max_attachments integer NOT NULL DEFAULT 1,
  max_attachment_size_mb integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Note: The copied SQL script also provisions the groups, submissions, and attachments tables with matching RLS Policies. Please copy the script using the button above.`}
                </pre>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center select-none">
                <div>
                  <h2 className="text-xl font-display font-bold text-white">Classroom Tasks</h2>
                  <p className="text-sm text-slate-400">Manage assignments, submissions, points, and task status.</p>
                </div>
                <button
                  onClick={openCreateTaskModal}
                  className="bg-purple-650 hover:bg-purple-750 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg hover:shadow-purple-550/10"
                >
                  <PlusCircle size={14} />
                  Create Classroom Task
                </button>
              </div>

              {/* Submission Review Queue Summary */}
              {tasks.length > 0 && (() => {
                let needsReview = 0;
                let reviewed = 0;
                let notSubmitted = 0;
                
                // Approximate 'not submitted' using simple math (students * individual tasks - total submissions)
                // This is a rough estimation just for the high-level dashboard queue summary.
                const individualTasks = tasks.filter(t => t.task_type === 'individual' && t.status !== 'draft');
                const expectedTotal = individualTasks.length * classData.students.length;
                let currentSubmissionsInPublishedTasks = 0;

                allSubmissions.forEach(sub => {
                  const task = tasks.find(t => t.id === sub.task_id);
                  if (task && task.status !== 'draft') {
                    if (task.task_type === 'individual') {
                      currentSubmissionsInPublishedTasks++;
                    }
                    const st = getSubmissionStatus(sub);
                    if (st === 'Needs Review' || st === 'Submitted (Late)') needsReview++;
                    if (st === 'Reviewed' || st === 'Needs Revision') reviewed++;
                  }
                });

                notSubmitted = Math.max(0, expectedTotal - currentSubmissionsInPublishedTasks);

                return (
                  <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-4 animate-fade-in shadow-xl select-none">
                    <h3 className="text-sm font-bold text-slate-300 font-mono tracking-wider uppercase mb-3 flex items-center gap-2">
                      <FileText size={14} className="text-purple-400" /> Submission Review Queue
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-950/50 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors"></div>
                        <span className="text-2xl font-bold text-amber-500 font-mono relative z-10">{needsReview}</span>
                        <span className="text-[10px] uppercase font-bold text-amber-500/70 tracking-wider relative z-10 mt-1">Needs Review</span>
                      </div>
                      
                      <div className="bg-slate-950/50 border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors"></div>
                        <span className="text-2xl font-bold text-emerald-500 font-mono relative z-10">{reviewed}</span>
                        <span className="text-[10px] uppercase font-bold text-emerald-500/70 tracking-wider relative z-10 mt-1">Reviewed</span>
                      </div>

                      <div className="bg-slate-950/50 border border-purple-500/20 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors"></div>
                        <span className="text-2xl font-bold text-purple-400 font-mono relative z-10">{needsReview + reviewed}</span>
                        <span className="text-[10px] uppercase font-bold text-purple-400/70 tracking-wider relative z-10 mt-1">Submitted</span>
                      </div>

                      <div className="bg-slate-950/50 border border-slate-700/50 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-slate-800/10 group-hover:bg-slate-800/20 transition-colors"></div>
                        <span className="text-2xl font-bold text-slate-500 font-mono relative z-10">{notSubmitted}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500/70 tracking-wider relative z-10 mt-1">Not Submitted</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {isTasksLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3">
                  <Loader2 className="animate-spin text-slate-600" size={24} />
                  <span className="font-mono text-xs">Loading classroom tasks...</span>
                </div>
              ) : tasks.length === 0 ? (
                <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 space-y-3 shadow-lg">
                  <p className="text-sm">Create your first task to start assigning work and grading.</p>
                  <button
                    onClick={openCreateTaskModal}
                    className="bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-slate-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md mt-2 inline-block"
                  >
                    Create Your First Task
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-w-4xl animate-fade-in">
                  {tasks.map((task) => {
                    const isDraft = task.status === 'draft';
                    const isPublished = task.status === 'published';
                    const isClosed = task.status === 'closed';
                    const isArchived = task.status === 'archived';
                    const normalizedTaskType = String(task.task_type || 'individual').toLowerCase();

                    let statusBadgeColor = 'bg-slate-800 text-slate-400 border border-slate-700';
                    if (isPublished) statusBadgeColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
                    if (isClosed) statusBadgeColor = 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
                    if (isArchived) statusBadgeColor = 'bg-slate-900 text-slate-600 border border-slate-855';

                    return (
                      <div
                        key={task.id}
                        className={`bg-slate-900/30 backdrop-blur-sm border rounded-xl p-3.5 transition-all hover:bg-slate-900/50 ${
                          isPublished ? 'border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.03)]' : 'border-slate-800/80'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 select-none">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border ${statusBadgeColor}`}>
                              {task.status}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-950 text-slate-400 border border-slate-850 uppercase tracking-wider">
                              {task.task_type}
                            </span>
                            <span className="text-yellow-400 text-[10px] font-mono font-bold flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                              ★ {task.reward_points} pts
                            </span>
                            {task.due_at && (
                              <span className="text-slate-500 font-mono text-[10px] ml-1">
                                Due: {new Date(task.due_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-slate-100">{task.title}</h3>
                            {task.description && (
                              <p className="text-xs text-slate-400 line-clamp-1 leading-relaxed max-w-2xl">{task.description}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-500 font-mono">
                            <span>
                              Allowed: {task.allow_text_submission ? 'Text' : ''}
                              {task.allow_text_submission && task.allow_attachment_submission ? ' + ' : ''}
                              {task.allow_attachment_submission ? `Attachments (Max ${task.max_attachments}, Limit ${task.max_attachment_size_mb}MB)` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Submissions & Quick Actions on the Right */}
                        <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 shrink-0 self-start lg:self-center">
                          {/* Submission Tracker */}
                          {(() => {
                            const summary = getTaskSubmissionSummary(task, classData.students, allSubmissions);
                            return (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 select-none">
                                {normalizedTaskType === 'individual' ? (
                                  <div className="text-[11px] text-slate-400 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-850 flex items-center gap-1.5 font-semibold font-mono">
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      summary.totalSubmitted === classData.students.length && classData.students.length > 0 
                                        ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' 
                                        : summary.totalSubmitted > 0 
                                          ? 'bg-amber-500 shadow-[0_0_6px_#f59e0b]' 
                                          : 'bg-slate-650'
                                    }`} />
                                    Submissions: <span className="text-slate-100 font-bold">{summary.totalSubmitted}{'/'}{classData.students.length}</span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-400 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-850 flex items-center gap-1.5 font-semibold font-mono">
                                    <Users size={11} className="text-purple-400" />
                                    <span>Group Task ({summary.totalSubmitted} Subs)</span>
                                  </div>
                                )}
                                
                                {summary.needsReview > 0 && (
                                  <div className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 font-bold uppercase tracking-wider flex items-center gap-1">
                                    {summary.needsReview} Need Review
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Controls Group */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => {
                                openSubmissionsViewer(task);
                              }}
                              className="bg-purple-650 hover:bg-purple-750 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 font-sans"
                            >
                              <FileText size={11} /> 
                              Inbox
                              {isDraft && <span className="text-[8px] font-extrabold uppercase bg-purple-850 text-purple-200 px-1 py-0.25 rounded border border-purple-750">Draft</span>}
                            </button>

                            {isDraft && (
                              <>
                                <button
                                  onClick={() => handlePublishTask(task)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  Publish
                                </button>
                                <button
                                  onClick={() => openEditTaskModal(task)}
                                  className="bg-slate-800 hover:bg-slate-705 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setTaskDeleteConfirmId(task.id)}
                                  className="text-slate-500 hover:text-red-400 p-1.5 transition-colors cursor-pointer"
                                  title="Delete Draft"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}

                            {isPublished && (
                              <>
                                <button
                                  onClick={() => handleCloseTask(task)}
                                  className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                  title="Students can still see this task, but they cannot submit while it is closed."
                                >
                                  Close
                                </button>
                                <button
                                  onClick={() => handleArchiveTask(task)}
                                  className="bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                  title="Hides this task from active task lists while preserving submissions and feedback."
                                >
                                  Archive
                                </button>
                              </>
                            )}

                            {isClosed && (
                              <>
                                <button
                                  onClick={() => handleReopenTask(task)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  Reopen
                                </button>
                                <button
                                  onClick={() => handleArchiveTask(task)}
                                  className="bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                  title="Hides this task from active task lists while preserving submissions and feedback."
                                >
                                  Archive
                                </button>
                              </>
                            )}

                            {isArchived && (
                              <>
                                <button
                                  onClick={() => handleReopenTask(task)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  Reopen
                                </button>
                                <button
                                  onClick={() => setTaskDeleteConfirmId(task.id)}
                                  className="text-slate-500 hover:text-red-400 p-1.5 transition-colors cursor-pointer"
                                  title="Delete Task"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Group Management Area */}
                    {task.task_type === 'group' && (
                      <div className="mt-4 border-t border-slate-800/60 pt-4">
                        <button
                          onClick={() => {
                            if (selectedTaskForGroups?.id === task.id) {
                              setSelectedTaskForGroups(null);
                              setTaskGroups([]);
                            } else {
                              setSelectedTaskForGroups(task);
                              loadTaskGroups(task.id);
                            }
                          }}
                          className="text-xs bg-slate-950 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer"
                        >
                          <Users size={14} />
                          {selectedTaskForGroups?.id === task.id ? 'Hide Task Groups' : 'Manage Task Groups'}
                        </button>
                      </div>
                    )}

                    {selectedTaskForGroups?.id === task.id && (
                      <div className="mt-4 p-4 bg-slate-950/60 border border-purple-500/10 rounded-xl space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                              <Users className="text-purple-400" size={16} />
                              Group Assignment & Collaboration Space
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Set up teams, assign members, and track participation.
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-400 font-medium">Create</label>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={numGroupsToCreate}
                              onChange={(e) => setNumGroupsToCreate(Number(e.target.value))}
                              className="w-12 bg-slate-900 border border-slate-800 text-white rounded px-2 py-1 text-xs text-center focus:outline-none"
                            />
                            <label className="text-xs text-slate-400 font-medium">teams</label>
                            <button
                              onClick={handleCreateMultipleGroups}
                              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Auto-Generate
                            </button>
                          </div>
                        </div>

                        {isGroupsLoading ? (
                          <div className="flex flex-col items-center justify-center py-6 text-slate-500 space-y-2">
                            <Loader2 className="animate-spin text-slate-600" size={20} />
                            <span className="text-xs font-mono">Loading task groups...</span>
                          </div>
                        ) : taskGroups.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500 italic bg-slate-900/30 rounded-lg border border-slate-900">
                            No groups created yet. Use the auto-generator above to build teams instantly.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Groups Grid */}
                            <div className="space-y-4">
                              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Teams</h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                                {taskGroups.map((group) => {
                                  const isRenaming = renamingGroupId === group.id;

                                  return (
                                    <div key={group.id} className="bg-slate-900 border border-slate-850 rounded-xl p-3.5 space-y-3 relative group">
                                      <div className="flex items-center justify-between gap-2">
                                        {isRenaming ? (
                                          <div className="flex gap-1.5 w-full">
                                            <input
                                              type="text"
                                              value={renameGroupValue}
                                              onChange={(e) => setRenameGroupValue(e.target.value)}
                                              className="bg-slate-950 border border-slate-700 text-white text-xs rounded px-1.5 py-0.5 w-full focus:outline-none"
                                            />
                                            <button
                                              onClick={() => handleRenameGroup(group.id)}
                                              className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded"
                                            >
                                              Save
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-sm text-slate-200">{group.name}</span>
                                            <button
                                              onClick={() => {
                                                setRenamingGroupId(group.id);
                                                setRenameGroupValue(group.name);
                                              }}
                                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity cursor-pointer"
                                            >
                                              <Edit2 size={11} />
                                            </button>
                                          </div>
                                        )}

                                        {!isRenaming && (group.members || []).length === 0 && (
                                          <button
                                            onClick={() => handleDeleteGroup(group.id)}
                                            className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                            title="Delete empty group"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </div>

                                      <div className="space-y-1.5">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                          Members ({(group.members || []).length})
                                        </span>
                                        {(group.members || []).length === 0 ? (
                                          <span className="text-[11px] text-slate-500 italic block">No students assigned</span>
                                        ) : (
                                          <div className="flex flex-wrap gap-1.5">
                                            {(group.members || []).map((m) => (
                                              <span
                                                key={m.id}
                                                className="bg-slate-950 text-slate-300 text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-800 flex items-center gap-1"
                                              >
                                                {m.studentName}
                                                <button
                                                  onClick={() => handleRemoveStudentFromGroup(m.id, m.student_id, group.id)}
                                                  className="text-slate-500 hover:text-red-400 font-extrabold cursor-pointer text-xs"
                                                >
                                                  &times;
                                                </button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Quick Assign Dropdown */}
                                      <div className="pt-2 border-t border-slate-800/40">
                                        <select
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val) {
                                              handleAddStudentToGroup(group.id, val);
                                              e.target.value = '';
                                            }
                                          }}
                                          className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] rounded px-2 py-1 w-full focus:outline-none cursor-pointer"
                                        >
                                          <option value="">+ Assign Student</option>
                                          {classData.students
                                            .filter(s => !new Set(taskGroups.flatMap(g => (g.members || []).map(m => m.student_id))).has(s.id))
                                            .map(s => (
                                              <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Unassigned Students Panel */}
                            <div className="bg-slate-900/45 border border-slate-850 rounded-xl p-4 space-y-3 h-fit">
                              <div className="flex justify-between items-center">
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  Unassigned Students ({classData.students.filter(s => !new Set(taskGroups.flatMap(g => (g.members || []).map(m => m.student_id))).has(s.id)).length})
                                </h5>
                              </div>

                              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                                {classData.students.filter(s => !new Set(taskGroups.flatMap(g => (g.members || []).map(m => m.student_id))).has(s.id)).length === 0 ? (
                                  <p className="text-xs text-emerald-400 italic font-semibold">
                                    All class students are assigned to groups!
                                  </p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {classData.students
                                      .filter(s => !new Set(taskGroups.flatMap(g => (g.members || []).map(m => m.student_id))).has(s.id))
                                      .map(s => (
                                        <span
                                          key={s.id}
                                          className="bg-slate-950 text-slate-400 text-xs px-2.5 py-1 rounded-lg border border-slate-850 font-medium"
                                        >
                                          {s.name}
                                        </span>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Delete confirmation modal for task */}
          {taskDeleteConfirmId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-red-500/20 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <div className="flex items-center gap-3 text-red-400 mb-4">
                  <AlertTriangle size={28} />
                  <h3 className="text-xl font-display font-bold text-white">Delete Classroom Task?</h3>
                </div>
                <p className="text-slate-300 mb-6 leading-relaxed text-sm">
                  Are you sure you want to delete this task? This action is permanent and will delete all related groups and sub-records.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setTaskDeleteConfirmId(null)}
                    className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const t = tasks.find(tsk => tsk.id === taskDeleteConfirmId);
                      if (t) {
                        handleDeleteTask(t.id, t.title);
                      }
                    }}
                    className="bg-red-650 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Task creation / edit Modal */}
          {isTaskModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
                  <h3 className="text-lg font-display font-bold text-white">
                    {editingTask ? 'Edit Classroom Task' : 'Create New Classroom Task'}
                  </h3>
                  <button
                    onClick={() => setIsTaskModalOpen(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveTask} className="space-y-4 text-sm text-slate-300">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Task Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Speaking Practice: Daily Routines"
                      value={taskFormTitle}
                      onChange={(e) => setTaskFormTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                    <textarea
                      rows={3}
                      placeholder="Write the instructions, examples, and what students need to submit..."
                      value={taskFormDescription}
                      onChange={(e) => setTaskFormDescription(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-600 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Task Structure</label>
                      <select
                        value={taskFormType}
                        onChange={(e) => setTaskFormType(e.target.value as 'individual' | 'group')}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="individual">Individual Task</option>
                        <option value="group">Group Task</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Reward points</label>
                      <input
                        type="number"
                        min="0"
                        value={taskFormRewardPoints}
                        onChange={(e) => setTaskFormRewardPoints(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-center font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Due Date <span className="text-[10px] font-normal normal-case text-slate-500 ml-1">(Choose a date or use a quick option)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={taskFormDueAt}
                      onChange={(e) => setTaskFormDueAt(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-4 pr-2 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:bg-slate-800 [&::-webkit-calendar-picker-indicator]:hover:bg-slate-700 [&::-webkit-calendar-picker-indicator]:p-2 [&::-webkit-calendar-picker-indicator]:rounded-md [&::-webkit-calendar-picker-indicator]:transition-colors [&::-webkit-calendar-picker-indicator]:border [&::-webkit-calendar-picker-indicator]:border-slate-700"
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleQuickDueDate('none')}
                        className="text-xs px-2.5 py-1 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        No Due Date
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDueDate('today')}
                        className="text-xs px-2.5 py-1 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        End of Today
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDueDate('tomorrow')}
                        className="text-xs px-2.5 py-1 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDueDate('nextWeek')}
                        className="text-xs px-2.5 py-1 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        Next Week
                      </button>
                      {taskFormDueAt && (
                        <button
                          type="button"
                          onClick={() => handleQuickDueDate('none')}
                          className="text-xs px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer ml-auto"
                        >
                          Clear Due Date
                        </button>
                      )}
                    </div>
                    <div className="pt-1 px-1 text-xs text-slate-300">
                      {taskFormDueAt ? (
                        <>Due: <span className="font-semibold text-purple-400">{new Date(taskFormDueAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></>
                      ) : (
                        <span className="text-slate-500 italic">No due date set.</span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-850 pt-4 space-y-3">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Submission formats</span>
                    
                    <div className="flex flex-col gap-2.5">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={taskFormAllowText}
                          onChange={(e) => setTaskFormAllowText(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-850 text-purple-600 focus:ring-purple-500 h-4 w-4"
                        />
                        <span>Allow student to type text submission</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={taskFormAllowAttachment}
                          onChange={(e) => setTaskFormAllowAttachment(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-850 text-purple-600 focus:ring-purple-500 h-4 w-4"
                        />
                        <span>Allow file attachment uploads</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={taskFormAllowResubmission}
                          onChange={(e) => setTaskFormAllowResubmission(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-850 text-purple-600 focus:ring-purple-500 h-4 w-4"
                        />
                        <span>Allow student resubmissions</span>
                      </label>
                    </div>
                  </div>

                  {taskFormAllowAttachment && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-950 p-3 rounded-lg border border-slate-850">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max Attachments</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={taskFormMaxAttachments}
                          onChange={(e) => setTaskFormMaxAttachments(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-center text-slate-300 font-mono focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max File Size (MB)</label>
                        <input
                          type="number"
                          min="1"
                          max="25"
                          value={taskFormMaxSizeMb}
                          onChange={(e) => setTaskFormMaxSizeMb(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-center text-slate-300 font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-850 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsTaskModalOpen(false)}
                      className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      {editingTask ? 'Update Task' : 'Create Task'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div>
              <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
                <BarChart2 className="text-rose-500" /> Mission Control Reports
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Visual insights, analytics, and printable academic summaries for {classData.name}.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadReportData}
                disabled={isReportsLoading}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-slate-700 text-sm cursor-pointer"
              >
                <RefreshCw size={15} className={isReportsLoading ? 'animate-spin' : ''} />
                Refresh Reports
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm cursor-pointer"
              >
                <Printer size={15} />
                Print / Export
              </button>
            </div>
          </div>

          {/* Sub Tab Navigation */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
            {[
              { id: 'overview', label: 'Class Overview' },
              { id: 'students', label: 'Student Progress' },
              { id: 'tasks', label: 'Task Performance' },
              { id: 'meetings', label: 'Meeting Summary' },
              { id: 'badges', label: 'Badge Summary' },
              { id: 'activity', label: 'Activity Summary' },
            ].map((subTab) => (
              <button
                key={subTab.id}
                onClick={() => {
                  setReportsSubTab(subTab.id as any);
                  setSelectedReportStudentId(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer ${
                  reportsSubTab === subTab.id
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {subTab.label}
              </button>
            ))}
          </div>

          {reportsError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              {reportsError}
            </div>
          )}

          {isReportsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <Loader2 className="animate-spin text-rose-500" size={32} />
              <p className="text-slate-400 text-sm">Loading comprehensive class metrics...</p>
            </div>
          ) : (
            <div className="print:bg-white print:text-black">
              {/* RENDER ACTIVE SUBTAB */}
              {reportsSubTab === 'overview' && (() => {
                const totalStudents = classData.students?.length || 0;
                const totalPoints = classData.students?.reduce((sum, s) => sum + s.points, 0) || 0;
                const avgPoints = totalStudents ? Math.round(totalPoints / totalStudents) : 0;
                const sortedByPoints = [...(classData.students || [])].sort((a, b) => b.points - a.points);
                const highestStudent = sortedByPoints[0] || null;
                const lowestStudent = sortedByPoints[sortedByPoints.length - 1] || null;
                const totalBadgesEarned = studentBadges?.length || 0;
                const totalMeetings = classData.meetings?.length || 0;
                const lastMeeting = classData.meetings && classData.meetings.length > 0
                  ? [...classData.meetings].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
                  : null;
                const lastMeetingDate = lastMeeting ? new Date(lastMeeting.startedAt).toLocaleDateString() : 'N/A';

                return (
                  <div className="space-y-6">
                    {/* Key Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
                        <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">Total Crew Members</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-3xl font-bold text-white">{totalStudents}</span>
                          <span className="text-xs text-slate-500">students enlisted</span>
                        </div>
                      </div>
                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
                        <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">Total Class Points</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-3xl font-bold text-rose-500">{totalPoints.toLocaleString()}</span>
                          <span className="text-xs text-slate-500">avg: {avgPoints}/student</span>
                        </div>
                      </div>
                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
                        <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">Badges Awarded</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-3xl font-bold text-amber-500">{totalBadgesEarned}</span>
                          <span className="text-xs text-slate-500">achievements unlocked</span>
                        </div>
                      </div>
                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
                        <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">Logbook Entries</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-3xl font-bold text-purple-500">{activityLogs.length}</span>
                          <span className="text-xs text-slate-500">actions registered</span>
                        </div>
                      </div>
                    </div>

                    {/* Class Standings Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-lg font-display font-bold text-white mb-4">
                          {classData.category !== 'private' ? 'Class Performance Highlights' : 'Class Status Snapshot'}
                        </h3>
                        <div className="space-y-4">
                          {classData.category !== 'private' && (
                            <>
                              <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl">
                                <div>
                                  <p className="text-sm font-medium text-slate-400">Class Top Performer</p>
                                  <p className="text-base font-bold text-white mt-1">
                                    {highestStudent ? (highestStudent.nickname ? `${highestStudent.name} (${highestStudent.nickname})` : highestStudent.name) : 'None'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs text-slate-500 block">Score</span>
                                  <span className="text-lg font-bold text-rose-500">{highestStudent ? highestStudent.points : 0} pts</span>
                                </div>
                              </div>

                              <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl">
                                <div>
                                  <p className="text-sm font-medium text-slate-400">Needs Support</p>
                                  <p className="text-base font-bold text-white mt-1">
                                    {lowestStudent ? (lowestStudent.nickname ? `${lowestStudent.name} (${lowestStudent.nickname})` : lowestStudent.name) : 'None'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs text-slate-500 block">Score</span>
                                  <span className="text-lg font-bold text-slate-400">{lowestStudent ? lowestStudent.points : 0} pts</span>
                                </div>
                              </div>
                            </>
                          )}

                          <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl">
                            <div>
                              <p className="text-sm font-medium text-slate-400">Activity Level</p>
                              <p className="text-base font-bold text-white mt-1">Meetings Hosted</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-500 block">Last Session</span>
                              <span className="text-lg font-bold text-purple-400">{lastMeetingDate}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-lg font-display font-bold text-white mb-4">Classroom Task Activity Summary</h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Total Tasks Created</span>
                            <span className="text-sm font-bold text-white">{allTasks.length}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Active Published Tasks</span>
                            <span className="text-sm font-bold text-purple-400">{allTasks.filter(t => t.status === 'published').length}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Completed/Closed Tasks</span>
                            <span className="text-sm font-bold text-emerald-400">{allTasks.filter(t => t.status === 'closed').length}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Total Task Submissions</span>
                            <span className="text-sm font-bold text-amber-400">{reportSubmissions.length}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                            <span className="text-sm font-medium text-slate-300">Classroom Engagement Rate</span>
                            <span className="text-sm font-bold text-emerald-400">
                              {totalStudents && allTasks.length
                                ? `${Math.round((reportSubmissions.length / (totalStudents * allTasks.length)) * 100)}%`
                                : '0%'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {reportsSubTab === 'students' && (() => {
                const getStudentSubmissions = (studentId: string) => {
                  return reportSubmissions.filter(sub => {
                    if (sub.student_id === studentId) return true;
                    if (sub.task_group_id) {
                      return reportGroupMembers.some(m => m.task_group_id === sub.task_group_id && m.student_id === studentId);
                    }
                    return false;
                  });
                };

                const studentsSorted = [...(classData.students || [])].sort((a, b) => b.points - a.points);

                if (selectedReportStudentId) {
                  const student = classData.students?.find(s => s.id === selectedReportStudentId);
                  if (!student) return null;

                  const studentRank = studentsSorted.findIndex(s => s.id === student.id) + 1;
                  const studentSubs = getStudentSubmissions(student.id);
                  const badgesCount = studentBadges.filter(sb => sb.student_id === student.id).length;
                  const studentLogs = activityLogs.filter(log => log.student_id === student.id);

                  return (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center select-none">
                        <button
                          onClick={() => setSelectedReportStudentId(null)}
                          className="mc-back-link"
                        >
                          <ArrowLeft size={14} className="mc-back-icon" /> Back to Student List
                        </button>
                        <span className="text-[10px] text-slate-500 font-mono">STUDENT ID: {student.id}</span>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                          <div>
                            <h3 className="text-2xl font-display font-bold text-white">
                              {student.name} {student.nickname && <span className="text-rose-500 text-lg">({student.nickname})</span>}
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">Joined: {new Date(student.joinedAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-6">
                            {classData.category !== 'private' && (
                              <div className="text-center bg-slate-950/40 p-3 rounded-lg border border-slate-800 min-w-[80px]">
                                <span className="text-xs text-slate-500 block">Rank</span>
                                <span className="text-lg font-bold text-amber-500">#{studentRank}</span>
                              </div>
                            )}
                            <div className="text-center bg-slate-950/40 p-3 rounded-lg border border-slate-800 min-w-[80px]">
                              <span className="text-xs text-slate-500 block">Points</span>
                              <span className="text-lg font-bold text-rose-500">{student.points}</span>
                            </div>
                            <div className="text-center bg-slate-950/40 p-3 rounded-lg border border-slate-800 min-w-[80px]">
                              <span className="text-xs text-slate-500 block">Lives</span>
                              <span className="text-lg font-bold text-red-500">❤️ {student.lives}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Task Progress */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                          <h4 className="text-lg font-display font-bold text-white mb-4">Task Submission Log</h4>
                          {studentSubs.length === 0 ? (
                            <p className="text-sm text-slate-500 italic py-4">This student hasn't submitted any tasks yet.</p>
                          ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                              {studentSubs.map((sub) => {
                                const task = allTasks.find(t => t.id === sub.task_id);
                                return (
                                  <div key={sub.id} className="bg-slate-950/50 border border-slate-800 p-3.5 rounded-lg flex justify-between items-center">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-200">{task?.title || 'Unknown Task'}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-mono text-slate-500">
                                          {task?.task_type === 'group' ? '👥 Group Submission' : '👤 Individual Submission'}
                                        </span>
                                        <span className="text-xs text-slate-500">•</span>
                                        <span className="text-xs text-slate-500">{new Date(sub.created_at).toLocaleDateString()}</span>
                                      </div>
                                      {sub.teacher_feedback && (
                                        <div className="bg-slate-900 border border-slate-800 p-2 rounded mt-2 text-xs text-slate-400">
                                          <strong className="text-slate-300">Feedback:</strong> {sub.teacher_feedback}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1.5">
                                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                                        sub.status === 'reviewed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                        sub.status === 'returned' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                        'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                      }`}>
                                        {sub.status.toUpperCase()}
                                      </span>
                                      {sub.awarded_points !== null && (
                                        <span className="text-xs font-bold text-rose-500 font-mono">+{sub.awarded_points} pts</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Recent Student Logs */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                          <h4 className="text-lg font-display font-bold text-white mb-4">Recent Activity History</h4>
                          {studentLogs.length === 0 ? (
                            <p className="text-sm text-slate-500 italic py-4">No recent activity logs found for this student.</p>
                          ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                              {studentLogs.slice(0, 15).map((log) => (
                                <div key={log.id} className="bg-slate-950/30 border border-slate-900 p-3 rounded-lg flex justify-between items-center">
                                  <div>
                                    <p className="text-sm text-slate-300">{log.reason || log.action_type}</p>
                                    <span className="text-xs text-slate-500 block mt-0.5">{new Date(log.created_at).toLocaleString()}</span>
                                  </div>
                                  <div className="flex gap-1.5">
                                    {log.points_delta !== 0 && (
                                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${log.points_delta > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {log.points_delta > 0 ? `+${log.points_delta}` : log.points_delta} pts
                                      </span>
                                    )}
                                    {log.lives_delta !== 0 && (
                                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${log.lives_delta > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {log.lives_delta > 0 ? `+${log.lives_delta}` : log.lives_delta} ❤️
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Earned Badges */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h4 className="text-lg font-display font-bold text-white mb-4">Earned Achievements & Badges</h4>
                        {studentBadges.filter(sb => sb.student_id === student.id).length === 0 ? (
                          <p className="text-sm text-slate-500 italic py-4">This student hasn't earned any badges yet.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {studentBadges.filter(sb => sb.student_id === student.id).map((sb) => {
                              const badgeDef = badgeDefinitions.find(d => d.id === sb.badge_id) || sb.badge;
                              return (
                                <div key={sb.id} className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
                                  <span className="text-2xl p-2 bg-slate-900 border border-slate-800 rounded-lg">{badgeDef?.icon || '⭐'}</span>
                                  <div>
                                    <p className="text-sm font-bold text-white">{badgeDef?.name || 'Unknown Achievement'}</p>
                                    <p className="text-xs text-slate-400 mt-1">{badgeDef?.description}</p>
                                    <span className="text-[10px] text-slate-500 font-mono block mt-2">
                                      Awarded: {new Date(sb.awarded_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800/60 bg-slate-950/20">
                      <h3 className="text-base font-display font-bold text-white">Student Progress Records</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Click a student to view their detailed academic progress and feedback summary.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800/60 text-[10px] font-mono uppercase tracking-widest text-slate-500 bg-slate-950/20 select-none">
                            {classData.category !== 'private' && (
                              <th className="py-2.5 px-4 font-semibold">Rank</th>
                            )}
                            <th className="py-2.5 px-4 font-semibold">Student Name</th>
                            {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                              <th className="py-2.5 px-4 font-semibold text-center">Lives</th>
                            )}
                            <th className="py-2.5 px-4 font-semibold text-center">Points</th>
                            <th className="py-2.5 px-4 font-semibold text-center">Submissions</th>
                            <th className="py-2.5 px-4 font-semibold text-center">Badges</th>
                            <th className="py-2.5 px-4 font-semibold text-center">Logs</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40 text-slate-300">
                          {studentsSorted.map((student, idx) => {
                            const rank = idx + 1;
                            const studentSubs = getStudentSubmissions(student.id);
                            const badgesCount = studentBadges.filter(sb => sb.student_id === student.id).length;
                            const logsCount = activityLogs.filter(log => log.student_id === student.id).length;

                            return (
                              <tr key={student.id} className="hover:bg-slate-900/40 transition-colors">
                                {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'points' && (
                                  <td className="py-2 px-4 font-mono text-xs text-amber-500 font-bold">#{rank}</td>
                                )}
                                <td className="py-2 px-4">
                                  <span className="font-display font-bold text-sm text-white">
                                    {student.nickname || student.name}
                                  </span>
                                  {student.nickname && (
                                    <span className="text-[10px] text-slate-500 font-sans ml-1">
                                      ({student.name})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-4 text-center font-mono text-xs text-red-400 font-medium">❤️ {student.lives}</td>
                                <td className="py-2 px-4 text-center font-mono text-xs font-semibold text-rose-400">{student.points}</td>
                                <td className="py-2 px-4 text-center font-mono text-xs">{studentSubs.length}</td>
                                <td className="py-2 px-4 text-center font-mono text-xs text-amber-400">{badgesCount} ⭐</td>
                                <td className="py-2 px-4 text-center font-mono text-xs text-purple-400">{logsCount}</td>
                                <td className="py-2 px-4 text-right">
                                  <button
                                    onClick={() => setSelectedReportStudentId(student.id)}
                                    className="text-[10px] bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 font-semibold py-1 px-2.5 rounded-lg transition-all cursor-pointer shadow"
                                  >
                                    View Report
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {reportsSubTab === 'tasks' && (() => {
                return (
                  <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800/60 bg-slate-950/20">
                      <h3 className="text-base font-display font-bold text-white">Classroom Task Performance</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Summary of academic completions, submission counts, and evaluation percentages.</p>
                    </div>
                    {allTasks.length === 0 ? (
                      <div className="p-10 text-center text-slate-500 italic">Create your first task to start assigning work and grading.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800/60 text-[10px] font-mono uppercase tracking-widest text-slate-500 bg-slate-950/20 select-none">
                              <th className="py-2.5 px-4 font-semibold">Task Name</th>
                              <th className="py-2.5 px-4 font-semibold">Type</th>
                              <th className="py-2.5 px-4 font-semibold">Status</th>
                              <th className="py-2.5 px-4 font-semibold text-center">Reward</th>
                              <th className="py-2.5 px-4 font-semibold text-center">Submissions</th>
                              <th className="py-2.5 px-4 font-semibold text-center">Reviewed</th>
                              <th className="py-2.5 px-4 font-semibold text-center">Missing</th>
                              <th className="py-2.5 px-4 font-semibold text-right">Completion %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40 text-slate-300">
                            {allTasks.map((task) => {
                              const taskSubs = reportSubmissions.filter(sub => sub.task_id === task.id);
                              const totalStudentsCount = classData.students?.length || 0;
                              const taskGroupsForTask = reportGroups.filter(g => g.task_id === task.id);

                              let submittedCount = taskSubs.length;
                              let reviewedCount = taskSubs.filter(s => getSubmissionStatus(s) === 'Reviewed').length;
                              let missingCount = 0;
                              let completionRate = 0;

                              if (task.task_type === 'individual') {
                                missingCount = Math.max(0, totalStudentsCount - submittedCount);
                                completionRate = totalStudentsCount ? Math.round((submittedCount / totalStudentsCount) * 100) : 0;
                              } else {
                                missingCount = Math.max(0, taskGroupsForTask.length - submittedCount);
                                completionRate = taskGroupsForTask.length ? Math.round((submittedCount / taskGroupsForTask.length) * 100) : 0;
                              }

                              return (
                                <tr key={task.id} className="hover:bg-slate-900/40 transition-colors">
                                  <td className="py-2.5 px-4">
                                    <p className="font-semibold text-white text-sm">{task.title}</p>
                                    {task.due_at && (
                                      <span className="text-[10px] text-slate-500 font-mono">Due: {new Date(task.due_at).toLocaleDateString()}</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-[10px] text-slate-400 uppercase tracking-wider">{task.task_type}</td>
                                  <td className="py-2.5 px-4 text-[10px] font-medium uppercase tracking-wider">
                                    <span className={`px-2 py-0.5 rounded-full ${
                                      task.status === 'published' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                      task.status === 'closed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                      'bg-slate-800 text-slate-400 border border-slate-700'
                                    }`}>
                                      {task.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-center font-mono text-xs text-rose-400 font-semibold">+{task.reward_points} pts</td>
                                  <td className="py-2.5 px-4 text-center font-mono text-xs font-medium">{submittedCount}</td>
                                  <td className="py-2.5 px-4 text-center font-mono text-xs text-emerald-400">{reviewedCount}</td>
                                  <td className="py-2.5 px-4 text-center font-mono text-xs text-red-400">{missingCount}</td>
                                  <td className="py-2.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                      <span className="font-mono text-xs font-bold text-slate-200">{completionRate}%</span>
                                      <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden hidden sm:block border border-slate-700/30">
                                        <div
                                          className={`h-full ${completionRate >= 80 ? 'bg-emerald-500' : completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                          style={{ width: `${completionRate}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {reportsSubTab === 'meetings' && (() => {
                if (!classData.meetings || classData.meetings.length === 0) {
                  return (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500 italic">
                      Start a class session to automatically generate meeting logs and summaries.
                    </div>
                  );
                }

                return (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-5 border-b border-slate-800">
                      <h3 className="text-lg font-display font-bold text-white">Classroom Meeting Summary</h3>
                      <p className="text-sm text-slate-400 mt-0.5">Historical session logs showing points, lives, and interactions from active meetings.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono uppercase tracking-wider text-slate-400">
                            <th className="p-4">Session Date</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-center">Duration</th>
                            <th className="p-4 text-center">Actions</th>
                            <th className="p-4 text-center">Points Awarded</th>
                            {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                              <>
                                <th className="p-4 text-center">Lives Lost</th>
                                <th className="p-4 text-center">Lives Gained</th>
                              </>
                            )}
                            <th className="p-4">Most Active Crew</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {classData.meetings.map((meeting) => {
                            const startedDate = new Date(meeting.startedAt).toLocaleString();
                            const summary = meeting.summary || {};
                            const logsForMeeting = activityLogs.filter(log => log.meeting_id === meeting.id);

                            const duration = summary.duration || (meeting.endedAt ? `${Math.round((new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime()) / 1000 / 60)} min` : 'N/A');
                            const totalActions = logsForMeeting.length;
                            const totalPoints = logsForMeeting.filter(l => l.points_delta).reduce((sum, l) => sum + (l.points_delta || 0), 0);
                            const totalLivesLost = logsForMeeting.filter(l => l.lives_delta && l.lives_delta < 0).reduce((sum, l) => sum + Math.abs(l.lives_delta || 0), 0);
                            const totalLivesGained = logsForMeeting.filter(l => l.lives_delta && l.lives_delta > 0).reduce((sum, l) => sum + (l.lives_delta || 0), 0);

                            return (
                              <tr key={meeting.id} className="hover:bg-slate-850/30 transition-colors">
                                <td className="p-4 font-medium text-white">{startedDate}</td>
                                <td className="p-4 text-center text-xs font-bold uppercase">
                                  <span className={`px-2 py-0.5 rounded-full ${meeting.status === 'active' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                    {meeting.status}
                                  </span>
                                </td>
                                <td className="p-4 text-center font-mono text-sm">{duration}</td>
                                <td className="p-4 text-center font-mono text-sm text-purple-400">{totalActions}</td>
                                <td className="p-4 text-center font-mono text-sm text-rose-400 font-semibold">+{totalPoints}</td>
                                {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                                  <>
                                    <td className="p-4 text-center font-mono text-sm text-red-400">-{totalLivesLost}</td>
                                    <td className="p-4 text-center font-mono text-sm text-emerald-400">+{totalLivesGained}</td>
                                  </>
                                )}
                                <td className="p-4 font-mono text-sm text-slate-300">{summary.most_active_student || 'N/A'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {reportsSubTab === 'badges' && (() => {
                const totalBadgesEarned = studentBadges.length;
                const badgeCounts: { [key: string]: { badge: any; count: number } } = {};
                studentBadges.forEach(sb => {
                  if (!sb.badge_id) return;
                  if (!badgeCounts[sb.badge_id]) {
                    const badgeDef = badgeDefinitions.find(d => d.id === sb.badge_id) || sb.badge;
                    badgeCounts[sb.badge_id] = { badge: badgeDef, count: 0 };
                  }
                  badgeCounts[sb.badge_id].count++;
                });

                const sortedBadges = Object.values(badgeCounts).sort((a, b) => b.count - a.count);
                const mostAwardedBadge = sortedBadges[0] || null;

                const studentBadgeCounts: { [key: string]: { studentName: string; count: number } } = {};
                studentBadges.forEach(sb => {
                  if (!sb.student_id) return;
                  if (!studentBadgeCounts[sb.student_id]) {
                    const stud = classData.students?.find(s => s.id === sb.student_id);
                    const sName = stud ? (stud.nickname ? `${stud.name} (${stud.nickname})` : stud.name) : 'Unknown';
                    studentBadgeCounts[sb.student_id] = { studentName: sName, count: 0 };
                  }
                  studentBadgeCounts[sb.student_id].count++;
                });

                const studentWithMostBadges = Object.values(studentBadgeCounts).sort((a, b) => b.count - a.count)[0] || null;
                const manualCount = studentBadges.filter(sb => sb.source === 'manual').length;
                const autoCount = studentBadges.filter(sb => sb.source === 'automatic' || sb.source === 'system').length;

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Badges Earned</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-3xl font-bold text-amber-500">{totalBadgesEarned}</span>
                          <span className="text-xs text-slate-500">instances unlocked</span>
                        </div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Most Awarded Badge</span>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-2xl">{mostAwardedBadge?.badge?.icon || '⭐'}</span>
                          <span className="text-sm font-bold text-white truncate">{mostAwardedBadge?.badge?.name || 'N/A'}</span>
                          <span className="text-xs text-slate-500 font-mono">({mostAwardedBadge?.count || 0} times)</span>
                        </div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Top Achievement Hunter</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-base font-bold text-white truncate">{studentWithMostBadges?.studentName || 'N/A'}</span>
                          <span className="text-xs text-slate-500 font-mono">({studentWithMostBadges?.count || 0} badges)</span>
                        </div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Award Source Ratio</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-sm font-bold text-slate-300">Auto: {autoCount} / Manual: {manualCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="p-5 border-b border-slate-800">
                        <h3 className="text-lg font-display font-bold text-white">Academic Achievement Breakdown</h3>
                        <p className="text-sm text-slate-400 mt-0.5">Award frequency distribution for all customized and automatic badges.</p>
                      </div>
                      {badgeDefinitions.length === 0 ? (
                        <div className="p-10 text-center text-slate-500 italic">No custom badge definitions created.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono uppercase tracking-wider text-slate-400">
                                <th className="p-4">Badge</th>
                                <th className="p-4">Description</th>
                                <th className="p-4">Trigger / Category</th>
                                <th className="p-4 text-center">Awarded Frequency</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-slate-300">
                              {badgeDefinitions.map((badge) => {
                                const count = badgeCounts[badge.id]?.count || 0;
                                return (
                                  <tr key={badge.id} className="hover:bg-slate-850/30 transition-colors">
                                    <td className="p-4 flex items-center gap-3">
                                      <span className="text-2xl p-1.5 bg-slate-950 border border-slate-800 rounded-lg">{badge.icon || '⭐'}</span>
                                      <span className="font-semibold text-white">{badge.name}</span>
                                    </td>
                                    <td className="p-4 text-sm text-slate-400">{badge.description}</td>
                                    <td className="p-4 font-mono text-xs text-slate-400 uppercase">
                                      {badge.trigger_type || badge.badge_type || 'Teacher Manual Choice'}
                                    </td>
                                    <td className="p-4 text-center font-mono text-base font-bold text-amber-500">{count}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {reportsSubTab === 'activity' && (() => {
                const getFilteredLogs = () => {
                  if (reportsActivityFilter === 'all') return activityLogs;
                  if (reportsActivityFilter === 'points') return activityLogs.filter(log => log.points_delta !== 0);
                  if (reportsActivityFilter === 'lives') return activityLogs.filter(log => log.lives_delta !== 0);
                  if (reportsActivityFilter === 'tasks') {
                    return activityLogs.filter(log =>
                      log.action_type.startsWith('task_') ||
                      log.action_type.startsWith('submission_') ||
                      log.action_type.startsWith('review_')
                    );
                  }
                  if (reportsActivityFilter === 'badges') return activityLogs.filter(log => log.action_type.startsWith('badge_'));
                  if (reportsActivityFilter === 'meetings') return activityLogs.filter(log => log.action_type.startsWith('meeting_'));
                  return activityLogs;
                };

                const filtered = getFilteredLogs();

                return (
                  <div className="space-y-6">
                    {/* Filter buttons */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'all', label: 'All Logbook Entries' },
                        { id: 'points', label: 'Points Only' },
                        { id: 'lives', label: 'Lives Only' },
                        { id: 'tasks', label: 'Tasks & Evaluations' },
                        { id: 'badges', label: 'Badges Earned' },
                        { id: 'meetings', label: 'Meetings Sessions' },
                      ].map((filter) => (
                        <button
                          key={filter.id}
                          onClick={() => setReportsActivityFilter(filter.id as any)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                            reportsActivityFilter === filter.id
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="p-5 border-b border-slate-800">
                        <h3 className="text-lg font-display font-bold text-white">Chronological Activity Stream</h3>
                        <p className="text-sm text-slate-400 mt-0.5">Filter and review classroom developments, point audits, and system notifications.</p>
                      </div>
                      {filtered.length === 0 ? (
                        <div className="p-10 text-center text-slate-500 italic">No activity logs matching the selected filter.</div>
                      ) : (
                        <div className="divide-y divide-slate-800/50 max-h-[500px] overflow-y-auto custom-scrollbar">
                          {filtered.map((log) => (
                            <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-850/10 transition-colors">
                              <div className="flex items-start gap-3">
                                <span className={`text-xs font-bold font-mono px-2 py-1 rounded mt-0.5 ${
                                  log.action_type.includes('task') || log.action_type.includes('submission') ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                  log.action_type.includes('badge') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                  log.action_type.includes('meeting') ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                  'bg-slate-850 text-slate-400 border border-slate-800'
                                }`}>
                                  {log.action_type.toUpperCase()}
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-slate-200">
                                    {log.studentName ? `${log.studentName}: ` : ''}{log.reason || 'Classroom modification logged.'}
                                  </p>
                                  <span className="text-xs text-slate-500 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                                </div>
                              </div>
                              <div className="flex gap-2 text-right">
                                {log.points_delta !== 0 && (
                                  <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded ${log.points_delta > 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {log.points_delta > 0 ? `+${log.points_delta}` : log.points_delta} pts
                                  </span>
                                )}
                                {log.lives_delta !== 0 && (
                                  <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded ${log.lives_delta > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {log.lives_delta > 0 ? `+${log.lives_delta}` : log.lives_delta} ❤️
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <>
        <div className="max-w-lg bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5 shadow-xl animate-fade-in">
          <div className="border-b border-slate-800/60 pb-3 mb-4">
            <h2 className="text-base font-display font-bold text-white">Class Settings</h2>
            <p className="text-xs text-slate-400 mt-0.5">Update classroom rules, parameters, and basic info.</p>
          </div>
          <form onSubmit={handleSaveClass} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400 mb-1">Class Name</label>
                <input
                  type="text"
                  required
                  value={editClassName}
                  onChange={(e) => setEditClassName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500/50 transition-all text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400 mb-1">Level / Grade</label>
                <input
                  type="text"
                  value={editClassLevel}
                  onChange={(e) => setEditClassLevel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500/50 transition-all text-xs"
                />
              </div>
              {editClassScoringSystem === 'lives' && (
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400 mb-1">Max Lives (1-20)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={editClassMaxLives}
                    onChange={(e) => setEditClassMaxLives(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500/50 transition-all text-xs font-mono"
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400 mb-1">Category</label>
                <select
                  value={editClassCategory}
                  onChange={(e) => {
                    const newCategory = e.target.value as 'regular' | 'private';
                    setEditClassCategory(newCategory);
                    setEditClassScoringSystem(newCategory === 'private' ? 'lives' : 'points');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500/50 transition-all text-xs"
                >
                  <option value="regular">Regular</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400 mb-1">Scoring System</label>
                <select
                  value={editClassScoringSystem}
                  onChange={(e) => setEditClassScoringSystem(e.target.value as 'points' | 'lives')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500/50 transition-all text-xs"
                >
                  <option value="points">Points Only</option>
                  <option value="lives">Lives Challenge</option>
                </select>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-500 font-sans">If max lives are reduced, any students exceeding the new maximum will be automatically capped.</p>

            <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setConfirmModalConfig({
                    isOpen: true,
                    title: 'Archive this class?',
                    message: 'This will hide the class from your active dashboard. Student records, tasks, submissions, badges, reports, and uploaded files will be preserved.',
                    helperNote: 'Students will not be able to log in while this class is archived. Recommendation: export your class CSV records before archiving.',
                    confirmLabel: 'Archive Class',
                    variant: 'warning',
                    onConfirm: () => onArchiveClass()
                  });
                }}
                className="text-amber-500 hover:text-amber-400 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/10 transition-all cursor-pointer"
              >
                <Archive size={14} /> Archive Class
              </button>
              <button
                type="submit"
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-rose-600/15 cursor-pointer text-xs uppercase tracking-wider"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>

        <div className="max-w-lg mt-6 bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5 shadow-xl animate-fade-in">
          <div className="border-b border-slate-800/60 pb-3 mb-4">
            <h2 className="text-base font-display font-bold text-white flex items-center gap-2">
              <Archive size={16} className="text-purple-400" />
              End of Semester Guide
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">When a class cycle is finished, follow this safe order:</p>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-xs font-bold shrink-0 mt-0.5">1</span>
              <p>Review reports and finish teacher feedback.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-xs font-bold shrink-0 mt-0.5">2</span>
              <p>Export CSV records for your class.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-xs font-bold shrink-0 mt-0.5">3</span>
              <p>Archive the class when students no longer need access.</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 text-xs text-slate-400 italic">
            Archiving preserves class data and uploaded files. Students cannot log in to archived classes, but you can restore the class later.
          </div>
        </div>
        
        <div className="max-w-lg mt-6 bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5 shadow-xl animate-fade-in">
          <div className="border-b border-slate-800/60 pb-3 mb-4">
            <h2 className="text-base font-display font-bold text-white flex items-center gap-2">
              <Folder size={16} className="text-blue-400" />
              Data Export & Backup
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Download class records as CSV files before clearing history or closing a semester.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleExportRoster}
              type="button"
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700/50 cursor-pointer"
            >
              <Users size={14} className="text-emerald-400" />
              Download Roster CSV
            </button>
            <button
              onClick={handleExportActivityLogs}
              type="button"
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700/50 cursor-pointer"
            >
              <Clock size={14} className="text-indigo-400" />
              Download Activity Logs CSV
            </button>
            <button
              onClick={handleExportTasksSubmissions}
              type="button"
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700/50 cursor-pointer"
            >
              <CheckSquare size={14} className="text-purple-400" />
              Download Tasks & Submissions CSV
            </button>
            <button
              onClick={handleExportBadges}
              type="button"
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700/50 cursor-pointer"
            >
              <Award size={14} className="text-amber-400" />
              Download Badges CSV
            </button>
          </div>
        </div>

        <div className="max-w-lg mt-6 bg-slate-900/30 backdrop-blur-sm border border-red-900/30 rounded-2xl p-5 shadow-xl animate-fade-in">
          <div className="border-b border-red-900/30 pb-3 mb-4">
            <h2 className="text-base font-display font-bold text-red-400">Activity History</h2>
            <p className="text-xs text-slate-400 mt-0.5">Clear recorded activity logs for this class. This does not reset student points, lives, badges, tasks, or submissions.</p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setConfirmModalConfig({
                  isOpen: true,
                  title: 'Clear Activity History?',
                  message: 'This will permanently delete activity log entries for this class. Student points, lives, badges, tasks, and submissions will not be reset. Reports that depend on activity history may no longer show previous activity.',
                  helperNote: 'Recommendation: export your Activity Logs CSV before clearing history. This only clears activity log records for this class; points, lives, tasks, submissions, badges, reports, and files are preserved.',
                  requireTypedConfirmation: 'CLEAR',
                  confirmLabel: 'Clear History',
                  variant: 'danger',
                  onConfirm: async () => {
                    try {
                      await db.clearClassActivityLogs(classData.id);
                      if (activityLogs) {
                        setActivityLogs([]);
                      }
                    } catch (err: any) {
                      alert('Failed to clear activity history: ' + err.message);
                    }
                  }
                });
              }}
              className="bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800/50 px-4 py-2 rounded-xl font-bold transition-all shadow-lg cursor-pointer text-xs uppercase tracking-wider"
            >
              Clear Activity History
            </button>
          </div>
        </div>
        </>
      )}

      {activeTab === 'badges' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/30 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <div>
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <Award className="text-amber-500" size={24} />
                Badges & Achievements
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Configure automatic unlocks or award manual credentials to recognize student learning milestones.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              {badgeDefinitions.length === 0 && (
                <button
                  type="button"
                  onClick={handleAddStarterBadges}
                  className="bg-slate-900/50 hover:bg-slate-800/60 text-amber-400 hover:text-amber-300 border border-amber-500/20 px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer shadow"
                >
                  ✨ Load Starter Suite
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenBadgeModal(null)}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-rose-600/15 cursor-pointer"
              >
                <Plus size={16} /> Create Custom Badge
              </button>
              <button
                type="button"
                onClick={() => handleOpenAwardModal('')}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-amber-600/15 cursor-pointer"
              >
                <Award size={16} /> Award Student Manually
              </button>
            </div>
          </div>

          {isBadgesTableMissing ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl shrink-0">
                  <AlertTriangle className="text-amber-500 animate-pulse" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-white">Database Migration Required</h3>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                    To enable badges, automatic achievements, and credential tracking, you need to execute a database migration inside your Supabase SQL editor.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-xl border border-slate-850 p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-mono font-bold text-slate-400 tracking-wider uppercase block">Migration Script</span>
                  <button
                    type="button"
                    onClick={() => {
                      const sqlBlock = `-- Phase 8: Badges and Achievements
create table if not exists public.badge_definitions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  name text not null,
  description text,
  icon text,
  badge_type text not null default 'manual',
  trigger_key text,
  points_threshold integer,
  task_count_threshold integer,
  group_task_count_threshold integer,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.student_badges (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badge_definitions(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  awarded_by uuid references auth.users(id) on delete set null,
  awarded_reason text,
  source text not null default 'manual',
  metadata jsonb default '{}'::jsonb,
  awarded_at timestamptz default now(),
  unique (badge_id, student_id)
);

alter table public.badge_definitions enable row level security;
alter table public.student_badges enable row level security;

create policy "Teachers can manage badge_definitions for their classes"
  on public.badge_definitions for all to authenticated
  using (exists (select 1 from public.classes where classes.id = badge_definitions.class_id and classes.teacher_id = auth.uid()))
  with check (exists (select 1 from public.classes where classes.id = badge_definitions.class_id and classes.teacher_id = auth.uid()));

create policy "Anyone can select badge_definitions (read-only for students/public)"
  on public.badge_definitions for select using (is_active = true);

create policy "Teachers can manage student_badges for their classes"
  on public.student_badges for all to authenticated
  using (exists (select 1 from public.classes where classes.id = student_badges.class_id and classes.teacher_id = auth.uid()))
  with check (exists (select 1 from public.classes where classes.id = student_badges.class_id and classes.teacher_id = auth.uid()));

create policy "Anyone can select student_badges (read-only for students/public)"
  on public.student_badges for select using (true);

create or replace function public.award_badge_to_student(
  badge_id_input uuid,
  student_id_input uuid,
  reason_input text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_class_id uuid;
  v_teacher_id uuid;
  v_badge_name text;
  v_student_name text;
  v_award_id uuid;
begin
  select class_id, teacher_id, name into v_class_id, v_teacher_id, v_badge_name
  from public.badge_definitions
  where id = badge_id_input;

  if v_class_id is null then
    raise exception 'Badge definition not found';
  end if;

  if auth.uid() != v_teacher_id then
    raise exception 'Unauthorized to award this badge';
  end if;

  select name into v_student_name
  from public.students
  where id = student_id_input and class_id = v_class_id;

  if v_student_name is null then
    raise exception 'Student does not belong to this class';
  end if;

  insert into public.student_badges (
    badge_id, class_id, student_id, awarded_by, awarded_reason, source
  ) values (
    badge_id_input, v_class_id, student_id_input, auth.uid(), reason_input, 'manual'
  )
  on conflict (badge_id, student_id) do nothing
  returning id into v_award_id;

  if v_award_id is not null then
    insert into public.activity_logs (
      class_id, action_type, student_id, points_delta, lives_delta, reason, metadata
    ) values (
      v_class_id, 'badge_awarded', student_id_input, 0, 0,
      'Awarded badge: ' || v_badge_name || coalesce(' - ' || reason_input, ''),
      jsonb_build_object('badge_id', badge_id_input, 'badge_name', v_badge_name, 'reason', reason_input, 'student_name', v_student_name)
    );
  end if;

  return v_award_id;
end;
$$;

grant execute on function public.award_badge_to_student(uuid, uuid, text) to authenticated;

alter publication supabase_realtime add table public.student_badges;`;
                      navigator.clipboard.writeText(sqlBlock);
                      setCopiedBadgesSql(true);
                      setTimeout(() => setCopiedBadgesSql(false), 2000);
                    }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer"
                  >
                    {copiedBadgesSql ? 'Copied!' : 'Copy SQL Script'}
                  </button>
                </div>

                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 font-mono overflow-x-auto max-h-72 leading-relaxed scrollbar-thin">
                  {`CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  badge_type text NOT NULL DEFAULT 'manual',
  trigger_key text,
  points_threshold integer,
  task_count_threshold integer,
  group_task_count_threshold integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id uuid NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  awarded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  awarded_reason text,
  source text NOT NULL DEFAULT 'manual',
  metadata jsonb DEFAULT '{}'::jsonb,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE (badge_id, student_id)
);

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage badge_definitions for their classes"
  ON public.badge_definitions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = badge_definitions.class_id AND classes.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = badge_definitions.class_id AND classes.teacher_id = auth.uid()));

CREATE POLICY "Anyone can select badge_definitions (read-only for students/public)"
  ON public.badge_definitions FOR SELECT USING (is_active = true);

CREATE POLICY "Teachers can manage student_badges for their classes"
  ON public.student_badges FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = student_badges.class_id AND classes.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = student_badges.class_id AND classes.teacher_id = auth.uid()));

CREATE POLICY "Anyone can select student_badges (read-only for students/public)"
  ON public.student_badges FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.award_badge_to_student(
  badge_id_input uuid,
  student_id_input uuid,
  reason_input text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_class_id uuid;
  v_teacher_id uuid;
  v_badge_name text;
  v_student_name text;
  v_award_id uuid;
BEGIN
  SELECT class_id, teacher_id, name INTO v_class_id, v_teacher_id, v_badge_name
  FROM public.badge_definitions
  WHERE id = badge_id_input;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Badge definition not found';
  END IF;

  IF auth.uid() != v_teacher_id THEN
    RAISE EXCEPTION 'Unauthorized to award this badge';
  END IF;

  SELECT name INTO v_student_name
  FROM public.students
  WHERE id = student_id_input AND class_id = v_class_id;

  IF v_student_name IS NULL THEN
    RAISE EXCEPTION 'Student does not belong to this class';
  END IF;

  INSERT INTO public.student_badges (
    badge_id, class_id, student_id, awarded_by, awarded_reason, source
  ) VALUES (
    badge_id_input, v_class_id, student_id_input, auth.uid(), reason_input, 'manual'
  )
  ON CONFLICT (badge_id, student_id) DO NOTHING
  RETURNING id INTO v_award_id;

  IF v_award_id IS NOT NULL THEN
    INSERT INTO public.activity_logs (
      class_id, action_type, student_id, points_delta, lives_delta, reason, metadata
    ) VALUES (
      v_class_id, 'badge_awarded', student_id_input, 0, 0,
      'Awarded badge: ' || v_badge_name || COALESCE(' - ' || reason_input, ''),
      jsonb_build_object('badge_id', badge_id_input, 'badge_name', v_badge_name, 'reason', reason_input, 'student_name', v_student_name)
    );
  END IF;

  RETURN v_award_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_badge_to_student(uuid, uuid, text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.student_badges;`}
                </pre>
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column: Badge Definitions (2 cols on large screen) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-display font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                    🏅 Badge Definitions ({badgeDefinitions.length})
                  </h3>

                  {isBadgesLoading && badgeDefinitions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500 space-y-2">
                      <Loader2 className="animate-spin text-slate-600" size={24} />
                      <span className="text-sm">Scanning database definitions...</span>
                    </div>
                  ) : badgeDefinitions.length === 0 ? (
                    <div className="py-12 px-4 text-center bg-slate-950/40 rounded-xl border border-slate-850 space-y-3">
                      <div className="text-slate-400 font-mono text-sm">No Badges Configured</div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed italic">
                        There are currently no custom or automatic credentials set up for this classroom. Tap "Load Starter Suite" above to launch instantly with default options.
                      </p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {badgeDefinitions.map((badge) => {
                        let ruleLabel = 'Manual Award Only';
                        if (badge.badge_type === 'automatic') {
                          if (badge.trigger_key === 'first_submission') {
                            ruleLabel = 'Automatic: First Mission Submit';
                          } else if (badge.trigger_key === 'first_reviewed_task') {
                            ruleLabel = 'Automatic: First Reviewed Task';
                          } else if (badge.trigger_key === 'points_threshold') {
                            ruleLabel = `Automatic: Reach ${badge.points_threshold} Points`;
                          } else if (badge.trigger_key === 'individual_tasks_completed') {
                            ruleLabel = `Automatic: Complete ${badge.task_count_threshold} Individual Tasks`;
                          } else if (badge.trigger_key === 'group_tasks_completed') {
                            ruleLabel = `Automatic: Complete ${badge.group_task_count_threshold} Group Tasks`;
                          } else if (badge.trigger_key === 'comeback_from_zero_lives') {
                            ruleLabel = 'Automatic: Recover from Zero Lives';
                          } else if (badge.trigger_key === 'no_lives_lost_meeting') {
                            ruleLabel = 'Automatic: Complete Meeting with Perfect Lives';
                          } else {
                            ruleLabel = `Automatic Trigger: ${badge.trigger_key}`;
                          }
                        }

                        return (
                          <div
                            key={badge.id}
                            className="bg-slate-950 border border-slate-850/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-800 transition-colors"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-3xl p-1 bg-slate-900 rounded-lg shrink-0" role="img" aria-label={badge.name}>
                                  {badge.icon || '🏅'}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenBadgeModal(badge)}
                                    className="text-slate-500 hover:text-white p-1 hover:bg-slate-900 rounded transition-colors cursor-pointer"
                                    title="Edit Definition"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBadgeDefinition(badge.id, badge.name)}
                                    className="text-slate-500 hover:text-red-400 p-1 hover:bg-slate-900 rounded transition-colors cursor-pointer"
                                    title="Delete Definition"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-sm leading-tight">{badge.name}</h4>
                                {badge.description && (
                                  <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{badge.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="border-t border-slate-900 mt-4 pt-3 flex flex-col gap-1">
                              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Criteria</div>
                              <div className="text-xs text-amber-500 font-medium font-sans truncate" title={ruleLabel}>
                                {ruleLabel}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Recent Award History */}
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-display font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                    📜 Recent Award History ({studentBadges.length})
                  </h3>

                  {isBadgesLoading && studentBadges.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-slate-500 space-y-2">
                      <Loader2 className="animate-spin text-slate-600" size={24} />
                      <span className="text-sm">Reading history records...</span>
                    </div>
                  ) : studentBadges.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-slate-850">
                      No badges have been awarded yet.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {studentBadges.map((sb) => {
                        const student = classData.students?.find((s: any) => s.id === sb.student_id);
                        const studentName = student ? (student.nickname ? `${student.name} (${student.nickname})` : student.name) : 'Unknown Student';
                        const badge = sb.badge;

                        return (
                          <div key={sb.id} className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-2 animate-fade-in">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl shrink-0">{badge?.icon || '🏅'}</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white truncate">{studentName}</div>
                                <div className="text-[11px] text-purple-400 font-medium truncate mt-0.5">
                                  Earned <span className="font-semibold text-white">{badge?.name || 'Deleted Badge'}</span>
                                </div>
                              </div>
                            </div>

                            {sb.awarded_reason && (
                              <div className="bg-slate-900/60 p-2 rounded text-[10px] text-slate-400 italic leading-relaxed border border-slate-850/40">
                                "{sb.awarded_reason}"
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono border-t border-slate-900/40 pt-2 font-sans">
                              <span className="capitalize text-slate-400">
                                {sb.source === 'automatic' ? '🤖 System Triggered' : '👨‍🏫 Teacher Awarded'}
                              </span>
                              <span>{new Date(sb.awarded_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Start Meeting Modal */}
      {isMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-2xl font-display font-bold text-white mb-2">Start a new meeting?</h3>
            <p className="text-slate-300 mb-6 leading-relaxed">
              All student lives will reset to the class maximum.<br />
              Student points will stay the same.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsMeetingModalOpen(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onStartMeeting();
                  setIsMeetingModalOpen(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Play size={18} className="fill-current" /> Start Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-display font-bold text-white">Edit Student</h3>
              <button onClick={() => setEditingStudentId(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              onEditStudent(editingStudentId, editStudentName, editStudentNickname);
              setEditingStudentId(null);
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nickname (Optional)</label>
                <input
                  type="text"
                  value={editStudentNickname}
                  onChange={(e) => setEditStudentNickname(e.target.value)}
                  placeholder="Shown in roster"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 mt-2 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Save Changes
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const student = classData.students.find(s => s.id === editingStudentId);
                      if (student) {
                        navigator.clipboard.writeText(`Class Code: ${classData.joinCode}\nStudent: ${student.name}\nPIN: ${student.pin}`);
                        alert('Login info copied!');
                      }
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Copy size={14} /> Copy Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Regenerate PIN for this student?')) {
                        onRegenerateStudentPin(editingStudentId);
                      }
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw size={14} /> Reset PIN
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this student?\nLives and points will be lost.')) {
                      onDeleteStudent(editingStudentId);
                      setEditingStudentId(null);
                    }
                  }}
                  className="w-full border border-red-500/30 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Remove Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Meeting Confirmation Modal */}
      {isEndMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-500/20 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <AlertTriangle size={28} />
              <h3 className="text-2xl font-display font-bold text-white">End class meeting?</h3>
            </div>
            <p className="text-slate-300 mb-6 leading-relaxed text-sm">
              This will close the active meeting and generate a comprehensive session summary report.
            </p>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2 mb-6">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                <span>Student current points will remain unchanged.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                <span>Student current lives will not reset.</span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsEndMeetingModalOpen(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEndMeeting}
                className="bg-red-650 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                End Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Summary Detail Modal */}
      {selectedMeetingForSummary && selectedMeetingForSummary.summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
              <div>
                <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                  <Trophy className="text-yellow-500" size={20} />
                  Session Summary Report
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Session ID: {selectedMeetingForSummary.id.substring(0, 8)}...
                </p>
              </div>
              <button
                onClick={() => setSelectedMeetingForSummary(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 text-sm">
              {/* Timing info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block uppercase">Started At</span>
                  <span className="text-slate-200 font-medium">
                    {new Date(selectedMeetingForSummary.summary.started_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block uppercase">Ended At</span>
                  <span className="text-slate-200 font-medium">
                    {new Date(selectedMeetingForSummary.summary.ended_at).toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2 border-t border-slate-800/60 pt-2 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Total Duration:</span>
                  <span className="font-bold text-emerald-400">{selectedMeetingForSummary.summary.duration}</span>
                </div>
              </div>

              {/* Stats overview */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Key Stats Overview</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
                    <span className="text-2xl font-black text-slate-100 block">
                      {selectedMeetingForSummary.summary.total_actions}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase">Total Actions Logged</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
                    <span className="text-2xl font-black text-yellow-500 block">
                      {selectedMeetingForSummary.summary.total_point_changes >= 0 ? '+' : ''}
                      {selectedMeetingForSummary.summary.total_point_changes}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Points Awarded</span>
                  </div>
                  {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && (
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center col-span-2">
                      <div className="flex justify-around items-center h-full">
                        <div>
                          <span className="text-lg font-bold text-red-500 block">
                            -{selectedMeetingForSummary.summary.total_lives_lost}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono uppercase">Lives Lost</span>
                        </div>
                        <div className="h-6 w-px bg-slate-800" />
                        <div>
                          <span className="text-lg font-bold text-emerald-400 block">
                            +{selectedMeetingForSummary.summary.total_lives_gained}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono uppercase">Lives Recovered</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance / Leaders */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performance Metrics</h4>
                
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-850/80">
                    <span className="text-xs text-slate-400 font-medium">Most Active Student</span>
                    <span className="font-bold text-indigo-400 text-sm">
                      {selectedMeetingForSummary.summary.most_active_student}
                    </span>
                  </div>

                  {selectedMeetingForSummary.summary.top_gainers && selectedMeetingForSummary.summary.top_gainers.length > 0 && (
                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850/80 space-y-2">
                      <span className="text-xs text-slate-400 font-medium block">Top Point Gainers</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedMeetingForSummary.summary.top_gainers.map((gainer: string, idx: number) => (
                          <span key={idx} className="bg-yellow-500/10 text-yellow-500 text-xs px-2.5 py-1 rounded-lg border border-yellow-500/20 font-medium">
                            {gainer}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives' && selectedMeetingForSummary.summary.lost_lives_students && selectedMeetingForSummary.summary.lost_lives_students.length > 0 && (
                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850/80 space-y-2">
                      <span className="text-xs text-slate-400 font-medium block">Classroom Incidents (Lives Lost)</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedMeetingForSummary.summary.lost_lives_students.map((incident: string, idx: number) => (
                          <span key={idx} className="bg-red-500/10 text-red-400 text-xs px-2.5 py-1 rounded-lg border border-red-500/20 font-medium">
                            {incident}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-850 pt-4 flex justify-end">
              <button
                onClick={() => setSelectedMeetingForSummary(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all text-sm cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Submissions Viewer Modal */}
      {selectedTaskForSubmissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans submissions-modal-backdrop">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-[calc(100vw-32px)] max-w-[1000px] max-h-[calc(100vh-32px)] h-[85vh] overflow-hidden shadow-2xl flex flex-col submissions-modal">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0 submissions-modal-header">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20 uppercase tracking-wider">
                    {selectedTaskForSubmissions.task_type === 'group' ? 'Group Task' : 'Individual Task'}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-500 font-mono">ID: {selectedTaskForSubmissions.id}</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                  <FileText className="text-purple-400 shrink-0" size={18} />
                  Submissions: {selectedTaskForSubmissions.title}
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsFetchingSubmissions(true);
                    setSubmissionsError(null);
                    try {
                      let subs;
                      if (selectedTaskForSubmissions.task_type === 'group') {
                        const rawSubs = await taskDb.fetchGroupTaskSubmissions(selectedTaskForSubmissions.id, classData.id);
                        subs = rawSubs.map((s: any) => ({
                          ...s,
                          id: s.submission_id || s.group_id,
                          studentName: s.group_name,
                          isGroup: true,
                          status: s.submission_status || 'not submitted',
                          created_at: s.created_at || null,
                          members: (s.group_members || []).map((m: any) => m.nickname ? `${m.name} (${m.nickname})` : m.name),
                          group_members_raw: s.group_members || []
                        }));
                      } else {
                        subs = await taskDb.fetchTaskSubmissions(selectedTaskForSubmissions.id, classData.id);
                      }
                      setTaskSubmissions(subs);
                      if (selectedSubmissionForReview) {
                        const updated = subs.find(s => s.id === selectedSubmissionForReview.id);
                        setSelectedSubmissionForReview(updated || null);
                      }
                    } catch (err: any) {
                      console.error('[DEBUG] Refresh click fetch error:', err, {
                        selectedTaskId: selectedTaskForSubmissions.id,
                        selectedTaskType: selectedTaskForSubmissions.task_type,
                        currentClassId: classData.id
                      });
                      if (selectedTaskForSubmissions.task_type === 'group') {
                        setSubmissionsError('Failed to load group submissions: ' + err.message);
                      } else {
                        setSubmissionsError('Failed to refresh: ' + err.message);
                      }
                    } finally {
                      setIsFetchingSubmissions(false);
                    }
                  }}
                  disabled={isFetchingSubmissions}
                  className="text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer border border-slate-850"
                  title="Refresh Submissions"
                >
                  <RefreshCw size={13} className={isFetchingSubmissions ? "animate-spin text-purple-400" : ""} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskForSubmissions(null);
                    setSelectedSubmissionForReview(null);
                  }}
                  className="text-slate-500 hover:text-white hover:bg-slate-800/80 p-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 submissions-modal-body bg-slate-950/20">
              {isFetchingSubmissions ? (
                <div className="py-20 text-center text-slate-500 text-sm">
                  <Loader2 className="animate-spin mx-auto mb-2 text-purple-500" size={24} />
                  {selectedTaskForSubmissions.task_type === 'group' ? 'Loading group submissions...' : 'Loading task submissions...'}
                </div>
              ) : submissionsError ? (
                <div className="py-16 text-center space-y-4 max-w-md mx-auto">
                  <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {selectedTaskForSubmissions.task_type === 'group' ? 'Failed to load group submissions.' : 'Failed to load submissions.'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {submissionsError}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 max-w-4xl mx-auto">
                  {/* Statistics & Completion Summary */}
                  {(() => {
                    const isGroupTask = selectedTaskForSubmissions.task_type === 'group';
                    const totalStudentsCount = classData.students.length;

                    let submittedCount = 0;
                    let reviewedCount = 0;
                    let returnedCount = 0;
                    let pendingCount = 0;
                    let missingStudents: any[] = [];

                    if (isGroupTask) {
                      const submittedGroups = taskSubmissions.filter(s => s.status && s.status !== 'not submitted' && s.status !== 'Not Submitted');
                      submittedCount = submittedGroups.length;
                      reviewedCount = taskSubmissions.filter(s => s.status === 'reviewed').length;
                      returnedCount = taskSubmissions.filter(s => s.status === 'returned').length;
                      pendingCount = taskSubmissions.filter(s => s.status === 'submitted' || s.status === 'late').length;

                      const submittedStudentIds = new Set<string>();
                      submittedGroups.forEach(g => {
                        const rawMembers = g.group_members_raw || g.group_members || [];
                        rawMembers.forEach((m: any) => {
                          if (m && m.student_id) submittedStudentIds.add(m.student_id);
                        });
                      });
                      missingStudents = classData.students.filter(st => !submittedStudentIds.has(st.id));
                    } else {
                      const submittedSubs = taskSubmissions.filter(s => s.status === 'submitted' || s.status === 'reviewed' || s.status === 'returned' || s.status === 'late');
                      submittedCount = submittedSubs.length;
                      reviewedCount = taskSubmissions.filter(s => s.status === 'reviewed').length;
                      returnedCount = taskSubmissions.filter(s => s.status === 'returned').length;
                      pendingCount = taskSubmissions.filter(s => s.status === 'submitted' || s.status === 'late').length;

                      missingStudents = classData.students.filter(student => !taskSubmissions.some(sub => sub.student_id === student.id));
                    }

                    const denominator = isGroupTask ? taskSubmissions.length || 1 : totalStudentsCount;
                    const completionPercentage = denominator > 0 ? Math.round((submittedCount / denominator) * 100) : 0;

                    return (
                      <div className="space-y-5 font-sans">
                        {/* Bento Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Completion Card */}
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Completion Rate</span>
                              <div className="flex items-baseline gap-2 mt-1.5">
                                <span className="text-2xl font-bold text-white font-mono">{completionPercentage}%</span>
                                <span className="text-[11px] text-slate-400">
                                  {isGroupTask ? `${submittedCount} / ${denominator} Groups` : `${submittedCount} / ${totalStudentsCount} Students`}
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-3.5 overflow-hidden border border-slate-850">
                              <div 
                                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${completionPercentage}%` }}
                              />
                            </div>
                          </div>

                          {/* Status Breakdown Card */}
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Submission Status</span>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                                <span className="text-[10px] text-slate-400 block">Pending</span>
                                <span className="text-sm font-bold text-blue-400 font-mono">{pendingCount}</span>
                              </div>
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                                <span className="text-[10px] text-slate-400 block">Reviewed</span>
                                <span className="text-sm font-bold text-emerald-400 font-mono">{reviewedCount}</span>
                              </div>
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                                <span className="text-[10px] text-slate-400 block">Returned</span>
                                <span className="text-sm font-bold text-amber-400 font-mono">{returnedCount}</span>
                              </div>
                            </div>
                          </div>

                          {/* Missing Submissions Tracker Mini List */}
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Missing Tracker</span>
                              <span className="text-xs text-slate-400 mt-1 block">
                                {missingStudents.length === 0 ? 'All submissions accounted for!' : `${missingStudents.length} students pending`}
                              </span>
                            </div>
                            <div className="mt-2.5 flex -space-x-1.5 overflow-hidden">
                              {missingStudents.slice(0, 6).map((st) => (
                                <div 
                                  key={st.id} 
                                  className="inline-block h-6 w-6 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[9px] font-bold text-slate-300 shadow"
                                  title={st.nickname ? `${st.name} (${st.nickname})` : st.name}
                                >
                                  {st.name.charAt(0)}
                                </div>
                              ))}
                              {missingStudents.length > 6 && (
                                <div className="inline-block h-6 w-6 rounded-full bg-slate-950 border-2 border-slate-900 flex items-center justify-center text-[8px] font-extrabold text-purple-400">
                                  +{missingStudents.length - 6}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Full Missing Submissions Panel */}
                        {missingStudents.length > 0 && (
                          <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-2.5">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="text-rose-400/90 shrink-0" size={14} />
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missing Submissions ({missingStudents.length})</h4>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {missingStudents.map((st) => (
                                <span 
                                  key={st.id} 
                                  className="text-[11px] text-slate-300 bg-slate-950/80 border border-slate-850/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium"
                                >
                                  <span className="w-1 h-1 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                                  {st.name} {st.nickname ? `(${st.nickname})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="border-t border-slate-800/60 pt-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Submitted Responses ({taskSubmissions.filter(s => s.status && s.status !== 'not submitted' && s.status !== 'Not Submitted').length})
                      </h4>
                    </div>

                    {taskSubmissions.filter(s => s.status && s.status !== 'not submitted' && s.status !== 'Not Submitted').length === 0 ? (
                      <div className="py-12 text-center space-y-3 bg-slate-900/20 border border-dashed border-slate-800/80 rounded-xl">
                        <FileText size={20} className="mx-auto text-slate-600" />
                        <h4 className="text-sm font-semibold text-slate-400">No active student submissions yet</h4>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          As students submit their tasks, their graded and ungraded responses will display below.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {taskSubmissions.map((sub) => {
                          const isUnsubmittedGroup = sub.isGroup && !sub.submission_id;
                          if (isUnsubmittedGroup) return null;

                          let statusBadgeText = sub.status;
                          let statusStyle = '';
                          if (isUnsubmittedGroup) {
                            statusBadgeText = 'Not Submitted';
                            statusStyle = 'text-slate-400 bg-slate-800/50 border-slate-700/50';
                          } else {
                            const derivedStatus = getSubmissionStatus(sub);
                            statusBadgeText = derivedStatus;
                            statusStyle = getSubmissionStatusBadgeColor(derivedStatus);
                          }

                          const isReviewingThis = selectedSubmissionForReview?.id === sub.id;

                          return (
                            <div
                              key={sub.id}
                              className={`bg-slate-900 border border-slate-800/80 rounded-xl p-4 md:p-5 space-y-4 flex flex-col transition-all hover:border-slate-700 submission-card ${
                                isReviewingThis ? 'ring-1 ring-purple-500/50 border-purple-500/30 shadow-md shadow-purple-950/20' : ''
                              }`}
                            >
                              {/* Card Header */}
                              <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="text-sm font-bold text-white">
                                      {sub.studentName}
                                    </h5>
                                    {sub.isGroup && (
                                      <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 uppercase tracking-wider">
                                        Group
                                      </span>
                                    )}
                                  </div>
                                  
                                  {sub.isGroup && sub.members && (
                                    <div className="text-[11px] text-slate-400 font-sans mt-1">
                                      <span className="text-slate-500 font-medium">Group Members:</span> {sub.members.join(', ')}
                                    </div>
                                  )}
                                  
                                  {sub.isGroup && sub.submitted_by_student_name && (
                                    <div className="text-[11px] text-slate-400 font-sans mt-1 flex items-center gap-1.5">
                                      <span className="text-slate-500">Submitted by:</span>
                                      <span className="text-slate-300 font-semibold">{sub.submitted_by_student_name}</span>
                                    </div>
                                  )}
                                  
                                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                    <Clock size={10} />
                                    {sub.created_at ? (
                                      `Submitted: ${new Date(sub.created_at).toLocaleString()}`
                                    ) : (
                                      <span className="text-amber-500/90 font-semibold font-mono bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10">Awaiting submission...</span>
                                    )}
                                  </p>
                                </div>
                                
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${statusStyle}`}>
                                  {statusBadgeText}
                                </span>
                              </div>

                              {/* Text Answer */}
                              {selectedTaskForSubmissions.allow_text_submission && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Student Response</span>
                                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-850/80 text-xs text-slate-300 italic whitespace-pre-wrap leading-relaxed">
                                    {sub.submission_text || (
                                      <span className="text-slate-600 italic">No text response.</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Attachments */}
                              {selectedTaskForSubmissions.allow_attachment_submission && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Uploaded Attachments</span>
                                  {sub.attachments && sub.attachments.length > 0 ? (
                                    <div className="grid sm:grid-cols-2 gap-2">
                                      {sub.attachments.map((file: any) => (
                                        <div
                                          key={file.id}
                                          className="bg-slate-950 border border-slate-850/80 p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs hover:border-slate-800 transition-colors"
                                        >
                                          <div className="truncate min-w-0 flex-1">
                                            <p className="font-mono text-slate-300 truncate font-semibold flex items-center gap-1.5">
                                              <Paperclip size={12} className="text-purple-400 shrink-0" />
                                              {file.file_name}
                                            </p>
                                            <p className="text-[9px] text-slate-500 mt-0.5 font-mono">
                                              Size: {(file.file_size_bytes ? (file.file_size_bytes / (1024 * 1024)).toFixed(2) : '0.00')} MB
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (file.signed_url) {
                                                window.open(file.signed_url, '_blank');
                                              } else {
                                                handleDownloadAttachment(file.file_path);
                                              }
                                            }}
                                            className="text-purple-400 hover:text-white font-bold bg-purple-500/10 hover:bg-purple-600 px-3 py-1 rounded-md border border-purple-500/20 transition-all text-[10px] cursor-pointer shrink-0"
                                          >
                                            Open File
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-500 italic bg-slate-950/20 p-2.5 border border-dashed border-slate-850/60 rounded-lg">
                                      No files uploaded.
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Review/Grade Section */}
                              {isReviewingThis && selectedTaskForSubmissions.allow_text_submission && sub.submission_text && sub.submission_text.trim().length > 0 && (
                                <AiWritingCheck 
                                  submissionId={sub.id} 
                                  taskId={selectedTaskForSubmissions.id}
                                  studentName={sub.studentName}
                                  submissionText={sub.submission_text}
                                />
                              )}
                              <div className="border-t border-slate-850 pt-4 mt-4">
                                {isUnsubmittedGroup ? (
                                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-xs text-slate-500 italic text-center">
                                    Awaiting group transmission. Cannot review until submitted.
                                  </div>
                                ) : isReviewingThis ? (
                                  /* Active Review Form */
                                  <div className="space-y-4 bg-slate-950/30 p-4 rounded-xl border border-slate-850 animate-fade-in">
                                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-850/60">
                                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                        <CheckSquare size={13} className="text-purple-400" />
                                        Task Review & Feedback Form
                                      </h4>
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                        Reviewing: {sub.studentName}
                                      </span>
                                    </div>

                                    <div className="grid sm:grid-cols-3 gap-4">
                                      <div className="sm:col-span-2 space-y-1.5">
                                        <label className="block text-[11px] text-slate-400 font-medium">Feedback / Evaluation comments</label>
                                        <textarea
                                          rows={3}
                                          value={reviewFeedback}
                                          onChange={(e) => setReviewFeedback(e.target.value)}
                                          placeholder="Add supportive comments, constructive notes, or instructions..."
                                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 leading-relaxed"
                                        />
                                      </div>
                                      <div className="space-y-1.5 flex flex-col justify-between">
                                        <div>
                                          <label className="block text-[11px] text-slate-400 font-medium">Awarded Points</label>
                                          <div className="relative mt-1">
                                            <input
                                              type="number"
                                              min={0}
                                              value={reviewScore}
                                              onChange={(e) => setReviewScore(Number(e.target.value))}
                                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono pr-12"
                                            />
                                            <span className="absolute right-3 top-2 text-[10px] font-bold text-slate-500 font-mono">PTS</span>
                                          </div>
                                          <p className="text-[10px] text-slate-500 italic mt-1">Max reward suggested: <span className="text-slate-300 font-semibold font-mono">{selectedTaskForSubmissions.reward_points}</span></p>
                                        </div>
                                        
                                        {/* Points delta warning help text */}
                                        <div className="bg-blue-500/5 border border-blue-500/10 p-2 rounded-lg text-[9px] text-blue-400/90 leading-normal mt-2">
                                          ℹ️ Points are updated safely based on the difference from the previous review.
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap justify-end gap-2 pt-1 border-t border-slate-850/60">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedSubmissionForReview(null)}
                                        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      {!selectedTaskForSubmissions.task_type || selectedTaskForSubmissions.task_type !== 'group' ? (
                                        <button
                                          type="button"
                                          disabled={isSavingReview}
                                          onClick={() => handleSaveReview('returned')}
                                          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-500 hover:text-amber-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                                        >
                                          {isSavingReview ? <Loader2 size={11} className="animate-spin" /> : null}
                                          Return for Revision
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        disabled={isSavingReview}
                                        onClick={() => handleSaveReview('reviewed')}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                                      >
                                        {isSavingReview ? <Loader2 size={11} className="animate-spin" /> : null}
                                        Complete & Grade
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* Static review info or button to start reviewing */
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    {sub.awarded_points !== undefined && sub.awarded_points !== null ? (
                                      <div className="space-y-1 w-full sm:w-auto flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs text-yellow-500 font-mono font-bold bg-yellow-500/5 px-2.5 py-0.5 rounded border border-yellow-500/10 inline-block">
                                            ⭐ Awarded Points: {sub.awarded_points} / {selectedTaskForSubmissions.reward_points} pts
                                          </span>
                                          {sub.reviewed_at && (
                                            <p className="text-[10px] text-slate-500 font-mono">
                                              Reviewed: {new Date(sub.reviewed_at).toLocaleDateString()}
                                            </p>
                                          )}
                                        </div>
                                        {sub.teacher_feedback && (
                                          <p className="text-xs text-slate-300 bg-slate-950/40 border border-slate-850 p-3 rounded-lg mt-1.5 italic leading-relaxed">
                                            <span className="text-[10px] text-slate-500 block uppercase font-bold not-italic tracking-wider mb-0.5">Teacher Feedback</span>
                                            "{sub.teacher_feedback}"
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-slate-500 italic bg-slate-950 px-2 py-0.5 rounded border border-slate-850">Needs Evaluation</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleSelectSubmissionForReview(sub)}
                                      className="text-purple-400 hover:text-white bg-purple-500/10 hover:bg-purple-600 text-xs font-semibold px-3 py-1.5 rounded-lg border border-purple-500/20 hover:border-transparent transition-all cursor-pointer ml-auto"
                                    >
                                      {sub.awarded_points !== undefined && sub.awarded_points !== null ? 'Edit Review' : 'Grade & Feedback'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 shrink-0 submissions-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setSelectedTaskForSubmissions(null);
                  setSelectedSubmissionForReview(null);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-750"
              >
                Close Submissions Viewer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Create / Edit Badge Modal */}
      {isBadgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <Award className="text-amber-500" size={18} />
                {editingBadge ? 'Edit Badge Definition' : 'Create Custom Badge'}
              </h3>
              <button
                type="button"
                onClick={() => setIsBadgeModalOpen(false)}
                className="text-slate-500 hover:text-white p-1 hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBadgeDefinition} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Badge Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Star Speaker"
                  value={badgeFormName}
                  onChange={(e) => setBadgeFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Awarded to students demonstrating outstanding spoken English."
                  value={badgeFormDescription}
                  onChange={(e) => setBadgeFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-slate-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Badge Icon (Emoji)</label>
                  <select
                    value={badgeFormIcon}
                    onChange={(e) => setBadgeFormIcon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="⭐">⭐ Star</option>
                    <option value="🚀">🚀 Rocket</option>
                    <option value="👑">👑 Crown</option>
                    <option value="🏆">🏆 Trophy</option>
                    <option value="🎖️">🎖️ Medal</option>
                    <option value="🏅">🏅 Medal 2</option>
                    <option value="🤝">🤝 Teamwork</option>
                    <option value="🔥">🔥 Fire</option>
                    <option value="🧠">🧠 Brain</option>
                    <option value="🛸">🛸 UFO</option>
                    <option value="🪐">🪐 Planet</option>
                    <option value="🦾">🦾 Cyborg</option>
                    <option value="🛡️">🛡️ Shield</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Awarding Type</label>
                  <select
                    value={badgeFormType}
                    onChange={(e) => {
                      setBadgeFormType(e.target.value as 'manual' | 'automatic');
                      if (e.target.value === 'manual') {
                        setBadgeFormTrigger('teacher_choice');
                      } else {
                        setBadgeFormTrigger('points_threshold');
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="manual">Manual (By Teacher)</option>
                    <option value="automatic">Automatic (System Triggered)</option>
                  </select>
                </div>
              </div>

              {badgeFormType === 'automatic' && (
                <div className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-850 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Automatic Trigger Criterion</label>
                    <select
                      value={badgeFormTrigger}
                      onChange={(e) => setBadgeFormTrigger(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="points_threshold">Points Threshold Reached</option>
                      <option value="individual_tasks_completed">Individual Task Count Completed</option>
                      <option value="group_tasks_completed">Group Task Count Completed</option>
                      <option value="first_submission">First Task Submitted</option>
                      <option value="first_reviewed_task">First Task Reviewed/Graded by Teacher</option>
                      <option value="no_lives_lost_meeting">Completed a Meeting with Perfect Lives</option>
                      <option value="comeback_from_zero_lives">Zero Lives Comeback</option>
                    </select>
                  </div>

                  {badgeFormTrigger === 'points_threshold' && (
                    <div className="animate-fade-in">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Target Points Required</label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="e.g. 100"
                        value={badgeFormPointsThreshold}
                        onChange={(e) => setBadgeFormPointsThreshold(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                      />
                    </div>
                  )}

                  {badgeFormTrigger === 'individual_tasks_completed' && (
                    <div className="animate-fade-in">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Individual Tasks Required</label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="e.g. 5"
                        value={badgeFormTaskCount}
                        onChange={(e) => setBadgeFormTaskCount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                      />
                    </div>
                  )}

                  {badgeFormTrigger === 'group_tasks_completed' && (
                    <div className="animate-fade-in">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Group Tasks Required</label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="e.g. 3"
                        value={badgeFormGroupTaskCount}
                        onChange={(e) => setBadgeFormGroupTaskCount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBadgeModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-md cursor-pointer"
                >
                  Save Definition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Awarding Modal */}
      {isAwardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <Award className="text-amber-500" size={18} />
                Award Badge to Student
              </h3>
              <button
                type="button"
                onClick={() => setIsAwardModalOpen(false)}
                className="text-slate-500 hover:text-white p-1 hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAwardBadge} className="p-6 space-y-4">
              {badgeAwardError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs font-semibold leading-relaxed animate-fade-in">
                  ⚠️ {badgeAwardError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Student</label>
                <select
                  required
                  disabled={!!awardSelectedStudentId}
                  value={awardSelectedStudentId}
                  onChange={(e) => setAwardSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">-- Choose Student --</option>
                  {classData.students?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nickname ? `${s.name} (${s.nickname})` : s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Manual Badge</label>
                <select
                  required
                  value={awardSelectedBadgeId}
                  onChange={(e) => setAwardSelectedBadgeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">-- Choose Badge --</option>
                  {badgeDefinitions
                    .filter((b) => b.badge_type === 'manual')
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.icon || '🏅'} {b.name}
                      </option>
                    ))}
                </select>
                {badgeDefinitions.filter((b) => b.badge_type === 'manual').length === 0 && (
                  <p className="text-[10px] text-amber-500 mt-1.5 italic">
                    No manual-type badge definitions exist yet. Go to definition builder to create one.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Optional Feedback/Reason</label>
                <textarea
                  rows={2}
                  maxLength={150}
                  placeholder="Reason for award, e.g. Showed extreme persistence completing the reading assignment!"
                  value={awardReason}
                  onChange={(e) => setAwardReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-slate-500 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAwardModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAwardingBadge}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  {isAwardingBadge && <Loader2 size={12} className="animate-spin" />}
                  Award Badge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmActionModal {...confirmModalConfig} onClose={closeConfirmModal} />
    </div>
  );
}
