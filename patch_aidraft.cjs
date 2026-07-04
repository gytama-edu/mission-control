const fs = require('fs');
let content = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

// Add a state for AI draft success message
const stateAnchor = `const [aiDraftError, setAiDraftError] = useState<string | null>(null);`;
if (content.includes(stateAnchor) && !content.includes('aiDraftSuccessMessage')) {
    content = content.replace(stateAnchor, stateAnchor + '\n  const [aiDraftSuccessMessage, setAiDraftSuccessMessage] = useState<string | null>(null);');
}

// Reset aiDraftSuccessMessage inside handleSelectSubmissionForReview
const handleSelectAnchor = `setAiDraftError(null);
    setReviewSuccessMessage(null);`;
if (content.includes(handleSelectAnchor) && !content.includes('setAiDraftSuccessMessage(null)')) {
    content = content.replace(handleSelectAnchor, handleSelectAnchor + '\n    setAiDraftSuccessMessage(null);');
}

// Inside handleGenerateAiDraft, reset it
const handleGenerateAnchor = `setIsGeneratingAiDraft(true);
    setAiDraftResult(null);
    setAiDraftError(null);`;
if (content.includes(handleGenerateAnchor) && !content.includes('setAiDraftSuccessMessage(null)')) {
    content = content.replace(handleGenerateAnchor, handleGenerateAnchor + '\n    setAiDraftSuccessMessage(null);');
}

// Now replace the AI Draft Panel UI
const uiAnchor = `{aiDraftResult && (
                                        <div className="sm:col-span-3 p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-3 animate-fade-in">`;
