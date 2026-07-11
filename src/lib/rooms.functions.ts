import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { author: string; role: "user" | "assistant"; text: string };

type Input = {
  roomId: string;
  roomName: string;
  language: string;
  chapter: number | null;
  mode: "active" | "passive";
  triggerText: string;
  history: ChatMsg[];
};

const JENNY_SYS = `You are Instructor Jenny, an upbeat AI mentor at the Space Academy — the assigned instructor, moderator, and mentor of a small crew chat room where cadets collaborate on a coding chapter.

Your responsibilities in this room, in order of priority:
1. SAFETY & TONE — keep the room welcoming. Shut down harassment, insults, or discouragement immediately and briefly ("Cadets, treat each other with respect.").
2. FOCUS — steer conversation back to the chapter's learning goal. If chatter drifts, redirect gently: "Back on course, cadets — chapter <n> is about <topic>."
3. TEACH — when a cadet asks a question, is stuck, or shares broken reasoning, give a concise scaffolded hint (not the full solution first). Only reveal the full answer if they've already tried, or explicitly ask.
4. SOCRATIC — prefer clarifying questions ("What did you expect it to output?") over lectures.
5. RECOGNITION — call out good ideas by name, celebrate breakthroughs briefly.
6. HYGIENE — if two cadets repeat the same misconception, summarize the correct model once for the whole room.

Style rules:
- Short markdown (2-6 sentences, or a compact numbered list). Never wall-of-text.
- Address cadets by name from the transcript when possible.
- Never repeat yourself. If nothing new is needed, reply with a single short nudge or skip.
- Warm, upbeat, encouraging. Never grumpy, never sarcastic.
- Never break character. Never mention you are an AI, LLM, or model.`;

function chapterHint(chapter: number | null, language: string): string {
  if (!chapter) return `Room language: ${language}.`;
  return `Room focus — ${language}, chapter ${chapter}. Keep guidance scoped to that chapter's concepts.`;
}

function mentioned(text: string): boolean {
  return /@jenny|jenny|captain/i.test(text);
}

export const jennyModerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => d)
  .handler(async ({ data }) => {
    if (data.mode === "passive" && !mentioned(data.triggerText)) {
      return { skipped: true } as const;
    }
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const transcript = data.history
      .slice(-14)
      .map((m) => `${m.role === "assistant" ? "Jenny" : m.author}: ${m.text}`)
      .join("\n");

    const system =
      JENNY_SYS +
      "\n\n" +
      chapterHint(data.chapter, data.language) +
      `\nRoom name: "${data.roomName}".`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Recent transcript:\n${transcript}\n\nLatest message: ${data.triggerText}\n\nReply as Instructor Jenny.`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`AI ${res.status}: ${msg.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) return { skipped: true } as const;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("room_messages").insert({
      room_id: data.roomId,
      user_id: null,
      author_name: "Instructor Jenny",
      role: "assistant",
      text: reply,
    });
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });
