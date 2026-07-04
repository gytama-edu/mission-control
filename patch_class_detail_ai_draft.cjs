const fs = require('fs');

let content = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

// 1. Update the AI Draft Panel to include ALL structured fields
const panelTarget = `                                          <div className="space-y-2 text-xs text-slate-300">
                                            {aiDraftResult.overall_summary && (
                                              <p><strong className="text-slate-200">Summary:</strong> {aiDraftResult.overall_summary}</p>
                                            )}
                                            {aiDraftResult.strengths?.length > 0 && (
                                              <div><strong className="text-slate-200">Strengths:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                            {aiDraftResult.areas_to_improve?.length > 0 && (
                                              <div><strong className="text-slate-200">Areas to Improve:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.areas_to_improve.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                          </div>`;

const newPanel = `                                          <div className="space-y-2 text-xs text-slate-300">
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
                                              <div><strong className="text-slate-200">Corrected Examples:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.corrected_examples.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                            {aiDraftResult.suggested_next_steps?.length > 0 && (
                                              <div><strong className="text-slate-200">Suggested Next Steps:</strong><ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400">{aiDraftResult.suggested_next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            )}
                                          </div>`;

content = content.replace(panelTarget, newPanel);

// 2. Add debug logging to handleGenerateAiDraft and fix condition
const handlerTarget = `  const handleGenerateAiDraft = async () => {
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
  };`;

const newHandler = `  const handleGenerateAiDraft = async () => {
    if (!selectedSubmissionForReview) return;
    console.log('[DEBUG] Generating AI draft for submission:', selectedSubmissionForReview.id);
    setIsGeneratingAiDraft(true);
    setAiDraftResult(null);
    setAiDraftError(null);
    try {
      const draft = await db.generateAIFeedbackDraft(selectedSubmissionForReview.id);
      console.log('[DEBUG] AI draft received:', draft);
      setAiDraftResult(draft);
    } catch (err: any) {
      console.error('[DEBUG] AI draft error:', err);
      setAiDraftError(err.message || 'AI draft could not be generated right now. You can still write feedback manually.');
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };`;

content = content.replace(handlerTarget, newHandler);

// 3. Make the condition safer
const buttonTarget = `                                            disabled={isGeneratingAiDraft || !sub.submission_text}`;
const newButtonTarget = `                                            disabled={isGeneratingAiDraft || !sub.submission_text || sub.submission_text.trim().length === 0}`;

// NOTE: We need to replace all instances of this exact string in the button definition
content = content.replaceAll(
  `disabled={isGeneratingAiDraft || !sub.submission_text}`,
  `disabled={isGeneratingAiDraft || !sub.submission_text || sub.submission_text.trim().length === 0}`
);

content = content.replaceAll(
  `isGeneratingAiDraft || !sub.submission_text ?`,
  `isGeneratingAiDraft || !sub.submission_text || sub.submission_text.trim().length === 0 ?`
);

content = content.replaceAll(
  `title={!sub.submission_text ? "AI feedback is available for text submissions only." : "Generate AI Draft"}`,
  `title={(!sub.submission_text || sub.submission_text.trim().length === 0) ? "AI feedback is available for text submissions only." : "Generate AI Draft"}`
);

fs.writeFileSync('src/components/ClassDetail.tsx', content, 'utf8');
console.log('ClassDetail patched successfully');