const uiReplacement = `{aiDraftResult && (
                                        <div className="sm:col-span-3 p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-3 animate-fade-in">
                                          <div className="flex items-center justify-between">
                                            <h5 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                              <Sparkles size={12} />
                                              AI Draft Panel (Teacher Only)
                                              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 ml-2">Review before saving</span>
                                            </h5>
                                            <button
                                              type="button"
                                              onClick={handleGenerateAiDraft}
                                              disabled={isGeneratingAiDraft}
                                              className="px-2.5 py-1 text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 rounded hover:bg-slate-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                                            >
                                              {isGeneratingAiDraft ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                              Regenerate Draft
                                            </button>
                                          </div>
                                          <div className="space-y-3 text-xs text-slate-300 bg-slate-950/50 p-3 rounded-lg border border-indigo-500/10">
                                            {aiDraftResult.overall_summary && (
                                              <p><strong className="text-slate-200">Summary:</strong> {aiDraftResult.overall_summary}</p>
                                            )}
                                            {aiDraftResult.strengths?.length > 0 && (
                                              <div><strong className="text-slate-200">Strengths:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                            {aiDraftResult.areas_to_improve?.length > 0 && (
                                              <div><strong className="text-slate-200">Areas to Improve:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.areas_to_improve.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                            {aiDraftResult.grammar_notes?.length > 0 && (
                                              <div><strong className="text-slate-200">Grammar Notes:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.grammar_notes.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                            {aiDraftResult.vocabulary_notes?.length > 0 && (
                                              <div><strong className="text-slate-200">Vocabulary Notes:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.vocabulary_notes.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                            {aiDraftResult.corrected_examples?.length > 0 && (
                                              <div>
                                                <strong className="text-slate-200">Corrected Examples:</strong>
                                                <div className="space-y-2 mt-1">
                                                  {aiDraftResult.corrected_examples.map((ex: any, i: number) => (
                                                    <div key={i} className="bg-slate-900 border border-slate-800 p-2 rounded text-[11px]">
                                                      <p className="text-rose-400 line-through mb-0.5">{ex.original}</p>
                                                      <p className="text-emerald-400 mb-1">{ex.suggested}</p>
                                                      <p className="text-slate-500 italic">{ex.explanation}</p>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {aiDraftResult.suggested_next_steps?.length > 0 && (
                                              <div><strong className="text-slate-200">Suggested Next Steps:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.suggested_next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                            {aiDraftResult.suggested_teacher_feedback && (
                                              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded text-slate-300 font-medium">
                                                <span className="block text-[10px] text-slate-500 mb-1">Suggested Feedback (to student):</span>
                                                {aiDraftResult.suggested_teacher_feedback}
                                              </div>
                                            )}
                                          </div>

                                          <div className="flex items-center justify-between pt-2 border-t border-indigo-500/20">
                                            <div className="flex items-center gap-2">
                                              {!reviewFeedback || reviewFeedback.trim() === '' ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setReviewFeedback(aiDraftResult.suggested_teacher_feedback || '');
                                                    setAiDraftSuccessMessage('Draft inserted into feedback.');
                                                    setTimeout(() => setAiDraftSuccessMessage(null), 3000);
                                                  }}
                                                  className="px-3 py-1.5 text-xs font-bold bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors flex items-center gap-1.5"
                                                >
                                                  <Copy size={12} />
                                                  Insert into Feedback
                                                </button>
                                              ) : (
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[10px] text-indigo-300 font-medium">Feedback not empty:</span>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setReviewFeedback(prev => prev + '\\n\\n' + (aiDraftResult.suggested_teacher_feedback || ''));
                                                      setAiDraftSuccessMessage('Draft appended to feedback.');
                                                      setTimeout(() => setAiDraftSuccessMessage(null), 3000);
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-bold bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors flex items-center gap-1.5"
                                                  >
                                                    <Plus size={12} /> Append Draft
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setReviewFeedback(aiDraftResult.suggested_teacher_feedback || '');
                                                      setAiDraftSuccessMessage('Feedback replaced with draft.');
                                                      setTimeout(() => setAiDraftSuccessMessage(null), 3000);
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 rounded hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                                                  >
                                                    <RefreshCw size={12} /> Replace Feedback
                                                  </button>
                                                </div>
                                              )}
                                              {aiDraftSuccessMessage && (
                                                <span className="text-[10px] text-emerald-400 flex items-center gap-1 animate-fade-in ml-2 font-medium">
                                                  <CheckSquare size={12} /> {aiDraftSuccessMessage}
                                                </span>
                                              )}
                                            </div>
                                            
                                            {/* Insert Full Draft Button */}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                let fullDraft = '';
                                                if (aiDraftResult.overall_summary) fullDraft += \`Summary:\\n\${aiDraftResult.overall_summary}\\n\\n\`;
                                                if (aiDraftResult.strengths?.length > 0) fullDraft += \`Strengths:\\n- \${aiDraftResult.strengths.join('\\n- ')}\\n\\n\`;
                                                if (aiDraftResult.areas_to_improve?.length > 0) fullDraft += \`Areas to Improve:\\n- \${aiDraftResult.areas_to_improve.join('\\n- ')}\\n\\n\`;
                                                if (aiDraftResult.suggested_teacher_feedback) fullDraft += \`Feedback:\\n\${aiDraftResult.suggested_teacher_feedback}\\n\\n\`;
                                                if (aiDraftResult.suggested_next_steps?.length > 0) fullDraft += \`Next Steps:\\n- \${aiDraftResult.suggested_next_steps.join('\\n- ')}\`;
                                                
                                                if (!reviewFeedback || reviewFeedback.trim() === '') {
                                                  setReviewFeedback(fullDraft.trim());
                                                } else {
                                                  setReviewFeedback(prev => prev + '\\n\\n' + fullDraft.trim());
                                                }
                                                setAiDraftSuccessMessage('Full structured draft inserted.');
                                                setTimeout(() => setAiDraftSuccessMessage(null), 3000);
                                              }}
                                              className="px-2.5 py-1 text-[10px] font-bold bg-slate-800/50 text-indigo-300 border border-indigo-500/20 rounded hover:bg-indigo-500/10 transition-colors"
                                            >
                                              Insert Full Draft
                                            </button>
                                          </div>
                                        </div>
`;

// Replace until the closing of the aiDraftResult block
const parts = content.split(uiAnchor);
if (parts.length > 1) {
    const endBlockStr = `                                      )}
                                      {aiDraftError && (`;
    const afterStart = parts[1];
    const blockEndIdx = afterStart.indexOf(endBlockStr);
    
    if (blockEndIdx !== -1) {
        content = parts[0] + uiReplacement + endBlockStr + afterStart.substring(blockEndIdx + endBlockStr.length);
    }
}

fs.writeFileSync('src/components/ClassDetail.tsx', content);
console.log('patched successfully');
