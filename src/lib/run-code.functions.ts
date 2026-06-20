import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  language: z.string().min(1),
  source: z.string(),
  stdin: z.string().optional().default(""),
});

export type RunCodeResult = {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
};

export const runCodeFn = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<RunCodeResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const system = `You are a deterministic code execution sandbox. Given a program in a specified language and an optional stdin, simulate running it and return ONLY a strict JSON object with these exact keys:
{"stdout": string, "stderr": string, "exit_code": number}

Rules:
- stdout: exactly what the program would print to standard output, byte-for-byte (preserve newlines, spacing). Empty string if nothing.
- stderr: compiler errors, runtime exceptions, or warnings the program would emit. Empty string if none.
- exit_code: 0 on success, non-zero on compile/runtime error (typically 1).
- Do NOT include explanations, markdown, code fences, or any text outside the JSON object.
- Do not invent output. If the program is non-deterministic (e.g. random, time), pick a single plausible run.
- If the code is malformed or won't compile, put the realistic compiler/interpreter error in stderr and set a non-zero exit_code with empty stdout.`;

    const user = `Language: ${data.language}
STDIN:
${data.stdin || "(none)"}

SOURCE:
\`\`\`
${data.source}
\`\`\`

Return only the JSON object.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Rate limit hit. Please retry in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace billing.");
      throw new Error(`Gemini error ${res.status}: ${txt.slice(0, 300)}`);
    }

    const j = await res.json();
    const content: string = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { stdout?: string; stderr?: string; exit_code?: number };
    try {
      parsed = JSON.parse(content);
    } catch {
      // Strip code fences if model added them despite instructions
      const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      parsed = JSON.parse(cleaned);
    }

    const stdout = parsed.stdout ?? "";
    const stderr = parsed.stderr ?? "";
    const code = typeof parsed.exit_code === "number" ? parsed.exit_code : 0;
    return {
      stdout,
      stderr,
      output: stdout + (stderr ? `\n${stderr}` : ""),
      code,
      signal: null,
    };
  });
