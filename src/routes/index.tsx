import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LANGUAGES } from "@/lib/languages";
import { Nav } from "@/components/Nav";
import { TuteDialog } from "@/components/TuteDialog";
import heroImg from "@/assets/hero.jpg";
import { ArrowRight, Code2, Sparkles, Users, Youtube } from "lucide-react";

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
  const [tute, setTute] = useState<string | null>(null);
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
              Train you to code.<br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">In any language with AI Teacher.</span>
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
            <div
              key={lang.slug}
              className="group relative overflow-hidden rounded-xl border bg-card p-5 transition hover:border-primary/50 hover:glow-primary"
            >
              <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${lang.accent} opacity-20 blur-2xl transition group-hover:opacity-40`} />
              <Link to="/lang/$slug" params={{ slug: lang.slug }} className="block">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${lang.accent} font-mono text-sm font-bold text-black/80`}>
                  {lang.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{lang.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground font-mono">{lang.piston.language} {lang.piston.version}</p>
              </Link>
              <div className="mt-4 flex items-center justify-between text-sm">
                <Link to="/lang/$slug" params={{ slug: lang.slug }} className="text-primary inline-flex items-center">
                  Enter room <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTute(lang.slug)}
                    className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                    title="Video tutorial"
                  >
                    <Youtube className="h-3 w-3" /> Tute
                  </button>
                  <Link to="/leaderboard/$slug" params={{ slug: lang.slug }} className="text-xs text-muted-foreground hover:text-primary">
                    🏆
                  </Link>
                </div>
              </div>
            </div>
          ))}

        </div>
      </section>

      <footer className="border-t bg-gradient-to-b from-transparent to-primary/5">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-2xl border border-primary/30 bg-card p-8 text-center shadow-lg">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> Next mission after graduation
            </div>
            <h3 className="mt-4 font-display text-2xl font-bold">
              Ready for real-world projects? Continue your journey at freeCodeCamp.
            </h3>
            <p className="mt-3 text-sm text-muted-foreground max-w-2xl mx-auto">
              Once you've graduated from Space Academy, level up with freeCodeCamp's free,
              community-driven curriculum: full-stack web development, data science, machine
              learning, and industry-recognized certifications. Thousands of hours of hands-on
              projects — completely free, forever.
            </p>
            <a
              href="https://www.freecodecamp.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
            >
              Continue at freeCodeCamp.org <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            <strong>Credit &amp; acknowledgement:</strong> Space Academy is an independent training
            simulator inspired by the open education movement. Video tutorials embedded in the
            course are sourced from the{" "}
            <a
              href="https://www.youtube.com/@freecodecamp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              freeCodeCamp YouTube channel
            </a>{" "}
            and the coding-music stream is provided courtesy of{" "}
            <a
              href="https://coderadio.freecodecamp.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              CodeRadio by freeCodeCamp
            </a>
            . freeCodeCamp.org is a donor-supported 501(c)(3) nonprofit — all credit for their
            world-class free curriculum belongs to them. This project is not affiliated with or
            endorsed by freeCodeCamp.
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Built with Lovable Cloud · Code execution by Piston
          </p>
        </div>
      </footer>
      {tute && (
        <TuteDialog open={!!tute} onOpenChange={(o) => { if (!o) setTute(null); }} language={tute} />
      )}
    </div>
  );
}
