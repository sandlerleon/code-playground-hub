import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Youtube, ExternalLink } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  language: string;
  chapterTitle?: string;
};

/** Known-good full-course video IDs (W3Schools / freeCodeCamp style tutorials). */
const VIDEOS: Record<string, string> = {
  javascript: "PkZNo7MFNFg",
  python: "rfscVS0vtbw",
  typescript: "30LWjhZzg50",
  java: "A74TOX803D0",
  cpp: "vLnPwxZdW4Y",
  csharp: "GhQdlIFylQ8",
  go: "yyUHQIec83I",
  rust: "MsocPEZBd-M",
  php: "OK_JCtrrv-c",
  ruby: "t_ispmWmdjY",
};

/** Embeds a working YouTube tutorial for a language (optionally scoped to a chapter). */
export function TuteDialog({ open, onOpenChange, language, chapterTitle }: Props) {
  const videoId = VIDEOS[language] ?? VIDEOS.javascript;
  const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
  const query = chapterTitle
    ? `w3schools ${language} ${chapterTitle} tutorial`
    : `w3schools ${language} full course tutorial`;
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            Tute · <span className="capitalize">{language}</span>
            {chapterTitle && <span className="text-muted-foreground font-normal">— {chapterTitle}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-md border bg-black">
          <iframe
            key={embedSrc}
            src={embedSrc}
            title="YouTube tutorial"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>More: <span className="font-mono">{query}</span></span>
          <a
            href={searchUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Open on YouTube <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
