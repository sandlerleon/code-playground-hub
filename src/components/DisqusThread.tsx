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
 * Disqus universal embed. Injects embed.js once, then calls DISQUS.reset()
 * whenever the identifier (route) changes so each language page gets its
 * own thread.
 */
export function DisqusThread({ identifier, title, url }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pageUrl = url ?? window.location.href;

    const config = function (this: DisqusConfigThis) {
      this.page.url = pageUrl;
      this.page.identifier = identifier;
      this.page.title = title;
    };
    window.disqus_config = config;

    // Disqus renders into the (single) #disqus_thread element in the document.
    const node = host.current;
    if (node) node.id = "disqus_thread";

    if (window.DISQUS) {
      window.DISQUS.reset({ reload: true, config });
      return;
    }

    const s = document.createElement("script");
    s.src = `https://${SHORTNAME}.disqus.com/embed.js`;
    s.setAttribute("data-timestamp", String(+new Date()));
    s.async = true;
    (document.head || document.body).appendChild(s);
  }, [identifier, title, url]);

  return (
    <>
      <div ref={host} id="disqus_thread" className="disqus-dark" />
      <noscript>
        Please enable JavaScript to view the{" "}
        <a href="https://disqus.com/?ref_noscript">comments powered by Disqus.</a>
      </noscript>
    </>
  );
}
