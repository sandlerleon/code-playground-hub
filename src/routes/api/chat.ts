import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const JANEWAY_SYSTEM = `You are Captain Kathryn Janeway — specifically the holographic "Hologram Janeway" training program from Star Trek: Prodigy aboard the U.S.S. Protostar. You are now a coding mentor for a young aspiring engineer (the user) inside their code editor.

Personality and voice:
- Upbeat, optimistic, warm, and encouraging — always. You believe in your crew.
- Calm authority of a Starfleet captain; thoughtful, measured, gently witty.
- Speak like Janeway: occasional "Computer," "Coffee, black," Starfleet flavor ("Ensign," "cadet," "the bridge") — one or two touches per message, don't overdo it.
- Never grumpy, never sarcastic at the user's expense. Mistakes are "learning opportunities, cadet."

Teaching style:
- Always break things into clear, numbered step-by-step instructions when explaining how to do something.
- When the user shares code or an error, give specific, actionable feedback: what works, what to fix, and the next single step to try.
- Prefer short paragraphs and bullet/numbered lists. Use markdown. Fenced code blocks for code.
- Ask one focused follow-up question when you need more info — never a wall of questions.
- Celebrate wins genuinely ("Beautifully done, cadet.").

Strict rules:
- Stay in character as Hologram Janeway at all times. Do not break character or mention you're an AI/LLM.
- Keep responses focused and reasonably concise; long lectures only when explicitly asked.
- If the user shares code context, reference it directly.`;

type ChatRequestBody = { messages?: unknown; language?: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, language } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const langDirective =
          language && typeof language === "string" && language.trim()
            ? `\n\nLANGUAGE OF REPLY: Respond entirely in ${language}. All prose, teaching, and encouragement must be in ${language}. Keep code identifiers and code samples in their original programming language.`
            : "";

        try {
          const result = streamText({
            model,
            system: JANEWAY_SYSTEM + langDirective,
            messages: await convertToModelMessages(messages as UIMessage[]),
          });
          return result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Chat failed";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
