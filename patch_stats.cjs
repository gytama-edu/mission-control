const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

// In Active Session Overview Card
const activeSessionOverviewOld = `                              <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-500/20">
                                <p className="text-xs text-slate-400 font-medium mb-1">Actions</p>
                                <p className="text-lg font-bold text-purple-400 font-mono">{totalActions}</p>
                              </div>`;

const activeSessionOverviewNew = `                              <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-500/20">
                                <p className="text-xs text-slate-400 font-medium mb-1">Actions</p>
                                <p className="text-lg font-bold text-purple-400 font-mono">{totalActions}</p>
                              </div>
                              <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-500/20 hidden sm:block">
                                <p className="text-xs text-slate-400 font-medium mb-1">Submissions</p>
                                <p className="text-lg font-bold text-blue-400 font-mono">{allSubmissions.filter(s => new Date(s.created_at).getTime() >= new Date(activeMeeting.startedAt).getTime()).length}</p>
                              </div>
                              <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-500/20 hidden sm:block">
                                <p className="text-xs text-slate-400 font-medium mb-1">Reviews</p>
                                <p className="text-lg font-bold text-indigo-400 font-mono">{allSubmissions.filter(s => s.reviewed_at && new Date(s.reviewed_at).getTime() >= new Date(activeMeeting.startedAt).getTime()).length}</p>
                              </div>`;

if (code.includes(activeSessionOverviewOld)) {
    code = code.replace(activeSessionOverviewOld, activeSessionOverviewNew);
}

// In Active Session Roster Banner
const rosterBannerOld = `                    <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-center min-w-[80px]">
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-0.5">Actions</p>
                      <p className="text-sm font-bold text-purple-400 font-mono">{totalActions}</p>
                    </div>`;

const rosterBannerNew = `                    <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-center min-w-[80px]">
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-0.5">Actions</p>
                      <p className="text-sm font-bold text-purple-400 font-mono">{totalActions}</p>
                    </div>
                    <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-center min-w-[80px] hidden sm:block">
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-0.5">Submits</p>
                      <p className="text-sm font-bold text-blue-400 font-mono">{allSubmissions.filter(s => new Date(s.created_at).getTime() >= new Date(activeMeeting.startedAt).getTime()).length}</p>
                    </div>
                    <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-center min-w-[80px] hidden sm:block">
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-0.5">Reviews</p>
                      <p className="text-sm font-bold text-indigo-400 font-mono">{allSubmissions.filter(s => s.reviewed_at && new Date(s.reviewed_at).getTime() >= new Date(activeMeeting.startedAt).getTime()).length}</p>
                    </div>`;

if (code.includes(rosterBannerOld)) {
    code = code.replace(rosterBannerOld, rosterBannerNew);
}

// In handleEndMeeting Modal logic
const handleEndMeetingOld = `      const duration = Math.max(1, Math.round((new Date().getTime() - new Date(activeMeeting.startedAt).getTime()) / 1000 / 60));
      
      const summary = {
        duration,
        totalPoints,
        positivePoints,
        negativePoints,
        totalActions,
        startedAt: activeMeeting.startedAt,
        endedAt: new Date().toISOString()
      };`;

const handleEndMeetingNew = `      const duration = Math.max(1, Math.round((new Date().getTime() - new Date(activeMeeting.startedAt).getTime()) / 1000 / 60));
      const submissions = allSubmissions.filter(s => new Date(s.created_at).getTime() >= new Date(activeMeeting.startedAt).getTime()).length;
      const reviews = allSubmissions.filter(s => s.reviewed_at && new Date(s.reviewed_at).getTime() >= new Date(activeMeeting.startedAt).getTime()).length;
      
      const summary = {
        duration,
        totalPoints,
        positivePoints,
        negativePoints,
        totalActions,
        submissions,
        reviews,
        startedAt: activeMeeting.startedAt,
        endedAt: new Date().toISOString()
      };`;

if (code.includes(handleEndMeetingOld)) {
    code = code.replace(handleEndMeetingOld, handleEndMeetingNew);
}

// In End Modal UI
const modalUIOld = `                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-slate-400 font-medium">Total Actions</span>
                  <span className="text-purple-400 font-mono font-bold">{endedSessionSummary.totalActions}</span>
                </div>`;

const modalUINew = `                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-slate-400 font-medium">Total Actions</span>
                  <span className="text-purple-400 font-mono font-bold">{endedSessionSummary.totalActions}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-slate-400 font-medium">Submissions & Reviews</span>
                  <span className="text-blue-400 font-mono font-bold">{endedSessionSummary.submissions} / {endedSessionSummary.reviews}</span>
                </div>`;

if (code.includes(modalUIOld)) {
    code = code.replace(modalUIOld, modalUINew);
}

fs.writeFileSync('src/components/ClassDetail.tsx', code);
console.log("Success");
