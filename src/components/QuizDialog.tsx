import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Award, CheckCircle2, XCircle, Info } from "lucide-react";
import { generateQuizFn, submitQuizFn, type QuizQuestion } from "@/lib/quiz.functions";
import { toLetterGrade, gradeColor } from "@/lib/grade";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  language: string;
  chapter: number;
  chapterTitle: string;
  chapterObjective: string;
  locale?: string;
  onPassed?: () => void;
  onSubmitted?: (percent: number) => void;
};

type Phase = "intro" | "loading" | "taking" | "review" | "error";
type PriorAttempt = { percent: number; score: number; total: number; created_at: string };

const PASS_THRESHOLD = 70;
const COOLDOWN_MS = 30_000; // 30s between retakes

export function QuizDialog({
  open,
  onOpenChange,
  language,
  chapter,
  chapterTitle,
  chapterObjective,
  locale,
  onPassed,
  onSubmitted,
}: Props) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number; percent: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [priors, setPriors] = useState<PriorAttempt[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const gen = useServerFn(generateQuizFn);
  const submit = useServerFn(submitQuizFn);

  // reset & load history on open
  useEffect(() => {
    if (!open) return;
    setPhase("intro");
    setAnswers({});
    setResult(null);
    setErrorMsg("");
    setQuestions([]);
    if (!user) return;
    supabase
      .from("quiz_attempts")
      .select("percent,score,total,created_at")
      .eq("user_id", user.id)
      .eq("language", language)
      .eq("chapter", chapter)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setPriors((data ?? []) as PriorAttempt[]));
  }, [open, user, language, chapter]);

  // ticking clock for cooldown display
  useEffect(() => {
    if (!open || phase !== "intro") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, phase]);

  const best = priors.length ? Math.max(...priors.map((p) => p.percent)) : null;
  const attempts = priors.length;
  const lastAt = priors[0] ? new Date(priors[0].created_at).getTime() : 0;
  const cooldownLeft = Math.max(0, COOLDOWN_MS - (now - lastAt));
  const canStart = cooldownLeft === 0;

  async function startQuiz() {
    setPhase("loading");
    try {
      const r = await gen({ data: { language, chapter, chapterTitle, chapterObjective, locale } });
      setQuestions(r.questions);
      setPhase("taking");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to load quiz");
      setPhase("error");
    }
  }

  const answered = questions.filter((q) => answers[q.id] != null).length;
  const allAnswered = questions.length > 0 && answered === questions.length;

  async function onSubmit() {
    const payload = questions.map((q) => ({
      questionId: q.id,
      correct: answers[q.id] === q.answerIndex,
    }));
    try {
      const r = await submit({
        data: { language, chapter, total: questions.length, answers: payload },
      });
      setResult(r);
      setPhase("review");
      onSubmitted?.(r.percent);
      if (r.percent >= PASS_THRESHOLD) onPassed?.();
      toast.success(`Score: ${r.score}/${r.total} · ${toLetterGrade(r.percent)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    }
  }

  const grade = result ? toLetterGrade(result.percent) : "—";
  const correctCount = result ? result.score : 0;
  const incorrectCount = result ? result.total - result.score : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Chapter {chapter} Assessment · <span className="capitalize">{language}</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{chapterTitle} — 10 questions, one correct answer each.</p>
        </DialogHeader>

        {phase === "intro" && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-card/40 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Info className="h-4 w-4 text-primary" /> Exam & retake rules
              </div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs">
                <li>10 multiple-choice questions, one correct answer per question.</li>
                <li>Passing score: <span className="text-foreground font-mono">{PASS_THRESHOLD}%</span> (C-) — unlocks chapter completion badge.</li>
                <li>You may retake as many times as you like. <span className="text-foreground">Only your best score counts</span> toward your grade and the leaderboard.</li>
                <li>{COOLDOWN_MS / 1000}s cooldown between attempts to keep the fleet honest.</li>
                <li>After grading you'll see per-question review with the correct answer and explanation.</li>
              </ul>
            </div>

            {attempts > 0 && (
              <div className="rounded-lg border p-4 bg-card/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Your history — {attempts} attempt{attempts === 1 ? "" : "s"}</div>
                  <div className={`text-2xl font-display font-bold ${gradeColor(toLetterGrade(best))}`}>
                    {toLetterGrade(best)}
                  </div>
                </div>
                <div className="flex items-end gap-1 h-16">
                  {priors.slice().reverse().map((p, i) => {
                    const h = Math.max(4, Math.round((p.percent / 100) * 60));
                    const color = p.percent >= 90 ? "bg-emerald-500" : p.percent >= PASS_THRESHOLD ? "bg-sky-500" : "bg-destructive/70";
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${p.percent}% on ${new Date(p.created_at).toLocaleString()}`}>
                        <div className={`w-full ${color} rounded-t`} style={{ height: `${h}px` }} />
                        <span className="text-[9px] font-mono text-muted-foreground">{p.percent}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground font-mono">
                  Best: {best}% · Latest: {priors[0].percent}%
                </div>
              </div>
            )}

            {!canStart && (
              <div className="text-xs text-amber-400 font-mono text-center">
                Cooldown: {Math.ceil(cooldownLeft / 1000)}s remaining
              </div>
            )}
          </div>
        )}

        {phase === "loading" && (
          <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Generating your certification quiz…</span>
          </div>
        )}

        {phase === "error" && (
          <div className="py-8 text-center space-y-3">
            <p className="text-destructive text-sm">{errorMsg}</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}

        {phase === "taking" && (
          <div className="space-y-6">
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground font-mono mb-2">Question {i + 1} of {questions.length}</div>
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm font-medium">
                  {q.prompt}
                </div>
                <div className="mt-3 space-y-2">
                  {q.choices.map((c, ci) => {
                    const sel = answers[q.id] === ci;
                    return (
                      <button
                        key={ci}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: ci }))}
                        className={`w-full text-left rounded-md border px-3 py-2 text-sm transition ${
                          sel ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40"
                        }`}
                      >
                        <span className="font-mono text-xs mr-2 text-muted-foreground">{String.fromCharCode(65 + ci)}.</span>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {phase === "review" && result && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 flex items-center justify-between bg-card/40">
              <div>
                <div className="text-xs text-muted-foreground font-mono">Your result</div>
                <div className="text-2xl font-bold">{result.score} / {result.total} correct</div>
                <div className="text-xs text-muted-foreground">
                  {result.percent}% · {result.percent >= PASS_THRESHOLD ? "Passed" : "Try again"}
                </div>
              </div>
              <div className={`text-5xl font-display font-bold ${gradeColor(grade)}`}>{grade}</div>
            </div>

            {/* Grade breakdown */}
            <div className="rounded-lg border p-4 bg-card/40">
              <div className="text-xs font-mono text-muted-foreground mb-2">Grade breakdown</div>
              <div className="flex h-3 rounded overflow-hidden border">
                <div className="bg-emerald-500" style={{ width: `${(correctCount / result.total) * 100}%` }} title={`${correctCount} correct`} />
                <div className="bg-destructive/70" style={{ width: `${(incorrectCount / result.total) * 100}%` }} title={`${incorrectCount} incorrect`} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-mono">
                <div><span className="text-emerald-400">■</span> {correctCount} correct</div>
                <div><span className="text-destructive">■</span> {incorrectCount} incorrect</div>
                <div className="text-right text-muted-foreground">
                  need {Math.max(0, Math.ceil((PASS_THRESHOLD / 100) * result.total) - correctCount)} more to pass
                </div>
              </div>
            </div>

            <div className="text-xs font-mono text-muted-foreground uppercase pt-2">Question review</div>
            {questions.map((q, i) => {
              const chosen = answers[q.id];
              const ok = chosen === q.answerIndex;
              return (
                <div key={q.id} className={`rounded-lg border p-4 ${ok ? "border-emerald-500/30" : "border-destructive/40"}`}>
                  <div className="flex items-start gap-2">
                    {ok ? <CheckCircle2 className="h-4 w-4 mt-1 text-emerald-400" /> : <XCircle className="h-4 w-4 mt-1 text-destructive" />}
                    <div className="flex-1 whitespace-pre-wrap text-sm font-medium">Q{i + 1}. {q.prompt}</div>
                  </div>
                  <div className="mt-3 space-y-1">
                    {q.choices.map((c, ci) => {
                      const isCorrect = ci === q.answerIndex;
                      const isChosen = ci === chosen;
                      const cls = isCorrect
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : isChosen
                        ? "border-destructive/60 bg-destructive/10"
                        : "border-border/50 opacity-70";
                      return (
                        <div key={ci} className={`text-xs rounded border px-2 py-1 ${cls}`}>
                          <span className="font-mono mr-2">{String.fromCharCode(65 + ci)}.</span>{c}
                          {isCorrect && <span className="ml-2 text-emerald-400 font-mono">✓ correct</span>}
                          {isChosen && !isCorrect && <span className="ml-2 text-destructive font-mono">✗ your answer</span>}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && <div className="mt-2 text-xs text-muted-foreground italic">💡 {q.explanation}</div>}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {phase === "intro" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={startQuiz} disabled={!canStart || !user}>
                {attempts > 0 ? "Retake quiz" : "Start quiz"}
              </Button>
            </>
          )}
          {phase === "taking" && (
            <>
              <span className="text-xs text-muted-foreground mr-auto">{answered}/{questions.length} answered</span>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!allAnswered} onClick={onSubmit}>Submit for grading</Button>
            </>
          )}
          {phase === "review" && (
            <>
              <Button variant="outline" onClick={() => { setPhase("intro"); }}>Back to overview</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
