import { createFileRoute, Link } from "@tanstack/react-router";
import { LANGUAGES } from "@/lib/languages";
import { Nav } from "@/components/Nav";
import heroImg from "@/assets/hero.jpg";
import { ArrowRight, Code2, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Trainer — Practice 10 Languages Live" },
      { name: "description", content: "Pick a language room, write code, run it instantly. Save and share like CodePen." },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  return (
    <div className="min-h-screen">
      <Nav />
      <section className="relative overflow-hidden border-b">
        <img src={heroImg} alt="" width={1536} height={768} className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> 10 languages · live execution · save & share
            </div>
            <h1 className="mt-6 font-display text-5xl sm:text-6xl font-bold tracking-tight">
              Train your code.<br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">In any language.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Pick a room, write code in a real editor, hit Run. Each language has its own runtime — no install, no setup.
            </p>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Code2 className="h-4 w-4 text-primary" /> Real runtimes via Piston</span>
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Save & share snippets</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Language rooms</h2>
            <p className="mt-1 text-muted-foreground">Enter a room to start coding</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {LANGUAGES.map((lang) => (
            <Link
              key={lang.slug}
              to="/lang/$slug"
              params={{ slug: lang.slug }}
              className="group relative overflow-hidden rounded-xl border bg-card p-5 transition hover:border-primary/50 hover:glow-primary"
            >
              <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${lang.accent} opacity-20 blur-2xl transition group-hover:opacity-40`} />
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${lang.accent} font-mono text-sm font-bold text-black/80`}>
                {lang.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{lang.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground font-mono">{lang.piston.language} {lang.piston.version}</p>
              <div className="mt-4 flex items-center text-sm text-primary opacity-0 transition group-hover:opacity-100">
                Enter room <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Built with Lovable Cloud · Code execution by Piston
      </footer>
    </div>
  );
}
