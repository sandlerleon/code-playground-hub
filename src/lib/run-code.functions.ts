import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  languageId: z.number().int().positive(),
  source: z.string(),
  stdin: z.string().optional().default(""),
});

export type RunCodeResult = {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
};

const b64encode = (s: string) =>
  Buffer.from(s ?? "", "utf-8").toString("base64");
const b64decode = (s: string | null | undefined) =>
  s ? Buffer.from(s, "base64").toString("utf-8") : "";

export const runCodeFn = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<RunCodeResult> => {
    const apiKey = process.env.RAPIDAPI_JUDGE0_KEY;
    if (!apiKey) throw new Error("RAPIDAPI_JUDGE0_KEY is not configured");

    const host = "judge0-ce.p.rapidapi.com";
    const res = await fetch(
      `https://${host}/submissions?base64_encoded=true&wait=true&fields=stdout,stderr,compile_output,message,status,exit_code,exit_signal`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": host,
        },
        body: JSON.stringify({
          language_id: data.languageId,
          source_code: b64encode(data.source),
          stdin: b64encode(data.stdin ?? ""),
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Judge0 error ${res.status}: ${txt.slice(0, 300)}`);
    }
    const j = await res.json();
    const stdout = b64decode(j.stdout);
    const compileOut = b64decode(j.compile_output);
    const stderrRaw = b64decode(j.stderr);
    const message = b64decode(j.message);
    const stderr = [compileOut, stderrRaw, message].filter(Boolean).join("\n");
    return {
      stdout,
      stderr,
      output: stdout + (stderr ? `\n${stderr}` : ""),
      code: typeof j.exit_code === "number" ? j.exit_code : null,
      signal: j.exit_signal ?? null,
    };
  });
