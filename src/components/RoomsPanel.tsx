import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, X, Plus, Hash, Trash2, Filter } from "lucide-react";
import { RoomView, type Room } from "./RoomView";
import { toast } from "sonner";

type Props = {
  language: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  /** When set (and changes), open panel, filter to chapter and preselect it in the create form. */
  focusChapter?: number | null;
  /** Bumped by parent to re-trigger focus even if focusChapter value is unchanged. */
  focusToken?: number;
};

export function RoomsPanel({ language, open: openProp, onOpenChange, focusChapter, focusToken }: Props) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => {
    if (onOpenChange) onOpenChange(o);
    else setOpenState(o);
  };

  const [rooms, setRooms] = useState<Room[]>([]);
  const [active, setActive] = useState<Room | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterChapter, setFilterChapter] = useState<number | null>(null);
  const { user } = useAuth();

  // form state
  const [name, setName] = useState("");
  const [chapter, setChapter] = useState<string>("");
  const [mode, setMode] = useState<"active" | "passive">("active");

  // React to parent focus requests
  useEffect(() => {
    if (focusChapter == null) return;
    setOpen(true);
    setActive(null);
    setFilterChapter(focusChapter);
    setChapter(String(focusChapter));
    setShowCreate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusChapter, focusToken]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    supabase
      .from("chat_rooms")
      .select("*")
      .eq("language", language)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (mounted && data) setRooms(data as Room[]);
      });
    const ch = supabase
      .channel(`rooms-list:${language}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_rooms", filter: `language=eq.${language}` },
        (p) => {
          setRooms((prev) => {
            if (p.eventType === "INSERT") return [p.new as Room, ...prev];
            if (p.eventType === "DELETE")
              return prev.filter((r) => r.id !== (p.old as { id: string }).id);
            if (p.eventType === "UPDATE")
              return prev.map((r) => (r.id === (p.new as Room).id ? (p.new as Room) : r));
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [open, language]);

  async function createRoom() {
    if (!user) {
      toast.error("Sign in to create a room");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    const ch = chapter.trim() ? Number(chapter) : null;
    const { data, error } = await supabase
      .from("chat_rooms")
      .insert({
        name: trimmed,
        language,
        chapter: ch,
        mode,
        creator_id: user.id,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setShowCreate(false);
    setName("");
    setActive(data as Room);
  }

  async function deleteRoom(r: Room) {
    if (!user || r.creator_id !== user.id) return;
    if (!confirm(`Delete "${r.name}"?`)) return;
    const { error } = await supabase.from("chat_rooms").delete().eq("id", r.id);
    if (error) toast.error(error.message);
  }

  const visibleRooms = filterChapter == null
    ? rooms
    : rooms.filter((r) => r.chapter === filterChapter);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-[calc(1.5rem+440px)] z-50 flex items-center gap-2 rounded-full bg-card border border-border shadow-lg px-3 py-2 hover:bg-accent transition"
          aria-label="Open crew rooms"
        >
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Crew rooms</span>
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-[calc(1.5rem+440px)] z-50 w-[min(380px,calc(100vw-2rem))] h-[min(600px,calc(100vh-6rem))] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          {active ? (
            <RoomView room={active} onBack={() => setActive(null)} />
          ) : (
            <>
              <div className="flex items-center gap-2 border-b bg-gradient-to-r from-accent/20 to-transparent px-3 py-2">
                <Users className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Crew rooms · {language}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    Chat, voice, and Hologram Jenny
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCreate((s) => !s)}
                  title="New room"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Chapter filter bar */}
              <div className="flex items-center gap-2 border-b bg-background/40 px-3 py-1.5 text-[11px]">
                <Filter className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Filter:</span>
                <button
                  onClick={() => setFilterChapter(null)}
                  className={`px-2 py-0.5 rounded border ${filterChapter == null ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                >
                  All
                </button>
                {filterChapter != null && (
                  <span className="px-2 py-0.5 rounded border border-primary text-primary">
                    Ch {filterChapter}
                  </span>
                )}
                <Input
                  placeholder="ch #"
                  value={filterChapter ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setFilterChapter(v ? Number(v) : null);
                  }}
                  className="h-6 w-14 text-[11px] ml-auto"
                />
              </div>

              {showCreate && (
                <div className="space-y-2 border-b bg-background/50 p-3">
                  {!user && (
                    <p className="text-xs text-destructive">Sign in to create a room.</p>
                  )}
                  <Input
                    placeholder="Room name (e.g. Loops study group)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Chapter # (optional)"
                      value={chapter}
                      onChange={(e) => setChapter(e.target.value.replace(/\D/g, ""))}
                      className="h-8 text-sm"
                    />
                    <Select value={mode} onValueChange={(v) => setMode(v as "active" | "passive")}>
                      <SelectTrigger className="h-8 text-xs w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active" className="text-xs">
                          Jenny active
                        </SelectItem>
                        <SelectItem value="passive" className="text-xs">
                          @jenny only
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={createRoom}
                    disabled={!name.trim() || !user}
                  >
                    Create room
                  </Button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {visibleRooms.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground">
                    {filterChapter != null
                      ? `No rooms yet for chapter ${filterChapter}. Create the first one!`
                      : "No rooms yet. Create one to start collaborating on a chapter."}
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {visibleRooms.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-accent/40"
                      >
                        <button
                          onClick={() => setActive(r)}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Hash className="h-3 w-3 text-muted-foreground" />
                            {r.name}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {r.chapter ? `ch ${r.chapter} · ` : ""}
                            Jenny {r.mode === "active" ? "moderating" : "on call"}
                          </div>
                        </button>
                        {user && r.creator_id === user.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => void deleteRoom(r)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
