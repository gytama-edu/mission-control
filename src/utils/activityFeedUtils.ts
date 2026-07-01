import { getSubmissionStatus } from './submissionStatusUtils';

export function buildClassActivityFeed(params: {
  activityLogs: any[];
  submissions: any[];
  tasks: any[];
  students: any[];
  studentBadges?: any[];
  badgeDefinitions?: any[];
}) {
  const { activityLogs, submissions, tasks, students, studentBadges = [], badgeDefinitions = [] } = params;
  const feed: any[] = [];

  // 1. Process activity logs (points and lives)
  activityLogs.forEach(log => {
    if (!log.undone && (log.points_delta !== 0 || log.lives_delta !== 0)) {
      const student = students.find(s => s.id === log.student_id);
      feed.push({
        id: `log-${log.id}`,
        type: log.points_delta ? 'points' : 'lives',
        studentName: student ? (student.nickname || student.name) : 'Unknown Student',
        timestamp: new Date(log.created_at || Date.now()),
        summary: log.reason || (log.points_delta > 0 ? 'Earned points' : 'Lost points'),
        delta: log.points_delta || log.lives_delta,
        isNew: isRecent(log.created_at)
      });
    }
  });

  // 2. Process submissions (submission events and review events)
  submissions.forEach(sub => {
    const task = tasks.find(t => t.id === sub.task_id);
    if (!task) return;
    const student = students.find(s => s.id === sub.student_id);
    const studentName = student ? (student.nickname || student.name) : 'Unknown Student';
    const status = getSubmissionStatus(sub);

    // Submission created event
    if (sub.created_at) {
      feed.push({
        id: `sub-create-${sub.id}`,
        type: 'submission_new',
        studentName,
        timestamp: new Date(sub.created_at),
        summary: `Submitted task: ${task.title}`,
        isNew: isRecent(sub.created_at)
      });
    }

    // Review/return event
    if (sub.reviewed_at && (status === 'Reviewed' || status === 'Needs Revision')) {
      feed.push({
        id: `sub-review-${sub.id}`,
        type: 'submission_reviewed',
        studentName,
        timestamp: new Date(sub.reviewed_at),
        summary: `Feedback received on: ${task.title}`,
        isNew: isRecent(sub.reviewed_at)
      });
    }
  });

  // 3. Process badges
  studentBadges.forEach(sb => {
    const badgeDef = badgeDefinitions.find(bd => bd.id === sb.badge_id) || sb.badge;
    const badgeName = badgeDef ? badgeDef.name : 'a badge';
    const student = students.find(s => s.id === sb.student_id);
    const studentName = student ? (student.nickname || student.name) : 'Unknown Student';

    if (sb.awarded_at) {
      feed.push({
        id: `badge-${sb.id}`,
        type: 'badge_awarded',
        studentName,
        timestamp: new Date(sb.awarded_at),
        summary: `Earned badge: ${badgeName}`,
        badgeIcon: badgeDef?.icon || '🏆',
        isNew: isRecent(sb.awarded_at)
      });
    }
  });

  // Sort descending by timestamp
  return feed.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function buildStudentActivityFeed(params: {
  student: any;
  activityLogs: any[];
  submissions: any[];
  tasks: any[];
  studentBadges?: any[];
  badgeDefinitions?: any[];
}) {
  const feed = buildClassActivityFeed({ ...params, students: [params.student] });
  return feed;
}

export function isRecent(timestampStr?: string) {
  if (!timestampStr) return false;
  const date = new Date(timestampStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  // 15 minutes in ms = 15 * 60 * 1000 = 900000
  return diffMs < 900000;
}
