import { useEffect, useState } from "react";

// Hash routing keeps the build fully static: it works from a tunnel, GitHub Pages, or a CDN folder.
export type Route = { path: string[]; query: URLSearchParams };

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [p, q = ""] = raw.split("?");
  return { path: p.split("/").filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function href(path: string): string {
  return `#${path}`;
}

export function navigate(path: string) {
  window.location.hash = path;
}

/** Absolute, shareable URL for an in-app path. */
export function shareUrl(path: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${path}`;
}
