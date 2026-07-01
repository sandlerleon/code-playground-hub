import { createFileRoute } from "@tanstack/react-router";

const BASE_VOICE = `Speak as Captain Kathryn Janeway: a warm, confident, optimistic Starfleet captain. Mature female voice, mid-range, clear articulation. Tone: encouraging, calm authority, a slight smile in the voice. Cadence: measured, articulate, with thoughtful pauses on important words. Never robotic.`;

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { text, language } = (await request.json()) as {
          text?: string;
          language?: string;
        };
        if (!text || typeof text !== "string" || !text.trim()) {
          return new Response("text required", { status: 400 });
        }

        const langLine =
          language && language.trim()
            ? ` Speak in ${language} with a natural native accent for that language while keeping Janeway's warm captain persona.`
            : ` Speak in clear American English.`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text.slice(0, 3500),
            voice: "sage",
            instructions: BASE_VOICE + langLine,
            response_format: "mp3",
          }),
        });

        if (!upstream.ok) {
          const msg = await upstream.text().catch(() => "");
          return new Response(`TTS failed: ${upstream.status} ${msg.slice(0, 200)}`, {
            status: upstream.status,
          });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
