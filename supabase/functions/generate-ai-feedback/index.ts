import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, any>;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function safeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function firstString(record: JsonRecord, fields: string[]): string {
  for (const field of fields) {
    const value = record[field];
    const text = safeString(value);
    if (text) return text;
  }

  return "";
}

function getTextFromNested(value: unknown, depth = 0): string {
  if (depth > 2) return "";

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = getTextFromNested(item, depth + 1);
      if (found) return found;
    }

    return "";
  }

  const record = value as JsonRecord;

  const directText = firstString(record, [
    "content",
    "text",
    "answer",
    "response",
    "body",
    "submission",
    "submission_text",
    "text_response",
    "student_response",
    "response_text",
    "answer_text",
    "submitted_text",
    "written_response",
    "student_answer",
    "text_content",
    "content_text",
    "submission_content",
    "work_text",
    "student_work",
    "value",
  ]);

  if (directText) return directText;

  for (const key of Object.keys(record)) {
    const found = getTextFromNested(record[key], depth + 1);
    if (found) return found;
  }

  return "";
}

function getTextSubmission(submission: JsonRecord): string {
  const directText = firstString(submission, [
    "content",
    "text",
    "answer",
    "response",
    "body",
    "submission",
    "submission_text",
    "text_response",
    "student_response",
    "response_text",
    "answer_text",
    "submitted_text",
    "written_response",
    "student_answer",
    "text_content",
    "content_text",
    "submission_content",
    "work_text",
    "student_work",
  ]);

  if (directText) return directText;

  const nestedContainers = [
    "data",
    "payload",
    "metadata",
    "answers",
    "responses",
    "submission_data",
    "form_data",
    "content_json",
    "response_json",
  ];

  for (const field of nestedContainers) {
    const found = getTextFromNested(submission[field]);
    if (found) return found;
  }

  return "";
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

function normalizeDraft(value: any) {
  return {
    overall_summary: safeString(value?.overall_summary),
    strengths: Array.isArray(value?.strengths) ? value.strengths.map(safeString).filter(Boolean) : [],
    areas_to_improve: Array.isArray(value?.areas_to_improve)
      ? value.areas_to_improve.map(safeString).filter(Boolean)
      : [],
    grammar_notes: Array.isArray(value?.grammar_notes)
      ? value.grammar_notes.map(safeString).filter(Boolean)
      : [],
    vocabulary_notes: Array.isArray(value?.vocabulary_notes)
      ? value.vocabulary_notes.map(safeString).filter(Boolean)
      : [],
    corrected_examples: Array.isArray(value?.corrected_examples)
      ? value.corrected_examples.map((item: any) => ({
          original: safeString(item?.original),
          suggested: safeString(item?.suggested),
          explanation: safeString(item?.explanation),
        }))
      : [],
    suggested_teacher_feedback: safeString(value?.suggested_teacher_feedback),
    suggested_next_steps: Array.isArray(value?.suggested_next_steps)
      ? value.suggested_next_steps.map(safeString).filter(Boolean)
      : [],
  };
}

Deno.serve(async (req: Request) => {
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
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return jsonResponse({ error: "Authentication is required." }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Invalid or expired teacher session." }, 401);
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const bodyRecord = body as JsonRecord;

    const submissionId =
      safeString(bodyRecord.submissionId) ||
      safeString(bodyRecord.taskSubmissionId) ||
      safeString(bodyRecord.submission_id) ||
      safeString(bodyRecord.task_submission_id);

    if (!submissionId) {
      return jsonResponse({ error: "Missing submissionId." }, 400);
    }

    console.log("AI feedback request received.");
    console.log("Submission ID received:", submissionId);
    console.log("Authenticated teacher:", user.id);

    let submission: JsonRecord | null = null;

    const taskSubmissionResult = await supabaseAdmin
      .from("task_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    if (taskSubmissionResult.error) {
      console.log("task_submissions lookup error:", taskSubmissionResult.error.message);
    }

    if (taskSubmissionResult.data) {
      submission = taskSubmissionResult.data as JsonRecord;
      console.log("Submission loaded from task_submissions.");
    }

    if (!submission) {
      const legacySubmissionResult = await supabaseAdmin
        .from("submissions")
        .select("*")
        .eq("id", submissionId)
        .maybeSingle();

      if (legacySubmissionResult.error) {
        console.log("legacy submissions lookup error:", legacySubmissionResult.error.message);
      }

      if (legacySubmissionResult.data) {
        submission = legacySubmissionResult.data as JsonRecord;
        console.log("Submission loaded from legacy submissions table.");
      }
    }

    if (!submission) {
      return jsonResponse({ error: "Submission was not found." }, 404);
    }

    console.log("Submission keys:", Object.keys(submission));

    const taskId = firstString(submission, [
      "task_id",
      "taskId",
      "assignment_id",
      "assignmentId",
      "mission_task_id",
      "missionTaskId",
    ]);

    const studentId = firstString(submission, [
      "student_id",
      "studentId",
      "learner_id",
      "learnerId",
      "profile_id",
      "profileId",
    ]);

    console.log("Detected task ID:", taskId ? "yes" : "no");
    console.log("Detected student ID:", studentId ? "yes" : "no");

    if (!taskId) {
      return jsonResponse({ error: "Submission task link was not found." }, 400);
    }

    if (!studentId) {
      return jsonResponse({ error: "Submission student link was not found." }, 400);
    }

    const taskResult = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (taskResult.error || !taskResult.data) {
      console.log("Task lookup error:", taskResult.error?.message || "Task missing.");
      return jsonResponse({ error: "Related task was not found." }, 404);
    }

    const task = taskResult.data as JsonRecord;
    console.log("Task loaded.");

    let student: JsonRecord | null = null;

    const studentResult = await supabaseAdmin
      .from("students")
      .select("*")
      .eq("id", studentId)
      .maybeSingle();

    if (studentResult.error) {
      console.log("Student lookup error:", studentResult.error.message);
    }

    if (studentResult.data) {
      student = studentResult.data as JsonRecord;
      console.log("Student loaded.");
    }

    const classId =
      firstString(task, [
        "class_id",
        "classId",
        "course_id",
        "courseId",
      ]) ||
      firstString(submission, [
        "class_id",
        "classId",
        "course_id",
        "courseId",
      ]) ||
      firstString(student || {}, [
        "class_id",
        "classId",
        "course_id",
        "courseId",
      ]);

    console.log("Detected class ID:", classId ? "yes" : "no");

    if (!classId) {
      return jsonResponse({ error: "Task class link was not found." }, 400);
    }

    const classResult = await supabaseAdmin
      .from("classes")
      .select("*")
      .eq("id", classId)
      .maybeSingle();

    if (classResult.error || !classResult.data) {
      console.log("Class lookup error:", classResult.error?.message || "Class missing.");
      return jsonResponse({ error: "Class was not found." }, 404);
    }

    const classData = classResult.data as JsonRecord;
    console.log("Class loaded.");
    console.log("Class keys:", Object.keys(classData));

    const teacherId = firstString(classData, [
      "teacher_id",
      "teacherId",
      "user_id",
      "userId",
      "owner_id",
      "ownerId",
      "created_by",
      "createdBy",
    ]);

    console.log("Detected class owner:", teacherId ? "yes" : "no");

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

    console.log("Ownership check passed.");

    const submissionText = getTextSubmission(submission);
    console.log("Detected submission text:", submissionText ? "yes" : "no");

    if (!submissionText) {
      return jsonResponse(
        { error: "Submission text was not found in the current submission format." },
        400,
      );
    }

    const taskTitle =
      firstString(task, ["title", "name", "task_title", "taskTitle"]) ||
      "Student submission";

    const taskDescription =
      firstString(task, [
        "description",
        "instructions",
        "prompt",
        "task_description",
        "taskDescription",
      ]) || "";

    const level =
      firstString(classData, [
        "level",
        "grade",
        "class_level",
        "classLevel",
      ]) || "";

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
      "    {\n" +
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

    console.log("Sending request to Gemini.");

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

    const aiText = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

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

    console.log("AI feedback draft generated successfully.");

    return jsonResponse(
      {
        status: "completed",
        draft: normalizeDraft(parsedDraft),
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
