import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InterviewQuestion = {
  id: string;
  prompt: string;
  rubric: string; // what a great answer covers
};

export type InterviewGrade = {
  perQuestion: { id: string; score: number; feedback: string }[];
  percent: number;
  overall: string; // 2-3 sentence closing remark from Jenny
  passed: boolean;
};

const NUM_Q = 6;
const PASS = 70;

const GEN_SYS = `You are Instructor Jenny, an upbeat Space Academy coding interviewer.
Generate a realistic technical job interview covering the ENTIRE 20-chapter curriculum for the given programming language.
The interview is spoken aloud (voice), so questions must be short, conversational, and clearly answerable in 20-90 seconds each.
Mix: fundamentals, syntax nuance, small "walk me through how you'd…" design questions, and one "explain this concept to a beginner" question.
NO code snippets — the cadet is speaking their answer, not typing.

Output STRICT JSON:
{"questions":[{"id":"q1","prompt":"...","rubric":"what a strong answer covers, 1-2 sentences"}]}
Exactly ${NUM_Q} questions.`;

const GRADE_SYS = `You are Instructor Jenny grading a spoken job interview.
For each question, score 0-100 based on correctness, clarity, and completeness relative to the rubric.
Be fair: partial credit is fine. Reward correct concepts even if the wording is casual. Penalize wrong or absent core content.
Then give a 2-3 sentence overall closing remark to the cadet (warm, honest, encouraging), and compute the average percent.

Output STRICT JSON:
{"perQuestion":[{"id":"q1","score":85,"feedback":"..."}],"percent":78,"overall":"..."}`;

async function callAI(system: string, user: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(s: string): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Invalid AI JSON");
    return JSON.parse(m[0]) as T;
  }
}

function localeLine(locale?: string) {
  return locale && locale.trim() && locale !== "English"
    ? `\nWrite ALL text (prompts, rubrics, feedback, closing remark) in ${locale}. Keep programming keywords and identifiers in English.`
    : "";
}

export const generateInterviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { language: string; locale?: string }) => d)
  .handler(async ({ data }) => {
    const content = await callAI(
      GEN_SYS + localeLine(data.locale),
      `Language: ${data.language}\nGenerate the final graduation interview now. JSON only.`,
    );
    const parsed = parseJson<{ questions?: unknown }>(content);
    const raw = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions: InterviewQuestion[] = raw
      .map((q, i) => {
        const item = q as Partial<InterviewQuestion>;
        if (!item || typeof item.prompt !== "string") return null;
        return {
          id: item.id ?? `q${i + 1}`,
          prompt: item.prompt,
          rubric: typeof item.rubric === "string" ? item.rubric : "",
        };
      })
      .filter((q): q is InterviewQuestion => q !== null)
      .slice(0, NUM_Q);
    if (questions.length < 3) throw new Error("Interview generator returned too few questions.");
    return { questions };
  });

export const gradeInterviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      language: string;
      locale?: string;
      questions: InterviewQuestion[];
      answers: { id: string; transcript: string }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = data.questions
      .map((q) => {
        const a = data.answers.find((x) => x.id === q.id)?.transcript ?? "(no answer)";
        return `Q ${q.id}: ${q.prompt}\nRubric: ${q.rubric}\nCadet's spoken answer: ${a}`;
      })
      .join("\n\n---\n\n");

    const content = await callAI(
      GRADE_SYS + localeLine(data.locale),
      `Language: ${data.language}\nGrade this interview. JSON only.\n\n${payload}`,
    );
    const parsed = parseJson<Partial<InterviewGrade>>(content);
    const per = Array.isArray(parsed.perQuestion) ? parsed.perQuestion : [];
    const normalized = per.map((p) => ({
      id: String(p.id ?? ""),
      score: Math.max(0, Math.min(100, Math.round(Number(p.score) || 0))),
      feedback: String(p.feedback ?? ""),
    }));
    const percent =
      typeof parsed.percent === "number"
        ? Math.max(0, Math.min(100, Math.round(parsed.percent)))
        : Math.round(
            normalized.reduce((s, p) => s + p.score, 0) / Math.max(1, normalized.length),
          );
    const overall = String(parsed.overall ?? "").slice(0, 800);
    const passed = percent >= PASS;

    // Persist as chapter=0 sentinel = graduation attempt
    const { error } = await context.supabase.from("quiz_attempts").insert({
      user_id: context.userId,
      language: data.language,
      chapter: 0,
      score: Math.round((percent / 100) * data.questions.length),
      total: data.questions.length,
      percent,
    });
    if (error) throw new Error(error.message);

    return { perQuestion: normalized, percent, overall, passed } satisfies InterviewGrade;
  });
