const fs = require('fs');
let content = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const target = `  const handleGenerateAiDraft = async () => {
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

const replacement = `  const handleGenerateAiDraft = async () => {
    const submissionId = selectedSubmissionForReview?.id || selectedSubmissionForReview?.submission_id;
    if (!submissionId) {
      setAiDraftError("Submission ID was not found for this review.");
      return;
    }

    console.log('[DEBUG] Generating AI draft for submission:', submissionId);
    setIsGeneratingAiDraft(true);
    setAiDraftResult(null);
    setAiDraftError(null);
    try {
      const draft = await db.generateAIFeedbackDraft(submissionId);
      console.log('[DEBUG] AI draft received:', draft);
      setAiDraftResult(draft);
    } catch (err: any) {
      console.error('[DEBUG] AI draft error:', err);
      setAiDraftError(err.message || 'AI draft could not be generated right now. You can still write feedback manually.');
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/ClassDetail.tsx', content);
