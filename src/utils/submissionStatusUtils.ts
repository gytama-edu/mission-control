export function getSubmissionStatus(submission?: any) {
  if (!submission) return 'Not Submitted';
  
  // existing status enum: 'submitted', 'reviewed', 'returned', 'late'
  switch (submission.status) {
    case 'reviewed':
      return 'Reviewed';
    case 'returned':
      return 'Needs Revision';
    case 'late':
      return 'Submitted (Late)';
    case 'submitted':
    default:
      // A submitted item that isn't reviewed or returned needs review
      return 'Needs Review';
  }
}

export function getSubmissionStatusBadgeColor(status: string) {
  switch (status) {
    case 'Needs Review':
      return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
    case 'Reviewed':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'Needs Revision':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    case 'Submitted (Late)':
      return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    case 'Not Submitted':
    default:
      return 'bg-slate-800/50 text-slate-400 border border-slate-700/50';
  }
}

export function getTaskSubmissionSummary(task: any, students: any[], submissions: any[]) {
  const taskSubs = submissions.filter(s => s.task_id === task.id);
  
  let needsReview = 0;
  let reviewed = 0;
  let returned = 0;
  let notSubmitted = 0;
  
  if (task.task_type === 'group') {
    // For groups, it's slightly more complex without the groups loaded,
    // but we can estimate based on unique task_group_id submissions.
    // If we don't have task groups here, we just summarize the submissions we have.
    taskSubs.forEach(sub => {
      const status = getSubmissionStatus(sub);
      if (status === 'Needs Review' || status === 'Submitted (Late)') needsReview++;
      else if (status === 'Reviewed') reviewed++;
      else if (status === 'Needs Revision') returned++;
    });
    // Can't easily calculate notSubmitted without total group count, so we'll omit or leave as 0
  } else {
    // Individual task
    students.forEach(student => {
      const sub = taskSubs.find(s => s.student_id === student.id);
      if (!sub) {
        notSubmitted++;
      } else {
        const status = getSubmissionStatus(sub);
        if (status === 'Needs Review' || status === 'Submitted (Late)') needsReview++;
        else if (status === 'Reviewed') reviewed++;
        else if (status === 'Needs Revision') returned++;
      }
    });
  }
  
  return {
    needsReview,
    reviewed,
    returned,
    notSubmitted,
    totalSubmitted: taskSubs.length
  };
}
