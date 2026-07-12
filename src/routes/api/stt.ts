import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, preflight } from "@/lib/cors";

const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
};

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),
      POST: async ({ request }) => {
        const cors = corsHeaders(request);
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500, headers: cors });

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return new Response("file required", { status: 400, headers: cors });
        }
        if (file.size > 20 * 1024 * 1024) {
          return new Response("file too large", { status: 413, headers: cors });
        }

        const baseType = (file.type || "audio/webm").split(";")[0];
        const ext = MIME_TO_EXT[baseType] ?? "webm";

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, `recording.${ext}`);

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });

        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          return new Response(`STT failed: ${res.status} ${msg.slice(0, 300)}`, {
            status: res.status,
            headers: cors,
          });
        }

        const json = (await res.json()) as { text?: string };
        return new Response(JSON.stringify({ text: json.text ?? "" }), {
          headers: { "Content-Type": "application/json", ...cors },
        });
      },
    },
  },
});
