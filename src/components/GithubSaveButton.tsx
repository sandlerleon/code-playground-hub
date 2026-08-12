import { useCallback, useEffect, useState } from "react";
import { Github, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  getGithubStatus,
  startGithubConnect,
  saveSnippetToGithub,
} from "@/lib/github.functions";

type Props = {
  languageSlug: string;
  languageName: string;
  filename: string;
  getCode: () => string;
};

/** Connect a GitHub account and push the current file to agiteacher-<language>. */
export function GithubSaveButton({ languageSlug, languageName, filename, getCode }: Props) {
  const { user } = useAuth();
  const [login, setLogin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return setLogin(null);
    try {
      const s = await getGithubStatus();
      setLogin(s.connected ? s.login : null);
    } catch {
      setLogin(null);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect() {
    if (!user) return toast.error("Sign in first to link GitHub");
    const popup = window.open("", "github-oauth", "width=700,height=800");
    if (!popup) return toast.error("Popup blocked — allow popups and try again");
    setBusy(true);
    try {
      const state = crypto.randomUUID();
      window.sessionStorage.setItem("github-oauth-state", state);
      const { authorizationUrl } = await startGithubConnect({
        data: { redirectUri: `${window.location.origin}/oauth/github/return`, state },
      });
      const result = await new Promise<{ ok: boolean; detail?: string }>((resolve, reject) => {
        const onMsg = (e: MessageEvent) => {
          if (e.origin !== window.location.origin || e.data?.type !== "github-oauth") return;
          cleanup();
          resolve(e.data as { ok: boolean; detail?: string });
        };
        const poll = window.setInterval(() => {
          if (!popup.closed) return;
          cleanup();
          reject(new Error("GitHub window closed before finishing"));
        }, 600);
        function cleanup() {
          window.removeEventListener("message", onMsg);
          window.clearInterval(poll);
        }
        window.addEventListener("message", onMsg);
        popup.location.href = authorizationUrl;
      });
      if (!result.ok) throw new Error(result.detail ?? "GitHub connection failed");
      await refresh();
      toast.success("GitHub connected");
    } catch (e) {
      popup.close();
      toast.error(e instanceof Error ? e.message : "GitHub connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function push() {
    setBusy(true);
    try {
      const res = await saveSnippetToGithub({
        data: { languageSlug, languageName, filename, code: getCode() },
      });
      toast.success(res.created ? `Created ${res.repo} and saved` : `Saved to ${res.repo}`, {
        action: { label: "Open", onClick: () => window.open(res.url, "_blank") },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save to GitHub");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={login ? push : connect}
      disabled={busy}
      title={
        login
          ? `Save to github.com/${login}/agiteacher-${languageSlug}`
          : "Sign in with GitHub to save your code to your own repo"
      }
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
      <span className="ml-2">{login ? "Save to GitHub" : "Sign in with GitHub"}</span>
    </Button>
  );
}
