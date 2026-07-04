const fs = require('fs');

let code = fs.readFileSync('src/services/missionControlData.ts', 'utf8');

const serviceCode = `

export const generateAIFeedbackDraft = async (submissionId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-ai-feedback', {
      body: { submission_id: submissionId }
    });

    if (error) {
      console.error('Edge function invocation error:', error);
      throw error;
    }

    if (data && data.error) {
       throw new Error(data.error);
    }

    return data.draft;
  } catch (error: any) {
    console.error('generateAIFeedbackDraft error:', error);
    throw error;
  }
};
`;

if (!code.includes('generateAIFeedbackDraft')) {
  code += serviceCode;
  fs.writeFileSync('src/services/missionControlData.ts', code);
  console.log('missionControlData.ts patched');
} else {
  console.log('generateAIFeedbackDraft already exists');
}
