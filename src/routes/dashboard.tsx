import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Nav } from "@/components/Nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLang } from "@/lib/languages";
import { Trash2, Globe, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "My Snippets — AI Trainer" }] }),
  component: Dashboard,
});

type Snippet = { id: string; title: string; language: string; updated_at: string; is_public: boolean };

function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    supabase.from("snippets").select("id,title,language,updated_at,is_public").eq("user_id", user.id).order("updated_at", { ascending: false }).then(({ data }) => {
      setSnippets(data ?? []);
      setFetching(false);
    });
  }, [user, loading, nav]);

  async function del(id: string) {
    const { error } = await supabase.from("snippets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSnippets(s => s.filter(x => x.id !== id));
    toast.success("Deleted");
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="font-display text-3xl font-bold">My Snippets</h1>
        <p className="mt-1 text-muted-foreground">Your saved code across languages.</p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fetching ? <div className="text-muted-foreground">Loading…</div> :
            snippets.length === 0 ? (
              <Card className="p-8 col-span-full text-center text-muted-foreground">
                No snippets yet. <Link to="/" className="text-primary underline">Pick a language</Link> to start.
              </Card>
            ) : snippets.map(s => {
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
      </div>
    </div>
  );
}
