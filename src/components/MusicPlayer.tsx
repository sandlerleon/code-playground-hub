import { useEffect, useRef, useState } from "react";
import { Music, VolumeX, Volume2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATIONS = [
  {
    id: "coderadio",
    label: "CodeRadio (Eliptum.com)",
    url: "https://coderadio-admin-v2.freecodecamp.org/listen/coderadio/radio.mp3",
  },
  {
    id: "groovesalad",
    label: "SomaFM · Groove Salad (lofi)",
    url: "https://ice1.somafm.com/groovesalad-128-mp3",
  },
  {
    id: "spacestation",
    label: "SomaFM · Space Station",
    url: "https://ice1.somafm.com/spacestation-128-mp3",
  },
];

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [station, setStation] = useState<string>(() => {
    if (typeof window === "undefined") return "coderadio";
    return window.localStorage.getItem("music-station") ?? "coderadio";
  });
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === "undefined") return 0.4;
    const v = Number(window.localStorage.getItem("music-volume"));
    return Number.isFinite(v) && v > 0 ? v : 0.4;
  });

  useEffect(() => {
    window.localStorage.setItem("music-station", station);
  }, [station]);
  useEffect(() => {
    window.localStorage.setItem("music-volume", String(volume));
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  async function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    const url = STATIONS.find((s) => s.id === station)?.url;
    if (!url) return;
    // Reset src so switching stations restarts stream
    if (!a.src || !a.src.includes(new URL(url).pathname)) a.src = url;
    a.volume = volume;
    a.muted = muted;
    try {
      await a.play();
      setPlaying(true);
    } catch {
      // Browsers may block until user gesture; a click already occurred so this
      // typically succeeds. On failure, surface via console.
      setPlaying(false);
    }
  }

  function changeStation(id: string) {
    setStation(id);
    const a = audioRef.current;
    if (!a) return;
    const url = STATIONS.find((s) => s.id === id)?.url;
    if (!url) return;
    const wasPlaying = playing;
    a.pause();
    a.src = url;
    if (wasPlaying) {
      void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      setPlaying(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-2 py-1">
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />
      <Music className="h-4 w-4 text-primary" />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={toggle}
        title={playing ? "Pause music" : "Play music"}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      <Select value={station} onValueChange={changeStation}>
        <SelectTrigger className="h-7 w-[180px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {STATIONS.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setMuted((m) => !m)}
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </Button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="w-16 accent-primary"
        title="Volume"
      />
    </div>
  );
}
