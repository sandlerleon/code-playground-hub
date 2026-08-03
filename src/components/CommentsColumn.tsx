import { useCallback, useEffect, useRef, useState } from "react";
import { CommentsThread } from "@/components/CommentsThread";
import { MessagesSquare } from "lucide-react";

const KEY = "comments-col-width";
const MIN = 260;
const MAX = 640;

type Props = { identifier: string; title: string };

/** Permanent, resizable right-hand comments column (dark to match the editor). */
export function CommentsColumn({ identifier, title }: Props) {
  const [width, setWidth] = useState(340);
  const dragging = useRef(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(KEY);
    if (raw) setWidth(Math.min(MAX, Math.max(MIN, Number(raw) || 340)));
  }, []);

  const onMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const next = Math.min(MAX, Math.max(MIN, window.innerWidth - e.clientX));
    setWidth(next);
  }, []);

  const onUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.userSelect = "";
    window.localStorage.setItem(KEY, String(width));
  }, [width]);

  useEffect(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onMove, onUp]);

  return (
    <aside
      className="hidden xl:flex shrink-0 border-l bg-card/40"
      style={{ width }}
      aria-label="Discussion"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={() => {
          dragging.current = true;
          document.body.style.userSelect = "none";
        }}
        className="w-1.5 cursor-col-resize bg-transparent hover:bg-primary/40 transition"
      />
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card/80 backdrop-blur px-4 py-2 text-xs font-mono text-muted-foreground">
          <MessagesSquare className="h-3.5 w-3.5 text-primary" /> Discussion
        </div>
        <div className="p-3">
          <DisqusThread identifier={identifier} title={title} />
        </div>
      </div>
    </aside>
  );
}
