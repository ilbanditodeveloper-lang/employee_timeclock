import { useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";

/**
 * Persist a tab id in the URL query (?tab=...) so refresh keeps the same panel.
 */
export function useUrlTab<T extends string>(
  basePath: string,
  validTabs: readonly T[],
  defaultTab: T
): [T, (tab: T | string) => void] {
  const [, setLocation] = useLocation();
  const search = useSearch();

  const activeTab = useMemo(() => {
    const raw = new URLSearchParams(search).get("tab");
    if (raw && (validTabs as readonly string[]).includes(raw)) {
      return raw as T;
    }
    return defaultTab;
  }, [search, validTabs, defaultTab]);

  const setActiveTab = useCallback(
    (tab: T | string) => {
      const next = (validTabs as readonly string[]).includes(tab) ? (tab as T) : defaultTab;
      const href =
        next === defaultTab ? basePath : `${basePath}?tab=${encodeURIComponent(next)}`;
      setLocation(href);
    },
    [basePath, defaultTab, setLocation, validTabs]
  );

  return [activeTab, setActiveTab];
}
