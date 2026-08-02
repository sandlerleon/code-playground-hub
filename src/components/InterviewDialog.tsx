import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, Square, Play, Award, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import jennyImg from "@/assets/jenny.jpg";
import {
  generateInterviewFn,
  gradeInterviewFn,
  type InterviewGrade,
  type InterviewQuestion,
} from "@/lib/interview.functions";
import { toLetterGrade, gradeColor } from "@/lib/grade";
import { SPOKEN_LANGUAGES } from "@/components/JennyChat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LOCALE_KEY = "course-locale";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  language: string;
  languageName: string;
};

type Phase = "intro" | "loading" | "interviewing" | "grading" | "result" | "error";

const PASS = 70;

export function InterviewDialog({ open, onOpenChange, language, languageName }: Props) {
  const gen = useServerFn(generateInterviewFn);
  const grade = useServerFn(gradeInterviewFn);

  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<{ id: string; transcript: string }[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState<InterviewGrade | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [locale, setLocale] = useState("English");

  useEffect(() => {
    const saved = window.localStorage.getItem(LOCALE_KEY);
    if (saved) setLocale(saved);
  }, []);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const reset = useCallback(() => {
    setPhase("intro");
    setQuestions([]);
    setIdx(0);
    setAnswers([]);
    setResult(null);
    setErrorMsg("");
    stopRec();
    stopAudio();
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setSpeaking(false);
  }

  function stopRec() {
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
  }

  const speak = useCallback(async (text: string) => {
    stopAudio();
    setSpeaking(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: locale }),
      });
      if (!res.ok) throw new Error(await res.text());
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
  }, [locale]);

  async function start() {
    setPhase("loading");
    setErrorMsg("");
    try {
      const { questions: qs } = await gen({ data: { language, locale } });
      setQuestions(qs);
      setIdx(0);
      setAnswers([]);
      setPhase("interviewing");
      void speak(
        `Welcome, cadet. This is your ${languageName} graduation interview. I'll ask ${qs.length} questions. Speak your answer, then tap stop. First question: ${qs[0].prompt}`,
      );
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to start");
      setPhase("error");
    }
  }

  async function beginRecording() {
    if (recording || transcribing) return;
    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType =
        ["audio/webm", "audio/mp4"].find(
          (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
        ) ?? "";
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 1024) {
          toast.error("That answer was empty — try again.");
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
          fd.append("file", new File([blob], `answer.${ext}`, { type: blob.type }));
          const res = await fetch("/api/stt", { method: "POST", body: fd });
          if (!res.ok) throw new Error(await res.text());
          const { text } = (await res.json()) as { text?: string };
          const transcript = (text ?? "").trim();
          if (!transcript) {
            toast.error("Didn't catch that — try again.");
            return;
          }
          const q = questions[idx];
          const nextAnswers = [...answers, { id: q.id, transcript }];
          setAnswers(nextAnswers);
          const nextIdx = idx + 1;
          if (nextIdx >= questions.length) {
            setPhase("grading");
            try {
              const g = await grade({
                data: { language, locale, questions, answers: nextAnswers },
              });
              setResult(g);
              setPhase("result");
              void speak(g.overall);
            } catch (e) {
              setErrorMsg(e instanceof Error ? e.message : "Grading failed");
              setPhase("error");
            }
          } else {
            setIdx(nextIdx);
            void speak(`Next question: ${questions[nextIdx].prompt}`);
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("Microphone access is required for the interview.");
    }
  }

  function endRecording() {
    if (!recording) return;
    setRecording(false);
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
  }

  const current = questions[idx];
  const grade_ = result ? toLetterGrade(result.percent) : "—";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          stopRec();
          stopAudio();
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={jennyImg} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/60" />
            <span>Graduation Interview · {languageName}</span>
          </DialogTitle>
        </DialogHeader>

        {phase === "intro" && (
          <div className="space-y-3 text-sm">
            <p>
              This is your final oral exam for the entire {languageName} course. Instructor Jenny
              will ask <strong>6 questions</strong> covering all 20 chapters. You'll answer by
              speaking into the microphone.
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Speak clearly — Jenny will grade content, not accent.</li>
              <li>You must score at least <strong>{PASS}%</strong> to graduate.</li>
              <li>Aim for 20-90 seconds per answer.</li>
            </ul>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Interview language</span>
              <Select value={locale} onValueChange={(v) => { setLocale(v); window.localStorage.setItem(LOCALE_KEY, v); }}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPOKEN_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code} className="text-xs">{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              🎤 Requires microphone permission and speakers/headphones for Jenny's voice.
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Jenny is preparing your interview…
          </div>
        )}

        {phase === "interviewing" && current && (
          <div className="space-y-4">
            <div className="text-xs font-mono text-muted-foreground">
              Question {idx + 1} of {questions.length}
              {speaking && <span className="ml-2 text-primary">· Jenny speaking…</span>}
            </div>
            <div className="rounded-lg border bg-card p-4 text-sm leading-relaxed">
              {current.prompt}
            </div>
            <div className="flex items-center justify-center gap-3">
              {!recording ? (
                <Button
                  onClick={beginRecording}
                  size="lg"
                  disabled={transcribing || speaking}
                  className="rounded-full"
                >
                  {transcribing ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Transcribing…</>
                  ) : (
                    <><Mic className="h-5 w-5 mr-2" /> Record answer</>
                  )}
                </Button>
              ) : (
                <Button onClick={endRecording} size="lg" variant="destructive" className="rounded-full">
                  <Square className="h-5 w-5 mr-2" /> Stop & submit answer
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => void speak(current.prompt)}
                disabled={recording || speaking}
              >
                <Play className="h-3 w-3 mr-1" /> Repeat
              </Button>
            </div>
          </div>
        )}

        {phase === "grading" && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Jenny is reviewing your answers…
          </div>
        )}

        {phase === "result" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <Award className={`h-10 w-10 ${result.passed ? "text-emerald-400" : "text-muted-foreground"}`} />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  {result.passed ? "🎓 Graduated" : "Not yet — keep training"}
                </div>
                <div className="text-2xl font-bold">
                  {result.percent}%{" "}
                  <span className={`ml-2 text-lg ${gradeColor(grade_)}`}>{grade_}</span>
                </div>
                <div className="text-xs text-muted-foreground">Pass mark: {PASS}%</div>
              </div>
            </div>
            <p className="text-sm italic text-muted-foreground">"{result.overall}"</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {result.perQuestion.map((p, i) => {
                const q = questions.find((x) => x.id === p.id);
                const ok = p.score >= PASS;
                return (
                  <div key={p.id} className="rounded border border-border bg-background/40 p-3 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      {ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className="font-mono">Q{i + 1}</span>
                      <span className="ml-auto font-mono">{p.score}%</span>
                    </div>
                    {q && <div className="text-muted-foreground mb-1">{q.prompt}</div>}
                    <div>{p.feedback}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="text-sm text-destructive py-4">{errorMsg || "Something went wrong."}</div>
        )}

        <DialogFooter>
          {phase === "intro" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={start}>Start interview</Button>
            </>
          )}
          {(phase === "result" || phase === "error") && (
            <>
              <Button variant="outline" onClick={reset}>Take again</Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </>
          )}
          {phase === "interviewing" && (
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Abandon interview
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
