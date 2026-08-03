import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getLang, LANGUAGES } from "@/lib/languages";
import { toLetterGrade, gradeColor } from "@/lib/grade";
import { Trophy, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/leaderboard/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} leaderboard — AGITeacher.AI` },
      { name: "description", content: `Top ${params.slug} cadets ranked by certification quiz scores.` },
    ],
  }),
  loader: ({ params }) => {
    const lang = getLang(params.slug);
    if (!lang) throw notFound();
    return { lang };
  },
  errorComponent: ({ error }) => <div className="p-8 text-center text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">Language not found.</div>,
  component: LeaderboardPage,
});

type Row = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  avgPercent: number;
  chaptersTaken: number;
  bestPercent: number;
};

function LeaderboardPage() {
  const { lang } = Route.useLoaderData();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("user_id,chapter,percent")
        .eq("language", lang.slug);
      const byUser = new Map<string, { best: Map<number, number> }>();
      (attempts ?? []).forEach((a) => {
        const entry = byUser.get(a.user_id) ?? { best: new Map<number, number>() };
        const prev = entry.best.get(a.chapter) ?? 0;
        if (a.percent > prev) entry.best.set(a.chapter, a.percent);
        byUser.set(a.user_id, entry);
      });
      const ids = Array.from(byUser.keys());
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] as { id: string; username: string | null; avatar_url: string | null }[] };
      const pmap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
      const list: Row[] = ids.map((uid) => {
        const bests = Array.from(byUser.get(uid)!.best.values());
        const avg = bests.reduce((a, b) => a + b, 0) / bests.length;
        return {
          user_id: uid,
          username: pmap.get(uid)?.username ?? null,
          avatar_url: pmap.get(uid)?.avatar_url ?? null,
          avgPercent: Math.round(avg),
          chaptersTaken: bests.length,
          bestPercent: Math.max(...bests),
        };
      });
      list.sort((a, b) => b.avgPercent - a.avgPercent || b.chaptersTaken - a.chaptersTaken);
      setRows(list.slice(0, 50));
    })();
  }, [lang.slug]);

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/" className="text-muted-foreground hover:text-foreground text-sm inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back</Link>
        <div className="mt-4 flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${lang.accent} font-mono text-sm font-bold text-black/80`}>{lang.icon}</div>
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6 text-primary" /> {lang.name} Leaderboard</h1>
            <p className="text-sm text-muted-foreground">Ranked by average certification score across chapters.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Link key={l.slug} to="/leaderboard/$slug" params={{ slug: l.slug }}
              className={`text-xs px-2 py-1 rounded border ${l.slug === lang.slug ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {l.name}
            </Link>
          ))}
        </div>

        <Card className="mt-6 overflow-hidden">
          <div className="grid grid-cols-[40px_1fr_80px_80px_60px] text-xs font-mono uppercase text-muted-foreground border-b px-4 py-2">
            <div>#</div><div>Cadet</div><div className="text-right">Chapters</div><div className="text-right">Avg %</div><div className="text-right">Grade</div>
          </div>
          {rows == null ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No attempts yet. Be the first — <Link to="/lang/$slug" params={{ slug: lang.slug }} className="text-primary underline">start a quiz</Link>.
            </div>
          ) : rows.map((r, i) => {
            const g = toLetterGrade(r.avgPercent);
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
            return (
              <div key={r.user_id} className="grid grid-cols-[40px_1fr_80px_80px_60px] items-center px-4 py-3 border-b last:border-b-0 text-sm">
                <div className="font-mono text-muted-foreground">{medal}</div>
                <div className="flex items-center gap-2 min-w-0">
                  {r.avatar_url && <img src={r.avatar_url} alt="" className="h-6 w-6 rounded-full" />}
                  <span className="truncate">{r.username ?? "anonymous"}</span>
                </div>
                <div className="text-right text-muted-foreground text-xs">{r.chaptersTaken}/20</div>
                <div className="text-right font-mono">{r.avgPercent}%</div>
                <div className={`text-right font-bold ${gradeColor(g)}`}>{g}</div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
