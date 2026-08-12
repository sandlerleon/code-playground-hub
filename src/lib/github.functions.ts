import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getGithubStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnection } = await import("./github.server");
    const conn = await getConnection(context.userId);
    return { connected: !!conn, login: conn?.login ?? null };
  });

export const startGithubConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { redirectUri: string; state: string }) => input)
  .handler(async ({ data }) => {
    const clientId = process.env["GITHUB_OAUTH_CLIENT_ID"];
    if (!clientId) throw new Error("GitHub sign-in is not configured yet (missing client ID).");
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", data.redirectUri);
    url.searchParams.set("scope", "repo read:user");
    url.searchParams.set("state", data.state);
    return { authorizationUrl: url.toString() };
  });

export const completeGithubConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; redirectUri: string }) => input)
  .handler(async ({ data, context }) => {
    const clientId = process.env["GITHUB_OAUTH_CLIENT_ID"];
    const clientSecret = process.env["GITHUB_OAUTH_CLIENT_SECRET"];
    if (!clientId || !clientSecret) throw new Error("GitHub sign-in is not configured yet.");

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: data.code,
        redirect_uri: data.redirectUri,
      }),
    });
    const body = (await res.json()) as { access_token?: string; error_description?: string };
    if (!res.ok || !body.access_token) {
      throw new Error(body.error_description ?? `GitHub token exchange failed [${res.status}]`);
    }

    const { ghFetch, saveTokenForUser } = await import("./github.server");
    const me = await ghFetch(body.access_token, "/user");
    if (!me.ok) throw new Error(`GitHub profile lookup failed [${me.status}]`);
    const profile = (await me.json()) as { login: string };
    await saveTokenForUser(context.userId, profile.login, body.access_token);
    return { login: profile.login };
  });

export const disconnectGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { deleteConnection } = await import("./github.server");
    await deleteConnection(context.userId);
    return { ok: true };
  });

export const saveSnippetToGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { languageSlug: string; languageName: string; filename: string; code: string }) => {
      if (!/^[a-z0-9-]{1,40}$/.test(input.languageSlug)) throw new Error("Invalid language");
      if (!/^[\w.-]{1,80}$/.test(input.filename)) throw new Error("Invalid file name");
      if (input.code.length > 500_000) throw new Error("Code is too large");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { getConnection, ensureRepo, putFile } = await import("./github.server");
    const conn = await getConnection(context.userId);
    if (!conn) throw new Error("Connect your GitHub account first.");

    const repo = `agiteacher-${data.languageSlug}`;
    const created = await ensureRepo(
      conn.token,
      conn.login,
      repo,
      `${data.languageName} practice from AGITeacher.AI`,
    );
    await putFile(
      conn.token,
      conn.login,
      repo,
      data.filename,
      data.code,
      `AGITeacher.AI: save ${data.filename}`,
    );
    return {
      created,
      repo,
      login: conn.login,
      url: `https://github.com/${conn.login}/${repo}/blob/main/${data.filename}`,
    };
  });
