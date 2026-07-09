import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BookOpen, Check, Circle, Dot, Award } from "lucide-react";
import {
  buildCurriculum,
  loadProgress,
  saveProgress,
  type Chapter,
  type ProgressMap,
} from "@/lib/curriculum";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toLetterGrade, gradeColor } from "@/lib/grade";
import { QuizDialog } from "@/components/QuizDialog";

type Props = {
  slug: string;
  hello: string;
  onOpenChapter: (ch: Chapter) => void;
};

export function CourseSheet({ slug, hello, onOpenChapter }: Props) {
  const chapters = buildCurriculum(slug, hello);
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressMap>({});
  const [best, setBest] = useState<Record<number, number>>({});
  const [quiz, setQuiz] = useState<Chapter | null>(null);

  useEffect(() => {
    setProgress(loadProgress(slug));
    const onStorage = () => setProgress(loadProgress(slug));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [slug]);

  useEffect(() => {
    if (!user) { setBest({}); return; }
    supabase
      .from("quiz_attempts")
      .select("chapter,percent")
      .eq("user_id", user.id)
      .eq("language", slug)
      .then(({ data }) => {
        const map: Record<number, number> = {};
        (data ?? []).forEach((r) => {
          const p = r.percent ?? 0;
          if (map[r.chapter] == null || p > map[r.chapter]) map[r.chapter] = p;
        });
        setBest(map);
      });
  }, [user, slug, quiz]);

  function setStatus(id: string, s: ProgressMap[string]) {
    setProgress((prev) => {
      const next = { ...prev, [id]: s };
      saveProgress(slug, next);
      return next;
    });
  }

  const completed = Object.values(progress).filter((v) => v === "completed").length;

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" title="Course content">
            <BookOpen className="h-4 w-4 mr-2" />
            Course
            <span className="ml-2 text-xs text-muted-foreground">{completed}/20</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[400px] sm:w-[440px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="capitalize">{slug} — 20 Chapters</SheetTitle>
            <p className="text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Dot className="h-3 w-3" /> not started</span>{" "}
              <span className="inline-flex items-center gap-1 ml-2"><Circle className="h-3 w-3 text-amber-400 fill-amber-400" /> viewed</span>{" "}
              <span className="inline-flex items-center gap-1 ml-2"><Check className="h-3 w-3 text-emerald-400" /> completed</span>
            </p>
          </SheetHeader>

          <ol className="mt-4 space-y-1">
            {chapters.map((ch) => {
              const st = progress[ch.id] ?? "none";
              const rowColor =
                st === "completed"
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : st === "viewed"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border hover:bg-accent/40";
              const bestPct = best[ch.n];
              const grade = toLetterGrade(bestPct);
              return (
                <li key={ch.id} className={`rounded-md border ${rowColor} transition`}>
                  <button
                    onClick={() => {
                      if (st === "none") setStatus(ch.id, "viewed");
                      onOpenChapter(ch);
                    }}
                    className="w-full text-left px-3 py-2 flex items-start gap-3"
                  >
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-background border text-xs font-mono">
                      {ch.n}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{ch.title}</span>
                      <span className="block text-xs text-muted-foreground line-clamp-2">{ch.objective}</span>
                    </span>
                    {bestPct != null && (
                      <span className={`text-xs font-mono font-bold ${gradeColor(grade)}`} title={`Best: ${bestPct}%`}>
                        {grade}
                      </span>
                    )}
                  </button>
                  <div className="px-3 pb-2 flex gap-2 items-center">
                    <button
                      onClick={() => setStatus(ch.id, st === "completed" ? "viewed" : "completed")}
                      className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/60"
                    >
                      {st === "completed" ? "Mark incomplete" : "Mark complete"}
                    </button>
                    <button
                      onClick={() => setQuiz(ch)}
                      className="text-[11px] px-2 py-0.5 rounded border border-primary/40 text-primary hover:bg-primary/10 inline-flex items-center gap-1"
                    >
                      <Award className="h-3 w-3" />
                      {bestPct != null ? `Retake (best ${bestPct}%)` : "Take quiz"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </SheetContent>
      </Sheet>

      {quiz && (
        <QuizDialog
          open={!!quiz}
          onOpenChange={(o) => { if (!o) setQuiz(null); }}
          language={slug}
          chapter={quiz.n}
          chapterTitle={quiz.title}
          chapterObjective={quiz.objective}
          onPassed={() => setStatus(quiz.id, "completed")}
        />
      )}
    </>
  );
}
