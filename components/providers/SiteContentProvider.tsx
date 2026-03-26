"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { defaultSiteContent } from "@/lib/default-site-content";
import { mergeSiteContent } from "@/lib/merge-site-content";
import { netlifyFunctionUrl } from "@/lib/netlify-paths";
import type { SiteContent } from "@/lib/site-content-types";

type SiteContentContextValue = { site: SiteContent; ready: boolean };

const SiteContentContext = createContext<SiteContentContextValue>({
  site: defaultSiteContent,
  ready: false,
});

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(netlifyFunctionUrl("get-site-content"));
        const data = (await res.json()) as { site?: unknown };
        if (cancelled) return;
        setSite(mergeSiteContent(data.site ?? null));
      } catch {
        if (!cancelled) setSite(defaultSiteContent);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ site, ready }), [site, ready]);

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent(): SiteContentContextValue {
  return useContext(SiteContentContext);
}
