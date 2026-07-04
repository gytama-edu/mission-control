import os

function_dir = 'supabase/functions/generate-ai-feedback'
os.makedirs(function_dir, exist_ok=True)

code = """import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !geminiApiKey) {
      throw new Error('Server configuration error: Missing environment variables.');
    }

    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Please log in first' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: 'Bad Request: submission_id is required' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: submissionData, error: subError } = await supabaseClient
      .from('task_submissions')
      .select('id, submission_text, task_id, class_id, student_id')
      .eq('id', submission_id)
      .single();

    if (subError || !submissionData) {
      console.error('Submission fetch error:', subError);
      return new Response(JSON.stringify({ error: 'submission_not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: classData, error: classError } = await supabaseClient
      .from('classes')
      .select('id, teacher_id')
      .eq('id', submissionData.class_id)
      .single();

    if (classError || !classData) {
      console.error('Class fetch error:', classError);
      return new Response(JSON.stringify({ error: 'class_not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (classData.teacher_id !== user.id) {
       return new Response(JSON.stringify({ error: 'submission_not_owned_by_teacher' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: taskData } = await supabaseClient
      .from('tasks')
      .select('title, description')
      .eq('id', submissionData.task_id)
      .single();

    const taskTitle = taskData?.title || 'Unknown Task';
    const taskDescription = taskData?.description || 'No description provided';
    const content = submissionData.submission_text || '';

    if (!content || content.trim().length === 0) {
       return new Response(JSON.stringify({
         status: 'unsupported_submission_type',
         error: 'AI feedback is currently available for text submissions only.'
       }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an AI teaching assistant.
Your job is to generate a helpful, constructive, and supportive draft feedback for a student's text submission.
You must NOT grade the student. You must NOT accuse the student of cheating. You must NOT be harsh.
Provide clear feedback that a teacher can edit before saving.

Output valid JSON matching this schema:
{
  "overall_summary": "Encouraging short summary",
  "strengths": ["string"],
  "areas_to_improve": ["string"],
  "grammar_notes": ["string"],
  "vocabulary_notes": ["string"],
  "corrected_examples": [
    {
      "original": "string",
      "suggested": "string",
      "explanation": "string"
    }
  ],
  "suggested_teacher_feedback": "Draft paragraph the teacher can copy/paste and edit.",
  "suggested_next_steps": ["string"]
}
`;

    const userPrompt = `Task Context:
Title: ${taskTitle}
Description: ${taskDescription}

Student Submission:
===BEGIN===
${content}
===END===
`;

    const geminiUrl = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${geminiApiKey}\`;
    const geminiBody = {
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\\n\\n' + userPrompt }] }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3
      }
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    });

    if (!geminiResponse.ok) {
      console.error('Gemini error:', await geminiResponse.text());
      throw new Error('Failed to generate AI feedback.');
    }

    const geminiData = await geminiResponse.json();
    const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
       throw new Error('Empty response from AI provider.');
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(resultText);
    } catch (err) {
      console.error("Failed to parse AI output:", resultText);
      throw new Error('AI provider returned invalid JSON format.');
    }

    const finalResponse = {
      status: "completed",
      draft: parsedResult
    };

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Edge Function Error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
"""

with open(f"{function_dir}/index.ts", "w") as f:
    f.write(code)

print("Edge function created")
