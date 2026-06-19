import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { getLang } from "@/lib/languages";
import { runCode, type RunResult } from "@/lib/piston";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Play, Save, Loader2, ArrowLeft, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({ snippet: z.string().optional() });

export const Route = createFileRoute("/lang/$slug")({
  validateSearch: searchSchema,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} room — AI Trainer` },
      { name: "description", content: `Write and run ${params.slug} code in your browser.` },
    ],
  }),
  loader: ({ params }) => {
    const lang = getLang(params.slug);
    if (!lang) throw notFound();
    return { lang };
  },
  errorComponent: ({ error }) => <div className="p-8 text-center text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">Language not found.</div>,
  component: Room,
});

function Room() {
  const { lang } = Route.useLoaderData();
  const { snippet: snippetId } = useSearch({ from: "/lang/$slug" });
  const nav = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState(lang.hello);
  const [title, setTitle] = useState("Untitled");
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    if (!snippetId) {
      setCode(lang.hello);
      setTitle("Untitled");
      setCurrentId(null);
      return;
    }
    supabase.from("snippets").select("*").eq("id", snippetId).maybeSingle().then(({ data }) => {
      if (data) {
        setCode(data.code);
        setTitle(data.title);
        setCurrentId(data.id);
      }
    });
  }, [snippetId, lang.hello]);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const r = await runCode(lang, code, stdin);
      setResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  async function save() {
    if (!user) { toast.error("Sign in to save"); nav({ to: "/auth" }); return; }
    setSaving(true);
    if (currentId) {
      const { error } = await supabase.from("snippets").update({ code, title }).eq("id", currentId);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Saved");
    } else {
      const { data, error } = await supabase.from("snippets").insert({ user_id: user.id, language: lang.slug, code, title }).select().single();
      setSaving(false);
      if (error) return toast.error(error.message);
      if (data) {
        setCurrentId(data.id);
        nav({ to: "/lang/$slug", params: { slug: lang.slug }, search: { snippet: data.id } });
        toast.success("Saved");
      }
    }
  }

  async function share() {
    if (!currentId) { toast.error("Save first"); return; }
    const { error } = await supabase.from("snippets").update({ is_public: true }).eq("id", currentId);
    if (error) return toast.error(error.message);
    const url = `${window.location.origin}/lang/${lang.slug}?snippet=${currentId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Public link copied to clipboard");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <div className="border-b bg-card/40">
        <div className="mx-auto max-w-7xl flex items-center gap-4 px-6 py-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div className={`flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br ${lang.accent} font-mono text-xs font-bold text-black/80`}>{lang.icon}</div>
          <div className="flex-1">
            <Input value={title} onChange={e=>setTitle(e.target.value)} className="h-8 max-w-xs border-transparent bg-transparent text-base font-semibold focus-visible:border-input" />
            <div className="text-xs text-muted-foreground font-mono">{lang.name} · {lang.piston.version}</div>
          </div>
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} <span className="ml-2">Save</span>
          </Button>
          <Button variant="outline" size="sm" onClick={share} disabled={!currentId}>
            <Share2 className="h-4 w-4 mr-2" />Share
          </Button>
          <Button size="sm" onClick={run} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} <span className="ml-2">Run</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 mx-auto w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <Card className="overflow-hidden flex flex-col">
          <div className="border-b px-4 py-2 text-xs font-mono text-muted-foreground">{lang.piston.filename}</div>
          <div className="flex-1 min-h-[400px]">
            <Editor
              height="100%"
              language={lang.monaco}
              theme="vs-dark"
              value={code}
              onChange={(v)=>setCode(v ?? "")}
              options={{ fontSize: 14, minimap: { enabled: false }, fontFamily: "JetBrains Mono, monospace", padding: { top: 12 } }}
            />
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="text-xs font-mono text-muted-foreground mb-2">STDIN (optional)</div>
            <textarea
              value={stdin} onChange={e=>setStdin(e.target.value)}
              placeholder="Input passed to your program..."
              className="w-full h-20 rounded-md bg-background border border-input p-2 font-mono text-sm resize-none"
            />
          </Card>
          <Card className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b px-4 py-2 text-xs font-mono text-muted-foreground flex items-center justify-between">
              <span>Output</span>
              {result && <span className={result.code === 0 ? "text-primary" : "text-destructive"}>exit {result.code}</span>}
            </div>
            <pre className="flex-1 overflow-auto p-4 text-sm font-mono whitespace-pre-wrap min-h-[200px]">
              {running ? "Running…" : result ? (
                <>
                  {result.stdout && <span>{result.stdout}</span>}
                  {result.stderr && <span className="text-destructive">{result.stderr}</span>}
                  {!result.stdout && !result.stderr && <span className="text-muted-foreground">(no output)</span>}
                </>
              ) : <span className="text-muted-foreground">Click Run to execute your code.</span>}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
}
