import type { Lang } from "./languages";

export type RunResult = {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
};

export async function runCode(lang: Lang, code: string, stdin = ""): Promise<RunResult> {
  const res = await fetch("https://emkc.org/api/v2/piston/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: lang.piston.language,
      version: lang.piston.version,
      files: [{ name: lang.piston.filename, content: code }],
      stdin,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Piston error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const run = data.run ?? {};
  const compile = data.compile ?? {};
  const stderr = [compile.stderr, run.stderr].filter(Boolean).join("\n");
  const stdout = run.stdout ?? "";
  return {
    stdout,
    stderr,
    output: (compile.output ?? "") + (run.output ?? ""),
    code: run.code ?? null,
    signal: run.signal ?? null,
  };
}
