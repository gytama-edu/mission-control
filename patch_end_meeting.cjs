const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const targetState = "  const [lastSynced, setLastSynced] = useState<Date | null>(null);";
const stateReplacement = "  const [lastSynced, setLastSynced] = useState<Date | null>(null);\n  const [endedSessionSummary, setEndedSessionSummary] = useState<any>(null);";

if (code.includes(targetState)) {
    code = code.replace(targetState, stateReplacement);
}

const targetEndMeeting = `  const handleEndMeeting = async () => {
    if (!activeMeeting) return;
    try {
      await onEndMeeting(activeMeeting.id);
      setIsEndMeetingModalOpen(false);
      alert('Class meeting ended and session summary created!');
    } catch (err: any) {
      alert(err.message || 'Failed to end meeting.');
    }
  };`;

const endMeetingReplacement = `  const handleEndMeeting = async () => {
    if (!activeMeeting) return;
    try {
      // Calculate summary before ending
      const logsForMeeting = activityLogs.filter(log => log.meeting_id === activeMeeting.id);
      const totalActions = logsForMeeting.length;
      const totalPoints = logsForMeeting.filter(l => l.points_delta).reduce((sum, l) => sum + (l.points_delta || 0), 0);
      const positivePoints = logsForMeeting.filter(l => (l.points_delta || 0) > 0).reduce((sum, l) => sum + (l.points_delta || 0), 0);
      const negativePoints = logsForMeeting.filter(l => (l.points_delta || 0) < 0).reduce((sum, l) => sum + (l.points_delta || 0), 0);
      const duration = Math.max(1, Math.round((new Date().getTime() - new Date(activeMeeting.startedAt).getTime()) / 1000 / 60));
      
      const summary = {
        duration,
        totalPoints,
        positivePoints,
        negativePoints,
        totalActions,
        startedAt: activeMeeting.startedAt,
        endedAt: new Date().toISOString()
      };

      await onEndMeeting(activeMeeting.id);
      setIsEndMeetingModalOpen(false);
      setEndedSessionSummary(summary);
    } catch (err: any) {
      alert(err.message || 'Failed to end session.');
    }
  };`;

if (code.includes(targetEndMeeting)) {
    code = code.replace(targetEndMeeting, endMeetingReplacement);
}

const targetModal = `      {/* End Meeting Confirmation Modal */}`;
const modalReplacement = `      {/* Ended Session Summary Modal */}
      {endedSessionSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Trophy size={120} className="text-yellow-400" />
            </div>
            <div className="relative z-10 text-center">
              <div className="bg-emerald-500/20 text-emerald-400 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                <CheckSquare size={32} />
              </div>
              <h3 className="text-2xl font-display font-bold text-white mb-2">Session Complete!</h3>
              <p className="text-slate-300 text-sm mb-6">
                Your class session has been successfully logged and summarized.
              </p>
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left space-y-4 mb-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-slate-400 font-medium">Duration</span>
                  <span className="text-white font-mono font-bold">{endedSessionSummary.duration} min</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-slate-400 font-medium">Total Actions</span>
                  <span className="text-purple-400 font-mono font-bold">{endedSessionSummary.totalActions}</span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span className="text-slate-400 font-medium">Net Points</span>
                  <span className="text-rose-400 font-mono font-bold">{endedSessionSummary.totalPoints > 0 ? '+' : ''}{endedSessionSummary.totalPoints}</span>
                </div>
                <div className="flex justify-between text-xs font-mono text-slate-500 pt-1">
                  <span>Earned: <span className="text-emerald-400">+{endedSessionSummary.positivePoints}</span></span>
                  <span>Lost: <span className="text-red-400">{endedSessionSummary.negativePoints}</span></span>
                </div>
              </div>
              
              <button
                onClick={() => setEndedSessionSummary(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold transition-colors"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Meeting Confirmation Modal */}`;

if (code.includes(targetModal)) {
    code = code.replace(targetModal, modalReplacement);
}

fs.writeFileSync('src/components/ClassDetail.tsx', code);
console.log("Success");
