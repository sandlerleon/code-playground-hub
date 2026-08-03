import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { jennyModerate } from "@/lib/rooms.functions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Send, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import jennyImg from "@/assets/jenny.jpg";
import ReactMarkdown from "react-markdown";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type Room = {
  id: string;
  name: string;
  language: string;
  chapter: number | null;
  mode: "active" | "passive";
  creator_id: string | null;
};

type Msg = {
  id: string;
  room_id: string;
  user_id: string | null;
  author_name: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
};

type Props = {
  room: Room;
  onBack: () => void;
};

export function RoomView({ room, onBack }: Props) {
  const { user } = useAuth();
  const authorName =
    user?.email?.split("@")[0] ??
    (typeof window !== "undefined"
      ? window.localStorage.getItem("peer-name") ?? "cadet"
      : "cadet");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [peers, setPeers] = useState<string[]>([]);
  const [onlineNames, setOnlineNames] = useState<string[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [remoteAudio, setRemoteAudio] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moderateFn = useServerFn(jennyModerate);

  const myPeerId = useMemo(
    () => `${authorName}-${Math.random().toString(36).slice(2, 8)}`,
    [authorName],
  );

  // ---- Load message history + realtime ----
  useEffect(() => {
    let mounted = true;
    supabase
      .from("room_messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (mounted && data) setMessages(data as Msg[]);
      });
    const ch = supabase
      .channel(`room-msgs:${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` },
        (p) => setMessages((prev) => [...prev, p.new as Msg]),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [room.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ---- Voice mesh over Supabase signaling ----
  const sigRef = useRef<RealtimeChannel | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const ch = supabase.channel(`room-voice:${room.id}`, {
      config: { presence: { key: myPeerId }, broadcast: { self: false } },
    });

    async function makePc(peerId: string): Promise<RTCPeerConnection> {
      const existing = pcsRef.current.get(peerId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void ch.send({
            type: "broadcast",
            event: "sig",
            payload: { kind: "ice", from: myPeerId, to: peerId, data: e.candidate.toJSON() },
          });
        }
      };
      pc.ontrack = (e) => {
        let audio = audiosRef.current.get(peerId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audiosRef.current.set(peerId, audio);
        }
        audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
        audio.muted = !voiceOn;
        setRemoteAudio((n) => n + 1);
      };
      if (localStreamRef.current) {
        for (const t of localStreamRef.current.getTracks()) pc.addTrack(t, localStreamRef.current);
      }
      pcsRef.current.set(peerId, pc);
      return pc;
    }

    async function initiate(peerId: string) {
      const pc = await makePc(peerId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      void ch.send({
        type: "broadcast",
        event: "sig",
        payload: { kind: "offer", from: myPeerId, to: peerId, data: offer },
      });
    }

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const ids = Object.keys(state).filter((k) => k !== myPeerId);
      setPeers(Object.keys(state));
      setOnlineNames(
        Object.entries(state).map(([key, metas]) => {
          const m = (metas as unknown as { name?: string }[])[0];
          return m?.name ?? key.split("-")[0] ?? "cadet";
        }),
      );
      // Deterministic initiator: lower id initiates
      if (localStreamRef.current) {
        for (const pid of ids) {
          if (!pcsRef.current.has(pid) && myPeerId < pid) void initiate(pid);
        }
      }
    });

    ch.on("broadcast", { event: "sig" }, async ({ payload }) => {
      const p = payload as {
        kind: "offer" | "answer" | "ice";
        from: string;
        to: string;
        data: RTCSessionDescriptionInit | RTCIceCandidateInit;
      };
      if (p.to !== myPeerId) return;
      const pc = await makePc(p.from);
      try {
        if (p.kind === "offer") {
          await pc.setRemoteDescription(p.data as RTCSessionDescriptionInit);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          void ch.send({
            type: "broadcast",
            event: "sig",
            payload: { kind: "answer", from: myPeerId, to: p.from, data: answer },
          });
        } else if (p.kind === "answer") {
          await pc.setRemoteDescription(p.data as RTCSessionDescriptionInit);
        } else if (p.kind === "ice") {
          try {
            await pc.addIceCandidate(p.data as RTCIceCandidateInit);
          } catch {
            /* races */
          }
        }
      } catch (e) {
        console.error("signaling", e);
      }
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ name: authorName });
    });
    sigRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      sigRef.current = null;
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      audiosRef.current.forEach((a) => {
        a.pause();
        a.srcObject = null;
      });
      audiosRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, myPeerId]);

  // Apply mute toggle to remote audio elements
  useEffect(() => {
    audiosRef.current.forEach((a) => (a.muted = !voiceOn));
  }, [voiceOn, remoteAudio]);

  async function toggleMic() {
    if (micOn) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      // Remove tracks from peer connections
      pcsRef.current.forEach((pc) => {
        pc.getSenders().forEach((s) => {
          if (s.track) pc.removeTrack(s);
        });
      });
      setMicOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setMicOn(true);
      const ch = sigRef.current;
      if (!ch) return;
      // Attach tracks to existing PCs
      pcsRef.current.forEach((pc) => {
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      });
      // Initiate with peers we don't yet have PCs to (that have higher id)
      const state = ch.presenceState();
      const ids = Object.keys(state).filter((k) => k !== myPeerId);
      for (const pid of ids) {
        if (!pcsRef.current.has(pid) && myPeerId < pid) {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          pc.onicecandidate = (e) => {
            if (e.candidate)
              void ch.send({
                type: "broadcast",
                event: "sig",
                payload: { kind: "ice", from: myPeerId, to: pid, data: e.candidate.toJSON() },
              });
          };
          pc.ontrack = (e) => {
            let audio = audiosRef.current.get(pid);
            if (!audio) {
              audio = new Audio();
              audio.autoplay = true;
              audiosRef.current.set(pid, audio);
            }
            audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
            audio.muted = !voiceOn;
            setRemoteAudio((n) => n + 1);
          };
          stream.getTracks().forEach((t) => pc.addTrack(t, stream));
          pcsRef.current.set(pid, pc);
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          void ch.send({
            type: "broadcast",
            event: "sig",
            payload: { kind: "offer", from: myPeerId, to: pid, data: offer },
          });
        } else {
          // Re-negotiate so newly added tracks are sent
          const pc = pcsRef.current.get(pid);
          if (pc) {
            const offer = await pc.createOffer({ offerToReceiveAudio: true });
            await pc.setLocalDescription(offer);
            void ch.send({
              type: "broadcast",
              event: "sig",
              payload: { kind: "offer", from: myPeerId, to: pid, data: offer },
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Microphone access is required.");
    }
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    if (!user) {
      toast.error("Sign in to chat");
      return;
    }
    setInput("");
    const { error } = await supabase.from("room_messages").insert({
      room_id: room.id,
      user_id: user.id,
      author_name: authorName,
      role: "user",
      text,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    // Trigger Jenny moderator
    try {
      const history = messages.slice(-14).map((m) => ({
        author: m.author_name,
        role: m.role,
        text: m.text,
      }));
      history.push({ author: authorName, role: "user" as const, text });
      await moderateFn({
        data: {
          roomId: room.id,
          roomName: room.name,
          language: room.language,
          chapter: room.chapter,
          mode: room.mode,
          triggerText: text,
          history,
        },
      });
    } catch (e) {
      console.error("Jenny moderator failed", e);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-gradient-to-r from-accent/20 to-transparent px-3 py-2">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back to rooms">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{room.name}</div>
          <div className="text-[11px] font-mono text-muted-foreground truncate">
            {room.language}
            {room.chapter ? ` · ch ${room.chapter}` : ""} · {peers.length} online · Jenny{" "}
            {room.mode === "active" ? "moderating" : "on call"}
          </div>
        </div>
        <Button
          variant={micOn ? "default" : "outline"}
          size="icon"
          onClick={toggleMic}
          title={micOn ? "Mute mic" : "Enable mic"}
        >
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setVoiceOn((v) => !v)}
          title={voiceOn ? "Mute peers" : "Unmute peers"}
        >
          {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b bg-card/40 px-3 py-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Online ({onlineNames.length})
        </span>
        {onlineNames.map((n, i) => (
          <span
            key={`${n}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {n}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Instructor Jenny
        </span>
      </div>


      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No messages yet. Say hi — Jenny will greet the crew.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.user_id === user?.id;
          const isJenny = m.role === "assistant";
          return (
            <div
              key={m.id}
              className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
            >
              {isJenny && (
                <img
                  src={jennyImg}
                  alt=""
                  className="mt-1 h-6 w-6 flex-shrink-0 rounded-full object-cover ring-1 ring-primary/60"
                />
              )}
              <div
                className={
                  isJenny
                    ? "max-w-[85%] rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-sm"
                    : mine
                      ? "max-w-[80%] rounded-lg bg-primary px-2 py-1 text-sm text-primary-foreground"
                      : "max-w-[80%] rounded-lg border border-border bg-background px-2 py-1 text-sm"
                }
              >
                <div className="text-[10px] font-mono opacity-70">
                  {isJenny ? "Instructor Jenny" : m.author_name}
                </div>
                {isJenny ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_code]:text-xs">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.text}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 border-t p-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={user ? `Message as ${authorName}…` : "Sign in to chat"}
          disabled={!user}
          className="h-9"
        />
        <Button size="icon" onClick={() => void send()} disabled={!input.trim() || !user}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
