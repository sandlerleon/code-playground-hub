import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BookOpen, Check, Circle, Dot } from "lucide-react";
import {
  buildCurriculum,
  loadProgress,
  saveProgress,
  type Chapter,
  type ProgressMap,
} from "@/lib/curriculum";

type Props = {
  slug: string;
  hello: string;
  onOpenChapter: (ch: Chapter) => void;
};

export function CourseSheet({ slug, hello, onOpenChapter }: Props) {
  const chapters = buildCurriculum(slug, hello);
  const [progress, setProgress] = useState<ProgressMap>({});

  useEffect(() => {
    setProgress(loadProgress(slug));
    // refresh when localStorage changes elsewhere
    const onStorage = () => setProgress(loadProgress(slug));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [slug]);

  function setStatus(id: string, s: ProgressMap[string]) {
    setProgress((prev) => {
      const next = { ...prev, [id]: s };
      saveProgress(slug, next);
      return next;
    });
  }

  const completed = Object.values(progress).filter((v) => v === "completed").length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" title="Course content">
          <BookOpen className="h-4 w-4 mr-2" />
          Course
          <span className="ml-2 text-xs text-muted-foreground">{completed}/20</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[380px] sm:w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="capitalize">{slug} — 20 Chapters</SheetTitle>
          <p className="text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Dot className="h-3 w-3 text-muted-foreground" /> not started
            </span>{" "}
            <span className="inline-flex items-center gap-1 ml-2">
              <Circle className="h-3 w-3 text-amber-400 fill-amber-400" /> viewed
            </span>{" "}
            <span className="inline-flex items-center gap-1 ml-2">
              <Check className="h-3 w-3 text-emerald-400" /> completed
            </span>
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
            return (
              <li
                key={ch.id}
                className={`rounded-md border ${rowColor} transition`}
              >
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
                    <span className="block text-xs text-muted-foreground line-clamp-2">
                      {ch.objective}
                    </span>
                  </span>
                  {st === "completed" ? (
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  ) : st === "viewed" ? (
                    <Circle className="h-3 w-3 text-amber-400 fill-amber-400 flex-shrink-0 mt-1" />
                  ) : (
                    <Dot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                <div className="px-3 pb-2 flex gap-2">
                  <button
                    onClick={() =>
                      setStatus(ch.id, st === "completed" ? "viewed" : "completed")
                    }
                    className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/60"
                  >
                    {st === "completed" ? "Mark incomplete" : "Mark complete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
