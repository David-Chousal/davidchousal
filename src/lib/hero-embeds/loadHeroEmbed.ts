type LoadedAsset = { type: "script" | "style"; url: string };

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function resolveUrl(href: string, base: string) {
  if (isAbsoluteUrl(href)) return href;
  // Support "./x" and "/x"
  if (href.startsWith("/")) return href;
  const baseUrl = new URL(base, window.location.origin);
  const resolved = new URL(href, baseUrl);
  return resolved.pathname + resolved.search + resolved.hash;
}

const loaded = new Set<string>();

function ensureStylesheet(url: string) {
  if (loaded.has(`style:${url}`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
  loaded.add(`style:${url}`);
}

function ensureScript(url: string) {
  return new Promise<void>((resolve, reject) => {
    if (loaded.has(`script:${url}`)) return resolve();
    const s = document.createElement("script");
    s.src = url;
    s.async = false; // preserve ordering (GSAP before embed script)
    s.onload = () => {
      loaded.add(`script:${url}`);
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(s);
  });
}

function extractBodyHtml(doc: Document) {
  // Some embeds shove <link> tags inside <body>; keep their body markup but we’ll
  // separately load any <link rel="stylesheet"> found anywhere in the document.
  return doc.body?.innerHTML ?? "";
}

function collectAssets(doc: Document, basePath: string): LoadedAsset[] {
  const assets: LoadedAsset[] = [];

  doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((l) => {
    assets.push({ type: "style", url: resolveUrl(l.getAttribute("href") || "", basePath) });
  });

  doc.querySelectorAll<HTMLScriptElement>("script[src]").forEach((s) => {
    assets.push({ type: "script", url: resolveUrl(s.getAttribute("src") || "", basePath) });
  });

  return assets;
}

export async function mountHeroEmbed(opts: {
  /** Base path to the embed folder, e.g. "/hero-embeds/svg-puzzle" */
  basePath: string;
  /** Element to mount into */
  mountEl: HTMLElement;
}) {
  const indexUrl = `${opts.basePath.replace(/\/$/, "")}/index.html`;
  const res = await fetch(indexUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Failed to fetch ${indexUrl}: ${res.status}`);

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Collect dependencies.
  const assets = collectAssets(doc, indexUrl);

  // Load styles first (so layout is correct ASAP).
  assets.filter((a) => a.type === "style").forEach((a) => ensureStylesheet(a.url));

  // Inject markup before running scripts (many embeds query DOM on execute).
  opts.mountEl.innerHTML = extractBodyHtml(doc);

  // Best-effort: remove any duplicate <link> or <script> tags that were inlined in body.
  opts.mountEl.querySelectorAll("link[rel='stylesheet'], script[src]").forEach((n) => n.remove());

  // Then load scripts in order (external libs before embed script).
  for (const s of assets.filter((a) => a.type === "script")) {
    // eslint-disable-next-line no-await-in-loop
    await ensureScript(s.url);
  }
}

