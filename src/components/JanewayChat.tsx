import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import janewayImg from "@/assets/janeway.jpg";
import { Button } from "@/components/ui/button";
import {
  Send,
  X,
  MessageCircle,
  Loader2,
  RotateCcw,
  Mic,
  Volume2,
  VolumeX,
  BookOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { getCurriculum } from "@/lib/curriculum";

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

function toSpeakable(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " (code shown on screen) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[#>\-*+]\s+/gm, "")
    .replace(/(\*\*|__|\*|_)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildContextMessage(
  userText: string,
  language: string,
  code: string,
  run: { stdout: string; stderr: string; code: number | null } | null,
): string {
  return [
    `[Editor context — language: ${language}]`,
    "```" + language,
    code.slice(0, 6000),
    "```",
    run
      ? `\n[Last run — exit ${run.code ?? "?"}]\nstdout: ${run.stdout.slice(0, 1500) || "(empty)"}${run.stderr ? `\nstderr: ${run.stderr.slice(0, 1500)}` : ""}`
      : "\n[No run yet]",
    "",
    `Cadet asks: ${userText}`,
  ].join("\n");
}

export function JanewayChat({ storageKey, language, getCode, getLastRun }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [initial] = useState<UIMessage[]>(() => loadMessages(storageKey));
  const [voiceOn, setVoiceOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [openModules, setOpenModules] = useState<Record<number, boolean>>({ 0: true });

  const curriculum = useMemo(() => getCurriculum(language), [language]);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spokenIdsRef = useRef<Set<string>>(new Set());
  const replayPendingRef = useRef<string | null>(null);

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
  }, [messages, status, open, showToc]);

  // focus
  useEffect(() => {
    if (open) setTimeout(() => taRef.current?.focus(), 50);
  }, [open, status]);

  const busy = status === "submitted" || status === "streaming";

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string): Promise<boolean> => {
    if (!text.trim()) return false;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      setSpeaking(true);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `TTS ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
      return true;
    } catch (e) {
      setSpeaking(false);
      console.warn("TTS playback failed", e);
      return false;
    }
  }, []);

  // Mark history as already-spoken, but queue the last assistant message
  // for autoplay on page load.
  useEffect(() => {
    initial.forEach((m) => {
      if (m.role === "assistant") spokenIdsRef.current.add(m.id);
    });
    const lastAssistant = [...initial].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      const text = lastAssistant.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
      const spoken = toSpeakable(text);
      if (spoken) replayPendingRef.current = spoken;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Try autoplay of the last comment on first mount; if blocked, retry on open.
  useEffect(() => {
    if (!voiceOn) return;
    const pending = replayPendingRef.current;
    if (!pending) return;
    let cancelled = false;
    (async () => {
      const ok = await speak(pending);
      if (!cancelled && ok) replayPendingRef.current = null;
    })();
    return () => {
      cancelled = true;
    };
  }, [voiceOn, open, speak]);

  // Auto-speak finished assistant messages (live replies)
  useEffect(() => {
    if (!voiceOn) return;
    if (status === "submitted" || status === "streaming") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (spokenIdsRef.current.has(last.id)) return;
    const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    if (!text) return;
    spokenIdsRef.current.add(last.id);
    replayPendingRef.current = null;
    void speak(toSpeakable(text));
  }, [messages, status, voiceOn, speak]);

  useEffect(() => {
    if (!voiceOn) stopSpeaking();
  }, [voiceOn, stopSpeaking]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      const ctx = buildContextMessage(trimmed, language, getCode(), getLastRun());
      await sendMessage({ text: ctx });
    },
    [busy, language, getCode, getLastRun, sendMessage],
  );

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendText(text);
  }

  function reset() {
    stopSpeaking();
    setMessages([]);
    spokenIdsRef.current.clear();
    replayPendingRef.current = null;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  async function pickLesson(prompt: string) {
    if (!open) setOpen(true);
    setShowToc(false);
    await sendText(prompt);
  }

  // --- Push-to-talk recording ---
  const startRecording = useCallback(async () => {
    if (recording || transcribing || busy) return;
    stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType =
        ["audio/webm", "audio/mp4"].find(
          (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
        ) ?? "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 1024) {
          toast.error("That was too short — hold the mic and speak, cadet.");
          return;
        }
        setTranscribing(true);
        try {
          const ext =
            ({
              "audio/webm": "webm",
              "audio/mp4": "mp4",
              "audio/mpeg": "mp3",
              "audio/wav": "wav",
            } as Record<string, string>)[(blob.type || "").split(";")[0]] ?? "webm";
          const fd = new FormData();
          fd.append("file", new File([blob], `recording.${ext}`, { type: blob.type }));
          const res = await fetch("/api/stt", { method: "POST", body: fd });
          if (!res.ok) {
            const msg = await res.text().catch(() => "");
            throw new Error(msg || `STT ${res.status}`);
          }
          const { text } = (await res.json()) as { text?: string };
          const transcript = (text ?? "").trim();
          if (!transcript) {
            toast.error("I didn't catch that, cadet.");
            return;
          }
          await sendText(transcript);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      setRecording(true);
    } catch (e) {
      toast.error("Microphone access is required to talk to Janeway.");
      console.error(e);
    }
  }, [recording, transcribing, busy, stopSpeaking, sendText]);

  const stopRecording = useCallback(() => {
    if (!recording) return;
    setRecording(false);
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, [recording]);

  // Spacebar push-to-talk (when chat open and not typing)
  useEffect(() => {
    if (!open) return;
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      void startRecording();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      stopRecording();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [open, startRecording, stopRecording]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const pttHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      void startRecording();
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      stopRecording();
    },
    onPointerCancel: () => stopRecording(),
    onPointerLeave: () => {
      if (recording) stopRecording();
    },
  };

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
            <div className="text-xs text-muted-foreground">Talk to your captain</div>
          </div>
          <MessageCircle className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(420px,calc(100vw-2rem))] h-[min(640px,calc(100vh-6rem))] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-gradient-to-r from-primary/10 to-transparent">
            <div className="relative">
              <img
                src={janewayImg}
                alt="Janeway"
                width={1024}
                height={1024}
                loading="lazy"
                className={`h-10 w-10 rounded-full object-cover ring-2 ${speaking ? "ring-primary animate-pulse" : "ring-primary/60"}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">Hologram Janeway</div>
              <div className="text-[11px] font-mono text-muted-foreground truncate">
                {speaking
                  ? "Speaking…"
                  : recording
                    ? "Listening…"
                    : `U.S.S. Protostar · ${language}`}
              </div>
            </div>
            <Button
              variant={showToc ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setShowToc((v) => !v)}
              title="Curriculum"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setVoiceOn((v) => !v)}
              title={voiceOn ? "Mute voice" : "Unmute voice"}
            >
              {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={reset} title="New conversation">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} title="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {showToc && (
            <div className="border-b bg-background/40 max-h-[45%] overflow-y-auto">
              <div className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Curriculum · {language}
              </div>
              <ul className="pb-2">
                {curriculum.map((mod, i) => {
                  const isOpen = !!openModules[i];
                  return (
                    <li key={mod.title} className="px-2">
                      <button
                        onClick={() => setOpenModules((s) => ({ ...s, [i]: !s[i] }))}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm font-medium text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate">{mod.title}</span>
                      </button>
                      {isOpen && (
                        <ul className="pl-7 pb-1 space-y-0.5">
                          {mod.lessons.map((lesson) => (
                            <li key={lesson.title}>
                              <button
                                onClick={() => void pickLesson(lesson.prompt)}
                                disabled={busy}
                                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50"
                              >
                                › {lesson.title}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">Welcome aboard, cadet! ☕</p>
                <p>
                  I'm Hologram Janeway, your training officer. Tap the{" "}
                  <BookOpen className="inline h-3.5 w-3.5 -mt-0.5" /> for the curriculum, type, or
                  hold the mic (or Spacebar) to talk.
                </p>
                <p className="text-xs italic">I see your code and last run automatically.</p>
              </div>
            )}

            {messages.map((m) => {
              const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              const visible =
                m.role === "user"
                  ? text.replace(/^\[Editor context[\s\S]*?Cadet asks:\s*/, "").trim() || text
                  : text;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
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
                        : "max-w-[85%] text-sm leading-relaxed text-foreground [&_p]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-primary [&_code]:text-xs [&_pre]:bg-background/60 [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold"
                    }
                  >
                    {m.role === "assistant" ? <ReactMarkdown>{visible}</ReactMarkdown> : visible}
                  </div>
                </div>
              );
            })}

            {status === "submitted" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <img
                  src={janewayImg}
                  alt=""
                  width={1024}
                  height={1024}
                  loading="lazy"
                  className="h-7 w-7 rounded-full object-cover"
                />
                <Loader2 className="h-3 w-3 animate-spin" /> Consulting the bridge…
              </div>
            )}
            {transcribing && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Transcribing your message…
              </div>
            )}
            {error && (
              <div className="text-xs text-destructive">Subspace interference: {error.message}</div>
            )}
          </div>

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Button
                size="icon"
                variant={recording ? "destructive" : "outline"}
                {...pttHandlers}
                disabled={busy || transcribing}
                title="Hold to talk (or hold Spacebar)"
                className={recording ? "animate-pulse" : ""}
              >
                {transcribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={2}
                placeholder={recording ? "Recording… release to send" : "Type, or hold mic / space to talk…"}
                className="flex-1 resize-none rounded-md bg-background border border-input p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                disabled={busy || recording || transcribing}
              />
              <Button
                size="icon"
                onClick={() => void handleSend()}
                disabled={busy || recording || transcribing || !input.trim()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
