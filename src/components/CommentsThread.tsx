import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Send, Trash2 } from "lucide-react";

type Comment = {
  id: string;
  page_key: string;
  user_id: string;
  author_name: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
};

type Props = { pageKey: string };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Comments powered by Google sign-in, stored in the project database. */
export function CommentsThread({ pageKey }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("page_comments")
      .select("*")
      .eq("page_key", pageKey)
      .order("created_at", { ascending: false })
      .limit(200);
    setComments((data as Comment[]) ?? []);
    setLoading(false);
  }, [pageKey]);

  useEffect(() => {
    setLoading(true);
    void load();
    const ch = supabase
      .channel(`comments:${pageKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "page_comments", filter: `page_key=eq.${pageKey}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [pageKey, load]);

  async function signInGoogle() {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) toast.error("Google sign-in failed");
  }

  async function post() {
    if (!user || !body.trim()) return;
    setBusy(true);
    const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string };
    const { error } = await supabase.from("page_comments").insert({
      page_key: pageKey,
      user_id: user.id,
      author_name: meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "Cadet",
      avatar_url: meta.avatar_url ?? null,
      body: body.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    void load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("page_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  return (
    <div className="space-y-3">
      {user ? (
        <div className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a tip, ask a question…"
            className="w-full h-20 resize-none rounded-md border border-input bg-background p-2 text-sm"
          />
          <Button size="sm" onClick={post} disabled={busy || !body.trim()} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="ml-2">Post comment</span>
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={signInGoogle}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google to comment
        </Button>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments yet. Be the first cadet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-background/60 p-2">
              <div className="flex items-center gap-2">
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    {c.author_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold truncate">{c.author_name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {timeAgo(c.created_at)}
                </span>
                {user?.id === c.user_id && (
                  <button
                    onClick={() => remove(c.id)}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
