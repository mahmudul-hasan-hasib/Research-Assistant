"use client";

import { useEffect, useState } from "react";

const QUERIES = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
} as const;

export type Breakpoint = keyof typeof QUERIES;

function matches(query: string): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(query).matches;
}

/** Reactive viewport breakpoint (Part 3.1 — shared hooks). */
export function useMediaQuery(breakpoint: Breakpoint): boolean {
  const query = QUERIES[breakpoint];
  const [isMatch, setIsMatch] = useState<boolean>(() => matches(query));

  useEffect(() => {
    const media = window.matchMedia(query);
    const handler = () => setIsMatch(media.matches);
    handler();
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [query]);

  return isMatch;
}
