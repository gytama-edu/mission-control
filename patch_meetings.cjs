const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const replacement = `              {reportsSubTab === 'meetings' && (() => {
                const isPrivate = classData.category === 'private';
                const isLives = getEffectiveClassroomMode(classData.category, classData.scoring_system) === 'lives';

                if (!classData.meetings || classData.meetings.length === 0) {
                  return (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500 italic">
                      Start a session to automatically generate logs and summaries.
                    </div>
                  );
                }

                // Sort meetings newest first
                const sortedMeetings = [...classData.meetings].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

                return (
                  <div className="space-y-6">
                    {/* Active Session Overview Card (if any) */}
                    {activeMeeting && (() => {
                      const logsForMeeting = activityLogs.filter(log => log.meeting_id === activeMeeting.id);
                      const totalActions = logsForMeeting.length;
                      const totalPoints = logsForMeeting.filter(l => l.points_delta).reduce((sum, l) => sum + (l.points_delta || 0), 0);
                      
                      const sessionDuration = Math.max(1, Math.round((new Date().getTime() - new Date(activeMeeting.startedAt).getTime()) / 1000 / 60));
                      
                      return (
                        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-5 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Activity size={100} className="text-emerald-400" />
                          </div>
                          
                          <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                              <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                              </span>
                              <h3 className="text-lg font-display font-bold text-emerald-400 uppercase tracking-wider">Active Session in Progress</h3>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                              <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-500/20">
                                <p className="text-xs text-slate-400 font-medium mb-1">Started</p>
                                <p className="text-lg font-bold text-white">{new Date(activeMeeting.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                              <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-500/20">
                                <p className="text-xs text-slate-400 font-medium mb-1">Duration</p>
                                <p className="text-lg font-bold text-white font-mono">{sessionDuration} min</p>
                              </div>
                              <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-500/20">
                                <p className="text-xs text-slate-400 font-medium mb-1">{isPrivate ? 'Points Earned' : 'Session Points'}</p>
                                <p className="text-lg font-bold text-rose-400 font-mono">+{totalPoints}</p>
                              </div>
                              <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-500/20">
                                <p className="text-xs text-slate-400 font-medium mb-1">Actions</p>
                                <p className="text-lg font-bold text-purple-400 font-mono">{totalActions}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Session History List */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="p-5 border-b border-slate-800">
                        <h3 className="text-lg font-display font-bold text-white">{isPrivate ? 'Personal Session History' : 'Classroom Session History'}</h3>
                        <p className="text-sm text-slate-400 mt-0.5">Historical session logs showing points, actions, and interactions from past sessions.</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono uppercase tracking-wider text-slate-400">
                              <th className="p-4">Session Date</th>
                              <th className="p-4 text-center">Status</th>
                              <th className="p-4 text-center">Duration</th>
                              <th className="p-4 text-center">Actions</th>
                              <th className="p-4 text-center">Points</th>
                              {isLives && (
                                <>
                                  <th className="p-4 text-center">Lives Lost</th>
                                  <th className="p-4 text-center">Lives Gained</th>
                                </>
                              )}
                              {!isPrivate && <th className="p-4">Highlights</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-300">
                            {sortedMeetings.map((meeting) => {
                              const startDate = new Date(meeting.startedAt);
                              const startedDate = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              
                              const summary = meeting.summary || {};
                              
                              // We calculate this on the fly for better accuracy using timestamp range where possible
                              // since we didn't store session_id until now
                              let logsForMeeting = [];
                              if (meeting.id) {
                                // Prefer logs with explicit meeting_id
                                logsForMeeting = activityLogs.filter(log => log.meeting_id === meeting.id);
                                // If none, try timestamp matching
                                if (logsForMeeting.length === 0) {
                                  const endTimestamp = meeting.endedAt ? new Date(meeting.endedAt).getTime() : new Date().getTime();
                                  logsForMeeting = activityLogs.filter(log => {
                                    const logTime = new Date(log.created_at).getTime();
                                    return logTime >= startDate.getTime() && logTime <= endTimestamp;
                                  });
                                }
                              }
                              
                              const durationMinutes = meeting.endedAt ? Math.max(1, Math.round((new Date(meeting.endedAt).getTime() - startDate.getTime()) / 1000 / 60)) : Math.max(1, Math.round((new Date().getTime() - startDate.getTime()) / 1000 / 60));
                              const duration = summary.duration || \`\${durationMinutes} min\`;
                              
                              const totalActions = logsForMeeting.length;
                              const totalPoints = logsForMeeting.filter(l => l.points_delta).reduce((sum, l) => sum + (l.points_delta || 0), 0);
                              
                              const totalLivesLost = logsForMeeting.filter(l => l.lives_delta && l.lives_delta < 0).reduce((sum, l) => sum + Math.abs(l.lives_delta || 0), 0);
                              const totalLivesGained = logsForMeeting.filter(l => l.lives_delta && l.lives_delta > 0).reduce((sum, l) => sum + (l.lives_delta || 0), 0);
                              
                              return (
                                <tr key={meeting.id} className="hover:bg-slate-850/30 transition-colors">
                                  <td className="p-4 font-medium text-white whitespace-nowrap">{startedDate}</td>
                                  <td className="p-4 text-center text-xs font-bold uppercase">
                                    <span className={\`px-2 py-0.5 rounded-full \${meeting.status === 'active' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}\`}>
                                      {meeting.status}
                                    </span>
                                  </td>
                                  <td className="p-4 text-center font-mono text-sm whitespace-nowrap">{duration}</td>
                                  <td className="p-4 text-center font-mono text-sm text-purple-400">{totalActions}</td>
                                  <td className="p-4 text-center font-mono text-sm text-rose-400 font-semibold">
                                    {totalPoints >= 0 ? \`+\${totalPoints}\` : totalPoints}
                                  </td>
                                  {isLives && (
                                    <>
                                      <td className="p-4 text-center font-mono text-sm text-red-400">-{totalLivesLost}</td>
                                      <td className="p-4 text-center font-mono text-sm text-emerald-400">+{totalLivesGained}</td>
                                    </>
                                  )}
                                  {!isPrivate && (
                                    <td className="p-4 font-mono text-sm text-slate-300">
                                      {summary.most_active_student || (totalActions > 0 ? 'See Activity' : 'N/A')}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
`;

const lines = code.split('\n');
const startPattern = "              {reportsSubTab === 'meetings' && (() => {";
const endPattern = "              {reportsSubTab === 'badges' && (() => {";

let startIndex = -1;
let endIndex = -1;

for (let i=0; i<lines.length; i++) {
  if (lines[i].includes(startPattern)) startIndex = i;
  if (lines[i].includes(endPattern)) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
    const newCode = lines.slice(0, startIndex).join('\n') + '\n' + replacement + lines.slice(endIndex).join('\n');
    fs.writeFileSync('src/components/ClassDetail.tsx', newCode);
    console.log("Success");
} else {
    console.log("Failed to find lines", startIndex, endIndex);
}
