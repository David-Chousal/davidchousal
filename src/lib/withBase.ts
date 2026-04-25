/**
 * Prefix root-relative URLs (e.g. "/images/x.png") with Astro's configured base.
 * On GitHub Pages this is typically "/<repo>/".
 */
export function withBase(url: string): string {
  if (!url) return url;
  if (!url.startsWith("/")) return url;

  const base = (import.meta as any).env?.BASE_URL as string | undefined;
  const baseUrl = typeof base === "string" ? base : "/";

  // BASE_URL is usually "/" or "/repo/". Normalize without trailing slash.
  const prefix = baseUrl === "/" ? "" : baseUrl.replace(/\/$/, "");
  return `${prefix}${url}`;
}

