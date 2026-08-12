import { decryptToken, encryptToken } from "./github-crypto.server";

const GH = "https://api.github.com";

export async function ghFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GH}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "AGITeacher",
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  return res;
}

export async function saveTokenForUser(userId: string, login: string, token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("github_connections").upsert(
    {
      user_id: userId,
      github_login: login,
      token_ciphertext: encryptToken(token),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function getConnection(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("github_connections")
    .select("github_login, token_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { login: data.github_login, token: decryptToken(data.token_ciphertext) };
}

export async function deleteConnection(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("github_connections").delete().eq("user_id", userId);
}

/** Create the per-language repo if it does not exist yet. */
export async function ensureRepo(token: string, login: string, repo: string, description: string) {
  const existing = await ghFetch(token, `/repos/${login}/${repo}`);
  if (existing.ok) return false;
  if (existing.status !== 404) {
    throw new Error(`GitHub repo lookup failed [${existing.status}]: ${await existing.text()}`);
  }
  const created = await ghFetch(token, `/user/repos`, {
    method: "POST",
    body: JSON.stringify({ name: repo, description, private: false, auto_init: true }),
  });
  if (!created.ok) {
    throw new Error(`Could not create repo [${created.status}]: ${await created.text()}`);
  }
  // auto_init commit can take a moment to become readable
  await new Promise((r) => setTimeout(r, 1200));
  return true;
}

export async function putFile(
  token: string,
  login: string,
  repo: string,
  path: string,
  content: string,
  message: string,
) {
  const head = await ghFetch(token, `/repos/${login}/${repo}/contents/${encodeURI(path)}`);
  let sha: string | undefined;
  if (head.ok) {
    const j = (await head.json()) as { sha?: string };
    sha = j.sha;
  }
  const res = await ghFetch(token, `/repos/${login}/${repo}/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Commit failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as { content?: { html_url?: string } };
}
