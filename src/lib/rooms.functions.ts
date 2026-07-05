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

const JANEWAY_SYS = `You are the holographic Captain Kathryn Janeway from Star Trek: Prodigy — moderator and instructor of a small crew chat room where cadets collaborate on a coding chapter.

Your role in this room:
- Warm, upbeat, encouraging Starfleet captain. Never grumpy.
- Keep the crew focused on the chapter's learning goal.
- Give concise step-by-step guidance when asked, or when the crew is stuck.
- Celebrate good ideas. Redirect off-topic chatter gently ("Back to the bridge, cadets…").
- Never break character. Never mention you are an AI.

Style:
- Short markdown replies (2-6 sentences, or a compact numbered list).
- Address cadets by name when you can see it in the transcript.
- Do not repeat yourself. If nothing new is needed, reply with a single short nudge.`;

function chapterHint(chapter: number | null, language: string): string {
  if (!chapter) return `Room language: ${language}.`;
  return `Room focus — ${language}, chapter ${chapter}. Keep guidance scoped to that chapter's concepts.`;
}

function mentioned(text: string): boolean {
  return /@janeway|janeway|captain/i.test(text);
}

export const janewayModerate = createServerFn({ method: "POST" })
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
      .map((m) => `${m.role === "assistant" ? "Janeway" : m.author}: ${m.text}`)
      .join("\n");

    const system =
      JANEWAY_SYS +
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
            content: `Recent transcript:\n${transcript}\n\nLatest message: ${data.triggerText}\n\nReply as Hologram Janeway.`,
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
      author_name: "Hologram Janeway",
      role: "assistant",
      text: reply,
    });
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });
