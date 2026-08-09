import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CHANNEL = "language-room-presence";

/**
 * Shared presence channel for all language rooms.
 * Pass a language slug to be counted in that room, or null to just observe.
 * Returns a map of slug -> number of visitors currently in that room.
 */
export function useRoomPresence(slug: string | null) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const key = `${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key } },
    });

    const recompute = () => {
      const state = channel.presenceState() as Record<string, Array<{ slug?: string }>>;
      const next: Record<string, number> = {};
      Object.values(state).forEach((entries) => {
        entries.forEach((e) => {
          if (!e?.slug) return;
          next[e.slug] = (next[e.slug] ?? 0) + 1;
        });
      });
      setCounts(next);
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && slug) {
          void channel.track({ slug, at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

  return counts;
}
