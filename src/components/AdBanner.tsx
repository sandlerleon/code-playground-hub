import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENT = "ca-pub-1137662438204845";
const SLOT = "8296681583";

/** Responsive AdSense banner. */
export function AdBanner() {
  const pushed = useRef(false);

  useEffect(() => {
    if (!document.getElementById("adsbygoogle-lib")) {
      const s = document.createElement("script");
      s.id = "adsbygoogle-lib";
      s.async = true;
      s.crossOrigin = "anonymous";
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
      document.head.appendChild(s);
    }
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ad blocker or duplicate push */
    }
  }, []);

  return (
    <div className="w-full border-b bg-background/60">
      <div className="mx-auto max-w-7xl px-6 py-2">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={CLIENT}
          data-ad-slot={SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
