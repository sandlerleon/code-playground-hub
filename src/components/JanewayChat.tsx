import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import janewayImg from "@/assets/janeway.jpg";
import { Button } from "@/components/ui/button";
import { Send, X, MessageCircle, Loader2, RotateCcw } from "lucide-react";

type Props = {
  storageKey: string;
  language: string;
  getCode: () => string;
  getLastRun: () => { stdout: string; stderr: string; code: number | null } | null;
};

function loadMessages(key: string): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function JanewayChat({ storageKey, language, getCode, getLastRun }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [initial] = useState<UIMessage[]>(() => loadMessages(storageKey));
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, setMessages, error } = useChat({
    id: storageKey,
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  // persist
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      /* quota */
    }
  }, [messages, storageKey]);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status, open]);

  // focus
  useEffect(() => {
    if (open) setTimeout(() => taRef.current?.focus(), 50);
  }, [open, status]);

  const busy = status === "submitted" || status === "streaming";

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const code = getCode();
    const run = getLastRun();
    const ctx = [
      `[Editor context — language: ${language}]`,
      "```" + language,
      code.slice(0, 6000),
      "```",
      run
        ? `\n[Last run — exit ${run.code ?? "?"}]\nstdout: ${run.stdout.slice(0, 1500) || "(empty)"}${run.stderr ? `\nstderr: ${run.stderr.slice(0, 1500)}` : ""}`
        : "\n[No run yet]",
      "",
      `Cadet asks: ${text}`,
    ].join("\n");
    await sendMessage({ text: ctx });
  }

  function reset() {
    setMessages([]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full bg-card border border-border shadow-lg pl-2 pr-4 py-2 hover:bg-accent transition group"
          aria-label="Open Hologram Janeway"
        >
          <img
            src={janewayImg}
            alt="Hologram Janeway"
            width={1024}
            height={1024}
            loading="lazy"
            className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/60"
          />
          <div className="text-left">
            <div className="text-sm font-semibold">Hologram Janeway</div>
            <div className="text-xs text-muted-foreground">Ask your captain</div>
          </div>
          <MessageCircle className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(420px,calc(100vw-2rem))] h-[min(640px,calc(100vh-6rem))] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-primary/10 to-transparent">
            <img
              src={janewayImg}
              alt="Janeway"
              width={1024}
              height={1024}
              loading="lazy"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/60"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold">Hologram Janeway</div>
              <div className="text-[11px] font-mono text-muted-foreground">U.S.S. Protostar · Training program</div>
            </div>
            <Button variant="ghost" size="icon" onClick={reset} title="New conversation">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} title="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">Welcome aboard, cadet! ☕</p>
                <p>
                  I'm Hologram Janeway, your training officer. Tell me what you'd like to learn in{" "}
                  <span className="font-mono">{language}</span> and I'll walk you through it, step by step.
                </p>
                <p className="text-xs italic">I can see your code and last run output automatically.</p>
              </div>
            )}

            {messages.map((m) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              // Hide editor-context block from user view
              const visible =
                m.role === "user"
                  ? text.replace(/^\[Editor context[\s\S]*?Cadet asks:\s*/, "").trim() || text
                  : text;
              return (
                <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <img
                      src={janewayImg}
                      alt=""
                      width={1024}
                      height={1024}
                      loading="lazy"
                      className="h-7 w-7 rounded-full object-cover flex-shrink-0 mt-1"
                    />
                  )}
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap"
                        : "max-w-[85%] text-sm prose prose-sm prose-invert prose-p:my-1 prose-pre:my-2 prose-pre:bg-background/60 prose-pre:border prose-pre:border-border prose-code:text-primary prose-headings:mt-2 prose-headings:mb-1 prose-ol:my-1 prose-ul:my-1 prose-li:my-0"
                    }
                  >
                    {m.role === "assistant" ? <ReactMarkdown>{visible}</ReactMarkdown> : visible}
                  </div>
                </div>
              );
            })}

            {status === "submitted" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <img src={janewayImg} alt="" width={1024} height={1024} loading="lazy" className="h-7 w-7 rounded-full object-cover" />
                <Loader2 className="h-3 w-3 animate-spin" /> Consulting the bridge…
              </div>
            )}
            {error && (
              <div className="text-xs text-destructive">Subspace interference: {error.message}</div>
            )}
          </div>

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder="Ask Captain Janeway… (Enter to send)"
                className="flex-1 resize-none rounded-md bg-background border border-input p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={busy}
              />
              <Button size="icon" onClick={() => void send()} disabled={busy || !input.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
