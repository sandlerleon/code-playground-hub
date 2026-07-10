import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Youtube, ExternalLink } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  language: string;
  chapterTitle?: string;
};

/**
 * Embeds a YouTube search playlist for a chapter/language tutorial.
 * Query targets freeCodeCamp / Bro Code / CodeBootcamp style videos.
 */
export function TuteDialog({ open, onOpenChange, language, chapterTitle }: Props) {
  const query = chapterTitle
    ? `freeCodeCamp ${language} ${chapterTitle} tutorial`
    : `freeCodeCamp ${language} full course tutorial`;
  const embedSrc = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}`;
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
          <span>Search: <span className="font-mono">{query}</span></span>
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
