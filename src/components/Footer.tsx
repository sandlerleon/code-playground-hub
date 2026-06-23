import { Github } from "lucide-react";

const DEFAULT_REPO = "https://github.com/sandlerleon/ai-trainer-app";
const REPO = (import.meta.env?.VITE_GITHUB_REPO_URL as string | undefined) || DEFAULT_REPO;
const PROMPTS_URL = `${REPO}/blob/main/PROMPTS.md`;

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/80 backdrop-blur-sm z-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-3">
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            <span>GitHub repository</span>
          </a>
          <span className="hidden sm:inline">·</span>
          <a
            href={PROMPTS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Build prompts (README)
          </a>
        </div>
        <div>Built with Lovable</div>
      </div>
    </footer>
  );
}
