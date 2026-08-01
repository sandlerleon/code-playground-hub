import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Nav } from "@/components/Nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLang, LANGUAGES } from "@/lib/languages";
import { Trash2, Globe, Lock, Trophy, Save } from "lucide-react";
import { toast } from "sonner";
import { toLetterGrade, gradeColor } from "@/lib/grade";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard — Eliptum.com" }] }),
  component: Dashboard,
});

type Snippet = { id: string; title: string; language: string; updated_at: string; is_public: boolean };
type Attempt = { language: string; chapter: number; percent: number };
type Profile = { username: string | null; full_name: string | null; avatar_url: string | null };

function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [profile, setProfile] = useState<Profile>({ username: "", full_name: "", avatar_url: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    (async () => {
      const [{ data: s }, { data: a }, { data: p }] = await Promise.all([
        supabase.from("snippets").select("id,title,language,updated_at,is_public").eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("quiz_attempts").select("language,chapter,percent").eq("user_id", user.id),
        supabase.from("profiles").select("username,full_name,avatar_url").eq("id", user.id).maybeSingle(),
      ]);
      setSnippets(s ?? []);
      setAttempts(a ?? []);
      if (p) setProfile({ username: p.username ?? "", full_name: p.full_name ?? "", avatar_url: p.avatar_url ?? "" });
      setFetching(false);
    })();
  }, [user, loading, nav]);

  async function del(id: string) {
    const { error } = await supabase.from("snippets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSnippets((s) => s.filter((x) => x.id !== id));
    toast.success("Deleted");
  }

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({
      username: profile.username || null,
      full_name: profile.full_name || null,
      avatar_url: profile.avatar_url || null,
    }).eq("id", user.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  }

  // Per-language: best-per-chapter → avg
  const perLang = LANGUAGES.map((l) => {
    const rows = attempts.filter((a) => a.language === l.slug);
    if (!rows.length) return { lang: l, avg: null as number | null, chapters: 0 };
    const best = new Map<number, number>();
    rows.forEach((r) => {
      const prev = best.get(r.chapter) ?? 0;
      if (r.percent > prev) best.set(r.chapter, r.percent);
    });
    const vals = Array.from(best.values());
    return { lang: l, avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), chapters: vals.length };
  });
  const overallVals = perLang.map((p) => p.avg).filter((v): v is number => v != null);
  const overallAvg = overallVals.length ? Math.round(overallVals.reduce((a, b) => a + b, 0) / overallVals.length) : null;
  const overallGrade = toLetterGrade(overallAvg);

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        {/* Personal Information */}
        <section>
          <h1 className="font-display text-3xl font-bold">Personal Information</h1>
          <Card className="mt-4 p-6 grid gap-6 md:grid-cols-[1fr_auto] items-center">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Full name</Label>
                <Input value={profile.full_name ?? ""} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} placeholder="Ada Lovelace" />
              </div>
              <div className="space-y-1">
                <Label>Username</Label>
                <Input value={profile.username ?? ""} onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))} placeholder="ada" />
              </div>
              <div className="space-y-1">
                <Label>Avatar URL</Label>
                <Input value={profile.avatar_url ?? ""} onChange={(e) => setProfile((p) => ({ ...p, avatar_url: e.target.value }))} placeholder="https://…" />
              </div>
              <div className="sm:col-span-3">
                <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
                  <Save className="h-4 w-4 mr-2" />Save profile
                </Button>
              </div>
            </div>
            <div className="text-center border-l pl-6">
              <div className="text-xs text-muted-foreground font-mono uppercase">Overall Grade</div>
              <div className={`font-display text-6xl font-bold ${gradeColor(overallGrade)}`}>{overallGrade}</div>
              <div className="text-xs text-muted-foreground">{overallAvg != null ? `${overallAvg}% avg` : "No quizzes yet"}</div>
            </div>
          </Card>
        </section>

        {/* Grades per language */}
        <section>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Certification Grades</h2>
          <p className="text-sm text-muted-foreground">One letter grade per language, computed from your best chapter scores.</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {perLang.map(({ lang, avg, chapters }) => {
              const g = toLetterGrade(avg);
              return (
                <Card key={lang.slug} className="p-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded bg-gradient-to-br ${lang.accent} flex items-center justify-center text-[10px] font-mono font-bold text-black/80`}>{lang.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{lang.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{chapters}/20 chapters</div>
                    </div>
                    <div className={`text-2xl font-display font-bold ${gradeColor(g)}`}>{g}</div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link to="/lang/$slug" params={{ slug: lang.slug }} className="text-[11px] text-primary hover:underline">Study</Link>
                    <Link to="/leaderboard/$slug" params={{ slug: lang.slug }} className="text-[11px] text-muted-foreground hover:text-foreground ml-auto">Leaderboard →</Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Snippets */}
        <section>
          <h2 className="font-display text-2xl font-bold">My Snippets</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fetching ? <div className="text-muted-foreground">Loading…</div> :
              snippets.length === 0 ? (
                <Card className="p-8 col-span-full text-center text-muted-foreground">
                  No snippets yet. <Link to="/" className="text-primary underline">Pick a language</Link> to start.
                </Card>
              ) : snippets.map((s) => {
                const lang = getLang(s.language);
                return (
                  <Card key={s.id} className="p-4 group hover:border-primary/50 transition">
                    <div className="flex items-start justify-between">
                      <Link to="/lang/$slug" params={{ slug: s.language }} search={{ snippet: s.id }} className="flex-1">
                        <div className="flex items-center gap-2">
                          {lang && <div className={`h-7 w-7 rounded bg-gradient-to-br ${lang.accent} flex items-center justify-center text-[10px] font-mono font-bold text-black/80`}>{lang.icon}</div>}
                          <span className="font-semibold">{s.title}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                          {s.is_public ? <><Globe className="h-3 w-3" /> Public</> : <><Lock className="h-3 w-3" /> Private</>}
                          · {new Date(s.updated_at).toLocaleDateString()}
                        </div>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => del(s.id)} className="opacity-0 group-hover:opacity-100">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
          </div>
        </section>
      </div>
    </div>
  );
}
