import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { completeGithubConnect } from "@/lib/github.functions";

export const Route = createFileRoute("/oauth/github/return")({
  head: () => ({
    meta: [
      { title: "Connecting GitHub — AGITeacher.AI" },
      { name: "description", content: "Finishing your GitHub connection for AGITeacher.AI." },
    ],
  }),
  component: GithubReturn,
});

function GithubReturn() {
  const [message, setMessage] = useState("Finishing your GitHub connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const done = (ok: boolean, detail?: string) => {
      window.opener?.postMessage({ type: "github-oauth", ok, detail }, window.location.origin);
      if (ok) window.close();
    };
    const err = params.get("error_description") ?? params.get("error");
    if (err) {
      setMessage(err);
      done(false, err);
      return;
    }
    const code = params.get("code");
    const state = params.get("state");
    const expected = window.sessionStorage.getItem("github-oauth-state");
    if (!code || !state || state !== expected) {
      setMessage("This GitHub sign-in link is invalid or expired.");
      done(false, "invalid_state");
      return;
    }
    window.sessionStorage.removeItem("github-oauth-state");
    void completeGithubConnect({
      data: { code, redirectUri: `${window.location.origin}/oauth/github/return` },
    })
      .then(() => done(true))
      .catch((e: unknown) => {
        const detail = e instanceof Error ? e.message : "Connection failed";
        setMessage(detail);
        done(false, detail);
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
