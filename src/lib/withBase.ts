/**
 * Prefix root-relative URLs (e.g. "/images/x.png") with Astro's configured base.
 * On GitHub Pages this is typically "/<repo>/".
 */
export function withBase(url: string): string {
  if (!url) return url;
  if (!url.startsWith("/")) return url;

  // Important: reference `import.meta.env.BASE_URL` directly so Astro/Vite can
  // statically substitute the correct base at build time.
  const baseUrl = import.meta.env.BASE_URL ?? "/";

  // BASE_URL is usually "/" or "/repo/". Normalize without trailing slash.
  const prefix = baseUrl === "/" ? "" : baseUrl.replace(/\/$/, "");
  return `${prefix}${url}`;
}

