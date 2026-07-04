const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const replacement = `          {/* Active Session Overview Card (if any) */}
          {activeMeeting && (() => {
            const isPrivate = classData.category === 'private';
            const logsForMeeting = activityLogs.filter(log => log.meeting_id === activeMeeting.id);
            const totalActions = logsForMeeting.length;
            const totalPoints = logsForMeeting.filter(l => l.points_delta).reduce((sum, l) => sum + (l.points_delta || 0), 0);
            const sessionDuration = Math.max(1, Math.round((new Date().getTime() - new Date(activeMeeting.startedAt).getTime()) / 1000 / 60));
            
            return (
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 mb-2 relative overflow-hidden animate-fade-in shadow-xl select-none">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Activity size={100} className="text-emerald-400" />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider font-mono">Active Session in Progress</h3>
                      <p className="text-xs text-emerald-500/70 font-mono mt-0.5">Started {new Date(activeMeeting.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-center min-w-[80px]">
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-0.5">Duration</p>
                      <p className="text-sm font-bold text-white font-mono">{sessionDuration} min</p>
                    </div>
                    <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-center min-w-[80px]">
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-0.5">{isPrivate ? 'Points Earned' : 'Session Points'}</p>
                      <p className="text-sm font-bold text-rose-400 font-mono">+{totalPoints}</p>
                    </div>
                    <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-center min-w-[80px]">
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-0.5">Actions</p>
                      <p className="text-sm font-bold text-purple-400 font-mono">{totalActions}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Recent Activity Feed (Highlights) */}`;

const target = "          {/* Recent Activity Feed (Highlights) */}";

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/components/ClassDetail.tsx', code);
    console.log("Success");
} else {
    console.log("Could not find target");
}
