const fs = require('fs');
let content = fs.readFileSync('src/components/GuardianAccess.tsx', 'utf8');

const importTarget = `import { ShieldCheck, ArrowLeft, Loader2, Sparkles, Trophy } from 'lucide-react';`;
const importReplacement = `import { ShieldCheck, ArrowLeft, Loader2, Sparkles, Trophy, CheckCircle, Clock, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';`;
content = content.replace(importTarget, importReplacement);

const dashboardDataTarget = `  const [studentPreview, setStudentPreview] = useState<any>(null);
  const [classData, setClassData] = useState<any>(null);`;
const dashboardDataReplacement = `  const [dashboardData, setDashboardData] = useState<any>(null);`;
content = content.replace(dashboardDataTarget, dashboardDataReplacement);

const handleLoginTarget = `      const result = await fetchGuardianStudentPreview(classCode.trim().toUpperCase(), guardianCode.trim().toUpperCase());
      if (result.ok && result.studentData && result.classData) {
        setStudentPreview(result.studentData);
        setClassData(result.classData);
      } else {`;
const handleLoginReplacement = `      const result = await fetchGuardianStudentPreview(classCode.trim().toUpperCase(), guardianCode.trim().toUpperCase());
      if (result.ok && result.studentData && result.classData) {
        setDashboardData(result);
      } else {`;
content = content.replace(handleLoginTarget, handleLoginReplacement);

const handleRefreshAddition = `
  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const result = await fetchGuardianStudentPreview(classCode.trim().toUpperCase(), guardianCode.trim().toUpperCase());
      if (result.ok && result.studentData && result.classData) {
        setDashboardData(result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
`;
content = content.replace('  if (studentPreview && classData) {', handleRefreshAddition + '\n  if (dashboardData) {\n    const studentPreview = dashboardData.studentData;\n    const classData = dashboardData.classData;\n    const tasks = dashboardData.tasks || [];\n    const submissions = dashboardData.submissions || [];\n    const badges = dashboardData.badges || [];\n    const logs = dashboardData.logs || [];\n');

// Replace the return block for the dashboard view
const oldReturnStart = `    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6 font-sans relative overflow-hidden">`;
const oldReturnEnd = `        </main>
      </div>
    );`;

