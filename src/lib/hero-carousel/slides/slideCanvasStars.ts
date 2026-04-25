import type { HeroIllustrationSlide, HeroSlideFactory } from "../types";

function resizeCanvas(canvas: HTMLCanvasElement, root: HTMLElement) {
  const dpr = window.devicePixelRatio || 1;
  const w = root.clientWidth;
  const h = root.clientHeight;
  if (w < 1 || h < 1) return;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

type Spark = { x: number; y: number; born: number; hue: number };

/** Stars + moon: ambient drift, pointer parallax, tap sparkles. */
export const createCanvasStarsSlide: HeroSlideFactory = (prefersReducedMotion) => {
  let rootEl: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let raf = 0;
  let ro: ResizeObserver | null = null;
  let running = false;
  let px = 0;
  let py = 0;
  let t0 = 0;
  const sparks: Spark[] = [];
  const ac = new AbortController();

  const onMove = (e: PointerEvent) => {
    if (!rootEl || prefersReducedMotion) return;
    const r = rootEl.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    px += (nx - px) * 0.1;
    py += (ny - py) * 0.1;
  };

  const burst = (cx: number, cy: number) => {
    const n = prefersReducedMotion ? 8 : 18;
    const base = Math.random() * 60;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      sparks.push({
        x: cx + Math.cos(ang) * 8,
        y: cy + Math.sin(ang) * 8,
        born: performance.now(),
        hue: base + i * 4,
      });
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!rootEl || !canvas) return;
    const r = rootEl.getBoundingClientRect();
    burst(e.clientX - r.left, e.clientY - r.top);
  };

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1e1b4b");
    g.addColorStop(0.45, "#312e81");
    g.addColorStop(1, "#0f172a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const autoX = prefersReducedMotion ? 0 : Math.sin(t * 0.00035) * 0.35;
    const autoY = prefersReducedMotion ? 0 : Math.cos(t * 0.00028) * 0.22;
    const driftX = (prefersReducedMotion ? 0 : px * 16) + autoX * 12;
    const driftY = (prefersReducedMotion ? 0 : py * 10) + autoY * 8;

    for (let i = 0; i < 52; i++) {
      const twinkle = prefersReducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 0.002 + i * 0.7);
      const sx = ((i * 997) % w) + driftX * 0.28;
      const sy = ((i * 673) % h) + driftY * 0.18;
      const tw = (0.55 + (i % 5) * 0.18) * twinkle;
      const a = (0.32 + (i % 4) * 0.12) * twinkle;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(((sx % w) + w) % w, ((sy % h) + h) % h, tw, 0, Math.PI * 2);
      ctx.fill();
    }

    const mx = w * 0.72 + driftX;
    const my = h * 0.22 + driftY;
    const pulse = prefersReducedMotion ? 1 : 0.9 + 0.1 * Math.sin(t * 0.0012);
    ctx.fillStyle = `rgba(254, 243, 199, ${0.88 * pulse})`;
    ctx.beginPath();
    ctx.arc(mx, my, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(251, 191, 36, 0.28)";
    ctx.beginPath();
    ctx.arc(mx - 6, my - 4, Math.min(w, h) * 0.1, 0, Math.PI * 2);
    ctx.fill();

    const now = performance.now();
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      const age = now - s.born;
      const life = prefersReducedMotion ? 420 : 640;
      if (age > life) {
        sparks.splice(i, 1);
        continue;
      }
      const u = age / life;
      const rad = 3 + u * 36;
      const alpha = 0.55 * (1 - u);
      ctx.strokeStyle = `hsla(${s.hue}, 90%, 72%, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `hsla(${s.hue + 20}, 95%, 85%, ${alpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rad * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const loop = () => {
    if (!running || !canvas || !rootEl) return;
    const ctx = canvas.getContext("2d");
    const w = rootEl.clientWidth;
    const h = rootEl.clientHeight;
    if (ctx && w > 0 && h > 0) {
      draw(ctx, w, h, performance.now() - t0);
    }
    raf = requestAnimationFrame(loop);
  };

  const slide: HeroIllustrationSlide = {
    mount(root) {
      rootEl = root;
      root.className =
        "relative h-full min-h-[160px] w-full cursor-crosshair overflow-hidden rounded-[inherit] bg-[#0f172a]";
      root.innerHTML = `
        <canvas class="hero-stars-canvas absolute inset-0 h-full w-full touch-none" aria-hidden="true"></canvas>
      `;
      canvas = root.querySelector("canvas");
      if (!canvas) return;
      t0 = performance.now();
      resizeCanvas(canvas, root);
      ro = new ResizeObserver(() => {
        if (canvas && rootEl) resizeCanvas(canvas, rootEl);
      });
      ro.observe(root);
      if (!prefersReducedMotion) {
        root.addEventListener("pointermove", onMove, { passive: true, signal: ac.signal });
      }
      root.addEventListener("pointerdown", onPointerDown, { passive: true, signal: ac.signal });
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    resume() {
      if (!canvas || !rootEl) return;
      running = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
      ac.abort();
      ro?.disconnect();
      ro = null;
      sparks.length = 0;
      if (rootEl) rootEl.innerHTML = "";
      rootEl = null;
      canvas = null;
    },
  };
  return slide;
};
