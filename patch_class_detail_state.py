import re

with open('src/components/ClassDetail.tsx', 'r') as f:
    code = f.read()

# Add states
state_addition = """  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [aiDraftResult, setAiDraftResult] = useState<any | null>(null);
  const [aiDraftError, setAiDraftError] = useState<string | null>(null);"""

code = code.replace("  const [isSavingReview, setIsSavingReview] = useState(false);", state_addition)

# Reset AI states in handleSelectSubmissionForReview
reset_states = """    setReviewFeedback(sub.teacher_feedback || '');
    setReviewScore(sub.awarded_points || 0);
    setAiDraftResult(null);
    setAiDraftError(null);"""

code = code.replace("    setReviewFeedback(sub.teacher_feedback || '');\n    setReviewScore(sub.awarded_points || 0);", reset_states)

# Add handleGenerateAiDraft
handler = """  const handleGenerateAiDraft = async () => {
    if (!selectedSubmissionForReview) return;
    setIsGeneratingAiDraft(true);
    setAiDraftResult(null);
    setAiDraftError(null);
    try {
      const draft = await db.generateAIFeedbackDraft(selectedSubmissionForReview.id);
      setAiDraftResult(draft);
    } catch (err: any) {
      setAiDraftError(err.message || 'AI draft could not be generated right now. You can still write feedback manually.');
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };

  const handleSaveReview = async"""

code = code.replace("  const handleSaveReview = async", handler)

# Enable button and change rendering
button_search = """                                          <button
                                            type="button"
                                            disabled
                                            className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded flex items-center gap-1 opacity-60 cursor-not-allowed"
                                            title="AI Feedback (Coming Soon)"
                                          >
                                            <Sparkles size={10} />
                                            AI Draft
                                          </button>"""

button_replace = """                                          <button
                                            type="button"
                                            onClick={handleGenerateAiDraft}
                                            disabled={isGeneratingAiDraft || !sub.submission_text}
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-all ${isGeneratingAiDraft || !sub.submission_text ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 opacity-60 cursor-not-allowed' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500 hover:text-white'}`}
                                            title={!sub.submission_text ? "AI feedback is available for text submissions only." : "Generate AI Draft"}
                                          >
                                            {isGeneratingAiDraft ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                            {isGeneratingAiDraft ? "Generating..." : "AI Draft"}
                                          </button>"""

code = code.replace(button_search, button_replace)

panel_code = """                                      <div className="space-y-1.5 flex flex-col justify-between">
                                        <div>"""

panel_replace = """                                      {aiDraftResult && (
                                        <div className="sm:col-span-3 p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-3 animate-fade-in">
                                          <div className="flex items-center justify-between">
                                            <h5 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                              <Sparkles size={12} />
                                              AI Draft Panel (Teacher Only)
                                            </h5>
                                            <button
                                              type="button"
                                              onClick={() => setReviewFeedback(prev => prev ? prev + '\\n\\n' + aiDraftResult.suggested_teacher_feedback : aiDraftResult.suggested_teacher_feedback)}
                                              className="px-2.5 py-1 text-[10px] font-bold bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                                            >
                                              Insert into Feedback
                                            </button>
                                          </div>
                                          <div className="space-y-2 text-xs text-slate-300">
                                            {aiDraftResult.overall_summary && (
                                              <p><strong className="text-slate-200">Summary:</strong> {aiDraftResult.overall_summary}</p>
                                            )}
                                            {aiDraftResult.strengths?.length > 0 && (
                                              <div><strong className="text-slate-200">Strengths:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                            {aiDraftResult.areas_to_improve?.length > 0 && (
                                              <div><strong className="text-slate-200">Areas to Improve:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.areas_to_improve.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                            {aiDraftResult.suggested_teacher_feedback && (
                                              <div className="bg-slate-950 border border-slate-800 p-2 rounded text-slate-300 font-medium">
                                                <span className="block text-[10px] text-slate-500 mb-1">Suggested Feedback:</span>
                                                {aiDraftResult.suggested_teacher_feedback}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {aiDraftError && (
                                        <div className="sm:col-span-3 p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2 animate-fade-in">
                                          <AlertTriangle size={14} />
                                          {aiDraftError}
                                        </div>
                                      )}
                                      <div className="space-y-1.5 flex flex-col justify-between">
                                        <div>"""

code = code.replace(panel_code, panel_replace)

with open('src/components/ClassDetail.tsx', 'w') as f:
    f.write(code)

print("ClassDetail.tsx patched")
