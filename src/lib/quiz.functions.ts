import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: string[]; // exactly 4
  answerIndex: number; // 0..3
  explanation: string;
};

type GenInput = { language: string; chapter: number; chapterTitle: string; chapterObjective: string; locale?: string };
type SubmitInput = {
  language: string;
  chapter: number;
  total: number;
  answers: { questionId: string; correct: boolean }[];
};

const SYSTEM = `You are an exam author for a Microsoft-certification-style multiple-choice assessment.
Write 10 rigorous but fair questions for the given programming language chapter.

Rules:
- Exactly 10 questions.
- Each question has exactly 4 answer choices.
- Exactly ONE choice is correct.
- Mix conceptual, syntax, and short "what does this code output" style questions.
- Keep code snippets short (<= 6 lines) and use fenced code inside "prompt" when needed.
- Include a 1-2 sentence "explanation" of the correct answer.
- Output STRICT JSON only, matching this schema:

{
  "questions": [
    {
      "id": "q1",
      "prompt": "…",
      "choices": ["A", "B", "C", "D"],
      "answerIndex": 0,
      "explanation": "…"
    }
  ]
}`;

export const generateQuizFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: GenInput) => d)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const user = `Language: ${data.language}
Chapter ${data.chapter}: ${data.chapterTitle}
Learning objective: ${data.chapterObjective}
${data.locale && data.locale !== "English" ? `Write all question text, choices and explanations in ${data.locale} (keep code and identifiers in the original programming language).` : ""}

Write the 10-question certification quiz now. JSON only.`;


    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Quiz gen ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: { questions?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }
    const raw = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions: QuizQuestion[] = raw
      .map((q, i) => {
        const item = q as Partial<QuizQuestion>;
        if (
          !item ||
          typeof item.prompt !== "string" ||
          !Array.isArray(item.choices) ||
          item.choices.length !== 4 ||
          typeof item.answerIndex !== "number"
        ) {
          return null;
        }
        return {
          id: item.id ?? `q${i + 1}`,
          prompt: item.prompt,
          choices: item.choices.map((c) => String(c)),
          answerIndex: Math.max(0, Math.min(3, item.answerIndex)),
          explanation: typeof item.explanation === "string" ? item.explanation : "",
        };
      })
      .filter((q): q is QuizQuestion => q !== null)
      .slice(0, 10);

    if (questions.length < 4) throw new Error("Quiz generator returned too few questions. Try again.");
    return { questions };
  });

export const submitQuizFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SubmitInput) => d)
  .handler(async ({ data, context }) => {
    const score = data.answers.filter((a) => a.correct).length;
    const total = Math.max(1, data.total);
    const percent = Math.round((score / total) * 100);

    const { error } = await context.supabase.from("quiz_attempts").insert({
      user_id: context.userId,
      language: data.language,
      chapter: data.chapter,
      score,
      total,
      percent,
    });
    if (error) throw new Error(error.message);
    return { score, total, percent };
  });
