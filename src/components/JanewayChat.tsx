import { useEffect, useRef, useState, useCallback } from "react";
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
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const SPOKEN_LANGUAGES: { code: string; label: string; nativeGreeting: string }[] = [
  { code: "English", label: "English", nativeGreeting: "Welcome aboard, cadet! Ready to write some code?" },
  { code: "Mandarin Chinese", label: "中文 (普通话)", nativeGreeting: "欢迎登舰，学员！准备好一起写代码了吗？" },
  { code: "Spanish", label: "Español", nativeGreeting: "¡Bienvenido a bordo, cadete! ¿Listo para programar?" },
  { code: "Hindi", label: "हिन्दी", nativeGreeting: "स्वागत है कैडेट! क्या आप कोड लिखने के लिए तैयार हैं?" },
  { code: "Arabic", label: "العربية", nativeGreeting: "أهلاً بك على متن السفينة يا مبتدئ! هل أنت مستعد للبرمجة؟" },
  { code: "Portuguese", label: "Português", nativeGreeting: "Bem-vindo a bordo, cadete! Pronto para programar?" },
  { code: "Bengali", label: "বাংলা", nativeGreeting: "স্বাগতম ক্যাডেট! কোড লিখতে প্রস্তুত?" },
  { code: "Russian", label: "Русский", nativeGreeting: "Добро пожаловать на борт, кадет! Готовы писать код?" },
  { code: "Japanese", label: "日本語", nativeGreeting: "ようこそ、候補生！コードを書く準備はいい？" },
  { code: "French", label: "Français", nativeGreeting: "Bienvenue à bord, cadet ! Prêt à coder ?" },
];

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
  spokenLanguage: string,
): string {
  const langLine =
    spokenLanguage && spokenLanguage !== "English"
      ? `[Reply entirely in ${spokenLanguage}. Keep code identifiers in their original programming language.]`
      : "";
  return [
    langLine,
    `[Editor context — language: ${language}]`,
    "```" + language,
    code.slice(0, 6000),
    "```",
    run
      ? `\n[Last run — exit ${run.code ?? "?"}]\nstdout: ${run.stdout.slice(0, 1500) || "(empty)"}${run.stderr ? `\nstderr: ${run.stderr.slice(0, 1500)}` : ""}`
      : "\n[No run yet]",
    "",
    `Cadet asks: ${userText}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function JanewayChat({ storageKey, language, getCode, getLastRun }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [initial] = useState<UIMessage[]>(() => loadMessages(storageKey));
  const [voiceOn, setVoiceOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [spokenLang, setSpokenLang] = useState<string>(() => {
    if (typeof window === "undefined") return "English";
    return window.localStorage.getItem("janeway-spoken-lang") ?? "English";
  });

  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spokenIdsRef = useRef<Set<string>>(new Set());

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

  // Don't replay history on mount
  useEffect(() => {
    initial.forEach((m) => {
      if (m.role === "assistant") spokenIdsRef.current.add(m.id);
    });
  }, [initial]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, langOverride?: string) => {
      if (!text.trim()) return;
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        setSpeaking(true);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: langOverride ?? spokenLang }),
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
      } catch (e) {
        setSpeaking(false);
        console.error("TTS failed", e);
      }
    },
    [spokenLang],
  );

  // Auto-speak finished assistant messages
  useEffect(() => {
    if (!voiceOn) return;
    if (status === "submitted" || status === "streaming") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (spokenIdsRef.current.has(last.id)) return;
    const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    if (!text) return;
    spokenIdsRef.current.add(last.id);
    void speak(toSpeakable(text));
  }, [messages, status, voiceOn, speak]);

  // Persist spoken language
  useEffect(() => {
    try {
      window.localStorage.setItem("janeway-spoken-lang", spokenLang);
    } catch {
      /* ignore */
    }
  }, [spokenLang]);

  // Autoplay greeting on first mount (once per language slot)
  const greetedRef = useRef(false);
  useEffect(() => {
    if (greetedRef.current) return;
    if (messages.length > 0) {
      greetedRef.current = true;
      return;
    }
    greetedRef.current = true;
    const preset = SPOKEN_LANGUAGES.find((l) => l.code === spokenLang);
    const greeting =
      (preset?.nativeGreeting ?? "Welcome aboard, cadet! Ready to write some code?") +
      ` (Coding in ${language} today.)`;
    const msg: UIMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      parts: [{ type: "text", text: greeting }],
    };
    setMessages([msg]);
    // speak immediately (may be blocked by autoplay policy — user can click volume to retry)
    if (voiceOn) {
      spokenIdsRef.current.add(msg.id);
      void speak(toSpeakable(greeting));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!voiceOn) stopSpeaking();
  }, [voiceOn, stopSpeaking]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      const ctx = buildContextMessage(trimmed, language, getCode(), getLastRun(), spokenLang);
      await sendMessage({ text: ctx });
    },
    [busy, language, getCode, getLastRun, sendMessage, spokenLang],
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
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  // --- Mic recording ---
  async function startRecording() {
    if (recording || transcribing) return;
    stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType =
        ["audio/webm", "audio/mp4"].find((t) =>
          typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
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
          toast.error("That recording was empty — try again, cadet.");
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
  }

  function stopRecording() {
    if (!recording) return;
    setRecording(false);
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
  }

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
                {speaking ? "Speaking…" : recording ? "Listening…" : "U.S.S. Protostar"}
              </div>
            </div>
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

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">Welcome aboard, cadet! ☕</p>
                <p>
                  I'm Hologram Janeway, your training officer. Type or tap the mic to talk — I'll
                  walk you through your <span className="font-mono">{language}</span> code, step by
                  step.
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
                onClick={recording ? stopRecording : startRecording}
                disabled={busy || transcribing}
                title={recording ? "Stop recording" : "Hold to talk"}
              >
                {recording ? (
                  <Square className="h-4 w-4" />
                ) : transcribing ? (
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
                placeholder={recording ? "Recording… click ◼ to send" : "Type or tap the mic…"}
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
