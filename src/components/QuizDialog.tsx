import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Award, CheckCircle2, XCircle } from "lucide-react";
import { generateQuizFn, submitQuizFn, type QuizQuestion } from "@/lib/quiz.functions";
import { toLetterGrade, gradeColor } from "@/lib/grade";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  language: string;
  chapter: number;
  chapterTitle: string;
  chapterObjective: string;
  onPassed?: () => void;
  onSubmitted?: (percent: number) => void;
};

type Phase = "loading" | "taking" | "review" | "error";

export function QuizDialog({
  open,
  onOpenChange,
  language,
  chapter,
  chapterTitle,
  chapterObjective,
  onPassed,
  onSubmitted,
}: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number; percent: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const gen = useServerFn(generateQuizFn);
  const submit = useServerFn(submitQuizFn);

  useEffect(() => {
    if (!open) return;
    setPhase("loading");
    setAnswers({});
    setResult(null);
    setErrorMsg("");
    gen({ data: { language, chapter, chapterTitle, chapterObjective } })
      .then((r) => {
        setQuestions(r.questions);
        setPhase("taking");
      })
      .catch((e) => {
        setErrorMsg(e instanceof Error ? e.message : "Failed to load quiz");
        setPhase("error");
      });
  }, [open, language, chapter, chapterTitle, chapterObjective, gen]);

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
      if (r.percent >= 70) onPassed?.();
      toast.success(`Score: ${r.score}/${r.total} · ${toLetterGrade(r.percent)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    }
  }

  const grade = result ? toLetterGrade(result.percent) : "—";

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
                <div className="text-xs text-muted-foreground">{result.percent}% · {result.percent >= 70 ? "Passed" : "Try again"}</div>
              </div>
              <div className={`text-5xl font-display font-bold ${gradeColor(grade)}`}>{grade}</div>
            </div>
            {questions.map((q, i) => {
              const chosen = answers[q.id];
              const ok = chosen === q.answerIndex;
              return (
                <div key={q.id} className={`rounded-lg border p-4 ${ok ? "border-emerald-500/30" : "border-destructive/40"}`}>
                  <div className="flex items-start gap-2">
                    {ok ? <CheckCircle2 className="h-4 w-4 mt-1 text-emerald-400" /> : <XCircle className="h-4 w-4 mt-1 text-destructive" />}
                    <div className="flex-1 whitespace-pre-wrap text-sm font-medium">Q{i + 1}. {q.prompt}</div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Your answer: <span className={ok ? "text-emerald-400" : "text-destructive"}>{chosen != null ? q.choices[chosen] : "—"}</span>
                    {!ok && <> · Correct: <span className="text-emerald-400">{q.choices[q.answerIndex]}</span></>}
                  </div>
                  {q.explanation && <div className="mt-2 text-xs text-muted-foreground italic">{q.explanation}</div>}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {phase === "taking" && (
            <>
              <span className="text-xs text-muted-foreground mr-auto">{answered}/{questions.length} answered</span>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!allAnswered} onClick={onSubmit}>Submit for grading</Button>
            </>
          )}
          {phase === "review" && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
