import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, X, Send } from "lucide-react";

type Msg = { id: string; from: string; text: string; ts: number };

type Props = {
  room: string; // default room = language slug
  displayName?: string;
};

export function PeerChat({ room: initialRoom, displayName }: Props) {
  const [open, setOpen] = useState(false);
  const [room, setRoom] = useState(initialRoom);
  const [name] = useState<string>(() => {
    if (typeof window === "undefined") return displayName ?? "Cadet";
    return (
      window.localStorage.getItem("peer-name") ??
      displayName ??
      `Cadet-${Math.random().toString(36).slice(2, 6)}`
    );
  });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [peers, setPeers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.setItem("peer-name", name);
  }, [name]);

  const channelName = useMemo(() => `peerchat:${room}`, [room]);

  useEffect(() => {
    if (!open) return;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: name }, broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "msg" }, ({ payload }) => {
        setMessages((prev) => [...prev, payload as Msg]);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPeers(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name, joined: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setPeers([]);
    };
  }, [channelName, name, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    const msg: Msg = {
      id: crypto.randomUUID(),
      from: name,
      text,
      ts: Date.now(),
    };
    setInput("");
    setMessages((prev) => [...prev, msg]);
    await supabase.channel(channelName).send({
      type: "broadcast",
      event: "msg",
      payload: msg,
    });
    // The above ad-hoc channel doesn't guarantee subscription; use the subscribed one via singleton
    // Simpler: re-fetch stored channel via supabase.getChannels()
  }

  // Better: keep a ref to the subscribed channel
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!open) return;
    const c = supabase.channel(channelName, {
      config: { presence: { key: name }, broadcast: { self: false } },
    });
    c.on("broadcast", { event: "msg" }, ({ payload }) => {
      setMessages((prev) =>
        prev.some((m) => m.id === (payload as Msg).id) ? prev : [...prev, payload as Msg],
      );
    })
      .on("presence", { event: "sync" }, () => {
        setPeers(Object.keys(c.presenceState()));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await c.track({ name });
      });
    chanRef.current = c;
    return () => {
      supabase.removeChannel(c);
      chanRef.current = null;
    };
  }, [channelName, name, open]);

  async function sendReal() {
    const text = input.trim();
    if (!text || !chanRef.current) return;
    const msg: Msg = { id: crypto.randomUUID(), from: name, text, ts: Date.now() };
    setInput("");
    setMessages((prev) => [...prev, msg]);
    await chanRef.current.send({ type: "broadcast", event: "msg", payload: msg });
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-[calc(1.5rem+440px)] z-50 flex items-center gap-2 rounded-full bg-card border border-border shadow-lg px-3 py-2 hover:bg-accent transition"
          aria-label="Open peer chat"
        >
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Crew chat</span>
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-[calc(1.5rem+440px)] z-50 w-[min(340px,calc(100vw-2rem))] h-[min(520px,calc(100vh-6rem))] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-gradient-to-r from-accent/20 to-transparent">
            <Users className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">Crew chat</div>
              <div className="text-[11px] font-mono text-muted-foreground truncate">
                room: {room} · {peers.length} online
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-3 py-2 border-b flex gap-2 items-center">
            <label className="text-[11px] text-muted-foreground">Room</label>
            <Input
              value={room}
              onChange={(e) => setRoom(e.target.value.trim() || initialRoom)}
              className="h-7 text-xs"
            />
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No messages yet. Share the room name with a friend to chat here.
              </p>
            )}
            {messages.map((m) => {
              const mine = m.from === name;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={
                      mine
                        ? "max-w-[80%] rounded-lg bg-primary text-primary-foreground px-2 py-1 text-sm"
                        : "max-w-[80%] rounded-lg bg-background border border-border px-2 py-1 text-sm"
                    }
                  >
                    {!mine && (
                      <div className="text-[10px] font-mono text-muted-foreground">{m.from}</div>
                    )}
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t p-2 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendReal();
                }
              }}
              placeholder={`Message as ${name}…`}
              className="h-9"
            />
            <Button size="icon" onClick={() => void sendReal()} disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