const newReturnBlock = `    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6 font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-sky-950/20 via-slate-950/40 to-slate-950 pointer-events-none" />
        
        <header className="max-w-4xl w-full mx-auto flex items-center justify-between mb-8 relative z-10 border-b border-slate-900/60 pb-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-sky-400" size={24} />
            <div>
              <h1 className="text-xl font-display font-black text-white tracking-tight">Guardian Portal</h1>
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">Learning Progress Overview</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-all bg-sky-900/20 hover:bg-sky-900/30 border border-sky-800/40 rounded-lg px-3 py-2 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              onClick={onBack}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-all bg-slate-900/60 hover:bg-slate-900 border border-slate-800/85 hover:border-slate-700/60 rounded-lg px-3 py-2 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} /> Exit
            </button>
          </div>
        </header>

        <main className="max-w-4xl w-full mx-auto relative z-10 flex-1 flex flex-col gap-6">
          {/* Header Card */}
          <div className="w-full bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="inline-flex items-center justify-center p-4 bg-sky-500/10 text-sky-400 rounded-full shrink-0">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {studentPreview.nickname ? \`\${studentPreview.name} (\${studentPreview.nickname})\` : studentPreview.name}
                </h2>
                <p className="text-sm text-slate-400 mt-1 flex items-center justify-center md:justify-start gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-sky-500"></span>
                  {classData.name} {classData.level && \`• \${classData.level}\`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center md:justify-end gap-3">
              <div className="bg-slate-950/50 border border-slate-850 rounded-xl px-5 py-3 text-center min-w-[100px]">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Points</div>
                <div className="text-2xl font-black text-amber-400">{studentPreview.points}</div>
              </div>
              {classData.scoring_system === 'lives' && (
                <div className="bg-slate-950/50 border border-slate-850 rounded-xl px-5 py-3 text-center min-w-[100px]">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Health</div>
                  <div className="text-2xl font-black text-rose-400">{studentPreview.lives}</div>
                </div>
              )}
              <div className="bg-slate-950/50 border border-slate-850 rounded-xl px-5 py-3 text-center min-w-[100px]">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Badges</div>
                <div className="text-2xl font-black text-purple-400">{badges.length}</div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Left Column: Tasks */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <CheckCircle size={18} className="text-emerald-400" /> Task Progress
                </h3>
                
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No tasks assigned yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map((task: any) => {
                      const submission = submissions.find((s: any) => s.task_id === task.id);
                      let statusLabel = "Not Started";
                      let statusColor = "text-slate-400 bg-slate-800/50 border-slate-700/50";
                      
                      if (submission) {
                        if (submission.status === 'reviewed') {
                          statusLabel = "Reviewed";
                          statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                        } else if (submission.status === 'returned') {
                          statusLabel = "Needs Attention";
                          statusColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                        } else {
                          statusLabel = "Submitted";
                          statusColor = "text-sky-400 bg-sky-500/10 border-sky-500/20";
                        }
                      }

                      return (
                        <div key={task.id} className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-4">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h4 className="text-sm font-bold text-slate-200">{task.title}</h4>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className={\`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border \${statusColor}\`}>
                                  {statusLabel}
                                </span>
                                {submission?.awarded_points !== undefined && (
                                  <span className="text-xs font-medium text-amber-400">
                                    +{submission.awarded_points} pts
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {submission?.teacher_feedback && (
                            <div className="mt-3 pt-3 border-t border-slate-800/60">
                              <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                                <MessageSquare size={12} /> Teacher Feedback
                              </div>
                              <p className="text-sm text-slate-300 bg-slate-900/50 rounded-lg p-3 border border-slate-800/40">
                                {submission.teacher_feedback}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Recent Activity & Badges */}
            <div className="space-y-6">
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy size={18} className="text-purple-400" /> Earned Badges
                </h3>
                
                {badges.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    No badges yet. Progress will appear here.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {badges.map((b: any) => (
                      <div key={b.id} className="bg-slate-950/50 border border-slate-800/60 rounded-lg p-3 text-center flex-1 min-w-[80px]">
                        <div className="text-2xl mb-1">{b.badge?.icon || '🏆'}</div>
                        <div className="text-xs font-bold text-slate-300 line-clamp-1" title={b.badge?.name}>{b.badge?.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-sky-400" /> Recent Progress
                </h3>
                
                {logs.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    No recent activity.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.slice(0, 5).map((log: any) => {
                      let desc = "Learning activity";
                      let color = "text-slate-400";
                      
                      if (log.action_type === 'points_awarded') {
                        desc = \`Earned \${log.points_delta} points\`;
                        color = "text-amber-400";
                      } else if (log.action_type === 'points_deducted') {
                        desc = \`Needs attention (points updated)\`;
                        color = "text-slate-400";
                      } else if (log.action_type === 'lives_deducted') {
                        desc = \`Health updated\`;
                        color = "text-rose-400";
                      } else if (log.action_type === 'badge_awarded') {
                        desc = \`Earned a badge\`;
                        color = "text-purple-400";
                      } else if (log.action_type === 'task_submitted') {
                        desc = \`Submitted a task\`;
                        color = "text-sky-400";
                      } else if (log.action_type === 'task_reviewed') {
                        desc = \`Task was reviewed\`;
                        color = "text-emerald-400";
                      }

                      return (
                        <div key={log.id} className="flex items-center gap-3 text-sm">
                          <div className={\`w-1.5 h-1.5 rounded-full bg-current \${color}\`} />
                          <span className="text-slate-300">{desc}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );`;

const startIndex = content.indexOf(oldReturnStart);
const endIndex = content.indexOf(oldReturnEnd) + oldReturnEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newReturnBlock + content.substring(endIndex);
}

fs.writeFileSync('src/components/GuardianAccess.tsx', content);
