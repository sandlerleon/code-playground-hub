import { createServerFn } from "@tanstack/react-start";

type Input = {
  targetLanguage: string;
  items: { title: string; objective: string }[];
};

export type TranslatedChapter = { title: string; objective: string };

export const translateCurriculumFn = createServerFn({ method: "POST" })
  .inputValidator((d: Input) => d)
  .handler(async ({ data }) => {
    if (!data.targetLanguage || data.targetLanguage === "English") {
      return { items: data.items };
    }
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Translate programming-course chapter titles and objectives. Keep programming keywords/identifiers in English. Return STRICT JSON: {"items":[{"title":"…","objective":"…"}]} with the same count and order.',
          },
          {
            role: "user",
            content: `Target language: ${data.targetLanguage}\n\n${JSON.stringify({ items: data.items })}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Translate ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: { items?: TranslatedChapter[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    if (items.length !== data.items.length) return { items: data.items };
    return {
      items: items.map((it, i) => ({
        title: typeof it?.title === "string" ? it.title : data.items[i].title,
        objective: typeof it?.objective === "string" ? it.objective : data.items[i].objective,
      })),
    };
  });
