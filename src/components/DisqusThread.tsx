import { useEffect, useRef } from "react";

const SHORTNAME = "eliptum";

declare global {
  interface Window {
    DISQUS?: {
      reset: (args: { reload: boolean; config: (this: DisqusConfigThis) => void }) => void;
    };
    disqus_config?: (this: DisqusConfigThis) => void;
  }
}

type DisqusConfigThis = {
  page: { url?: string; identifier?: string; title?: string };
  language?: string;
};

type Props = {
  /** Stable per-page identifier — changes force a fresh thread. */
  identifier: string;
  title: string;
  /** Canonical URL for the thread. */
  url?: string;
};

/**
 * Loads the Disqus universal embed. Resets window.DISQUS whenever the
 * identifier (route) changes so each language page gets its own thread.
 */
export function DisqusThread({ identifier, title, url }: Props) {
  const mounted = useRef(false);

  useEffect(() => {
    const pageUrl =
      url ?? (typeof window !== "undefined" ? window.location.href : `https://disqus.com/${identifier}`);

    const config = function (this: DisqusConfigThis) {
      this.page.url = pageUrl;
      this.page.identifier = identifier;
      this.page.title = title;
    };

    window.disqus_config = config;

    if (window.DISQUS && mounted.current) {
      window.DISQUS.reset({ reload: true, config });
      return;
    }

    if (!document.getElementById("disqus-embed-script")) {
      const s = document.createElement("script");
      s.id = "disqus-embed-script";
      s.src = `https://${SHORTNAME}.disqus.com/embed.js`;
      s.setAttribute("data-timestamp", String(Date.now()));
      s.async = true;
      document.body.appendChild(s);
    } else if (window.DISQUS) {
      window.DISQUS.reset({ reload: true, config });
    }
    mounted.current = true;
  }, [identifier, title, url]);

  return <div id="disqus_thread" className="disqus-dark" />;
}
