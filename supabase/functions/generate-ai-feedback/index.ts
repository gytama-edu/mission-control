import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getTextSubmission(submission: Record<string, unknown>): string {
  const possibleFields = [
    "content",
    "text",
    "answer",
    "response",
    "body",
    "submission_text",
    "text_response",
    "student_response",
  ];

  for (const field of possibleFields) {
    const value = submission[field];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return "";
}

function safeString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function cleanJsonText(text: string): string {
  let cleaned = text.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/i, "").trim();
  }

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/i, "").trim();
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3).trim();
  }

  return cleaned;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Supabase server environment is not configured." },
        500,
      );
    }

    if (!geminiApiKey) {
      return jsonResponse(
        { error: "AI feedback is not configured yet. Missing GEMINI_API_KEY." },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader) {
      return jsonResponse({ error: "Authentication is required." }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Invalid or expired teacher session." }, 401);
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const submissionId = safeString((body as Record<string, unknown>).submissionId);

    if (!submissionId) {
      return jsonResponse({ error: "Missing submissionId." }, 400);
    }

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (submissionError || !submission) {
      return jsonResponse({ error: "Submission was not found." }, 404);
    }

    const submissionRecord = submission as Record<string, unknown>;

    const taskId =
      safeString(submissionRecord.task_id) ||
      safeString(submissionRecord.taskId);

    const studentId =
      safeString(submissionRecord.student_id) ||
      safeString(submissionRecord.studentId);

    if (!taskId) {
      return jsonResponse({ error: "Submission is missing task information." }, 400);
    }

    if (!studentId) {
      return jsonResponse({ error: "Submission is missing student information." }, 400);
    }

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return jsonResponse({ error: "Related task was not found." }, 404);
    }

    const taskRecord = task as Record<string, unknown>;

    const classId =
      safeString(taskRecord.class_id) ||
      safeString(taskRecord.classId) ||
      safeString(submissionRecord.class_id) ||
      safeString(submissionRecord.classId);

    if (!classId) {
      return jsonResponse({ error: "Task is missing class information." }, 400);
    }

    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("*")
      .eq("id", classId)
      .single();

    if (classError || !classData) {
      return jsonResponse({ error: "Class was not found." }, 404);
    }

    const classRecord = classData as Record<string, unknown>;

    const teacherId =
      safeString(classRecord.teacher_id) ||
      safeString(classRecord.teacherId) ||
      safeString(classRecord.user_id) ||
      safeString(classRecord.userId) ||
      safeString(classRecord.owner_id) ||
      safeString(classRecord.ownerId);

    if (!teacherId) {
      return jsonResponse(
        { error: "Class ownership information is missing." },
        500,
      );
    }

    if (teacherId !== user.id) {
      return jsonResponse(
        { error: "You are not authorized to generate feedback for this submission." },
        403,
      );
    }

    const submissionText = getTextSubmission(submissionRecord);

    if (!submissionText) {
      return jsonResponse(
        { error: "AI feedback is currently available for text submissions only." },
        400,
      );
    }

    const taskTitle =
      safeString(taskRecord.title) ||
      safeString(taskRecord.name) ||
      "Student submission";

    const taskDescription =
      safeString(taskRecord.description) ||
      safeString(taskRecord.instructions) ||
      safeString(taskRecord.prompt) ||
      "";

    const level =
      safeString(classRecord.level) ||
      safeString(classRecord.grade) ||
      safeString(classRecord.class_level) ||
      "";

    const prompt =
      "You are an English teacher assistant helping a teacher write feedback for a student submission.\n\n" +
      "Important rules:\n" +
      "- Do not grade the work.\n" +
      "- Do not assign points.\n" +
      "- Do not change task status.\n" +
      "- Do not accuse the student of cheating.\n" +
      "- Do not mention AI detection.\n" +
      "- Keep feedback supportive, clear, and teacher-editable.\n" +
      "- Focus on English learning: clarity, grammar, vocabulary, organization, and next steps.\n" +
      "- Return valid JSON only.\n\n" +
      "Return this exact JSON shape:\n" +
      "{\n" +
      '  "overall_summary": "string",\n' +
      '  "strengths": ["string"],\n' +
      '  "areas_to_improve": ["string"],\n' +
      '  "grammar_notes": ["string"],\n' +
      '  "vocabulary_notes": ["string"],\n' +
      '  "corrected_examples": [\n' +
      '    {\n' +
      '      "original": "string",\n' +
      '      "suggested": "string",\n' +
      '      "explanation": "string"\n' +
      "    }\n" +
      "  ],\n" +
      '  "suggested_teacher_feedback": "string",\n' +
      '  "suggested_next_steps": ["string"]\n' +
      "}\n\n" +
      "Task title:\n" +
      taskTitle +
      "\n\n" +
      "Task instructions:\n" +
      taskDescription +
      "\n\n" +
      "Class or student level:\n" +
      level +
      "\n\n" +
      "Student submission:\n" +
      submissionText;

    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(geminiApiKey);

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!aiResponse.ok) {
      const providerText = await aiResponse.text().catch(() => "");
      console.error("Gemini API error status:", aiResponse.status);
      console.error("Gemini API error body:", providerText.slice(0, 500));

      return jsonResponse(
        { error: "AI feedback could not be generated right now." },
        502,
      );
    }

    const aiJson = await aiResponse.json();

    const aiText =
      aiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText || typeof aiText !== "string") {
      return jsonResponse(
        { error: "AI feedback response was empty or invalid." },
        502,
      );
    }

    let parsedDraft: unknown;

    try {
      parsedDraft = JSON.parse(cleanJsonText(aiText));
    } catch (_error) {
      console.error("Failed to parse AI JSON output:", aiText.slice(0, 500));

      return jsonResponse(
        { error: "AI feedback response could not be parsed." },
        502,
      );
    }

    return jsonResponse(
      {
        status: "completed",
        draft: parsedDraft,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Edge Function Error:", message);

    return jsonResponse(
      { error: "AI feedback could not be generated right now." },
      500,
    );
  }
});
