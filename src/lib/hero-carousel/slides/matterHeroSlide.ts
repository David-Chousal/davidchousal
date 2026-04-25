/**
 * Matter.js hero slides: DOM-synced chips, FX ripples, optional mat inset + ambient canvas.
 */
import type { HeroIllustrationSlide, HeroSlideFactory } from "../types";

export type MatterThemeId = "sunnyPicnic";

const DEFAULT_CHIP_PX = 56;
const MAX_CHIPS = 16;

function wallThickness() {
  return 64;
}

interface MatterThemeTokens {
  rootClass: string;
  chipHoverFilter: string;
  chipDragFilter: string;
  layersHtml: string;
  rippleRgb: string;
  gravityScale?: number;
  /** Chip box / physics radius; default 56 */
  chipPx?: number;
  /** Inset mat: scene root uses `inset-[1.25px]` */
  sceneMatInset?: boolean;
  /** Extra ambient canvas behind layers (pond water wash) */
  ambientCanvas?: boolean;
  /** FX canvas bleeds past mat edge by 1.25px each side */
  fxCanvasBleed?: boolean;
  /** Optional followers (soft shadows) — only first three bodies */
  followerShadows?: boolean;
  ariaLabel?: string;
  chips: [string, string, string];
}

const THEMES: Record<MatterThemeId, MatterThemeTokens> = {
  sunnyPicnic: {
    rootClass: "bg-[#fef3c7]",
    chipHoverFilter:
      "drop-shadow(0 0 12px rgba(251, 191, 36, 0.55)) drop-shadow(0 0 22px rgba(245, 158, 11, 0.3))",
    chipDragFilter: "drop-shadow(0 0 14px rgba(254, 249, 195, 0.75))",
    rippleRgb: "253, 224, 71",
    gravityScale: 1.02,
    layersHtml: `
      <div class="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#bae6fd] via-[#fef9c3] to-[#86efac]" aria-hidden="true"></div>
      <div class="pointer-events-none absolute inset-0 z-[1] opacity-35" style="background: radial-gradient(ellipse 75% 45% at 50% 18%, rgba(255,255,255,0.65), transparent 50%);" aria-hidden="true"></div>
      <div class="pointer-events-none absolute inset-0 z-[1] opacity-[0.08]" style="background-image: linear-gradient(90deg, rgba(120,53,15,0.15) 1px, transparent 1px); background-size: 18px 100%;" aria-hidden="true"></div>`,
    chips: [
      `<svg class="h-full w-full" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="18" fill="#fde047" stroke="#ca8a04" stroke-width="2"/><path d="M28 14v6M28 36v6M14 28h6M36 28h6" stroke="#a16207" stroke-width="2" stroke-linecap="round"/></svg>`,
      `<svg class="h-full w-full" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="18" width="40" height="24" rx="4" fill="#fef3c7" stroke="#92400e" stroke-width="2"/><path d="M12 26h32M12 32h24" stroke="#b45309" stroke-width="2" stroke-linecap="round"/></svg>`,
      `<svg class="h-full w-full" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><path d="M18 40V22l10-6 10 6v18" fill="#e0f2fe" stroke="#0369a1" stroke-width="2" stroke-linejoin="round"/><rect x="22" y="26" width="12" height="14" rx="2" fill="#bae6fd"/></svg>`,
    ],
  },
};

function getChipRadius(theme: MatterThemeTokens): number {
  const px = theme.chipPx ?? DEFAULT_CHIP_PX;
  return px / 2;
}

function resizeCanvas(canvas: HTMLCanvasElement, layoutRoot: HTMLElement) {
  const dpr = window.devicePixelRatio || 1;
  const w = layoutRoot.clientWidth;
  const h = layoutRoot.clientHeight;
  if (w < 1 || h < 1) return;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Ambient canvas extends beyond scene for soft edge wash (pond). */
function resizeAmbientCanvas(canvas: HTMLCanvasElement, scene: HTMLElement, bleedPx: number) {
  const dpr = window.devicePixelRatio || 1;
  const w = scene.clientWidth + bleedPx * 2;
  const h = scene.clientHeight + bleedPx * 2;
  if (w < 1 || h < 1) return;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Single ambient frame (pond water wash); `t` is ms for subtle gradient drift when animating. */
function paintAmbientWater(ambCtx: CanvasRenderingContext2D, sw: number, sh: number, t: number) {
  ambCtx.clearRect(0, 0, sw, sh);
  const gx = ambCtx.createLinearGradient(0, 0, sw, sh);
  gx.addColorStop(0, `rgba(232,244,242,${0.35 + 0.05 * Math.sin(t * 0.0008)})`);
  gx.addColorStop(0.5, "rgba(180, 220, 212,0.12)");
  gx.addColorStop(1, `rgba(140, 200, 190,${0.2 + 0.04 * Math.cos(t * 0.0007)})`);
  ambCtx.fillStyle = gx;
  ambCtx.fillRect(0, 0, sw, sh);
  ambCtx.strokeStyle = "rgba(255,255,255,0.06)";
  ambCtx.lineWidth = 1;
  const wave = (t * 0.02) % 40;
  for (let x = -wave; x < sw; x += 40) {
    ambCtx.beginPath();
    ambCtx.moveTo(x, sh * 0.55);
    ambCtx.quadraticCurveTo(x + 20, sh * 0.52, x + 40, sh * 0.55);
    ambCtx.stroke();
  }
}

function applyStaticChips(root: HTMLElement, els: HTMLElement[], R: number) {
  const scene = root.querySelector<HTMLElement>("[data-hero-matter-scene]") ?? root;
  const w = scene.clientWidth;
  const h = scene.clientHeight;
  const pad = R + 8;
  const spots = [
    { x: w * 0.22, y: h * 0.35, a: -0.15 },
    { x: w * 0.52, y: h * 0.42, a: 0.2 },
    { x: w * 0.78, y: h * 0.32, a: -0.08 },
  ];
  for (let i = 0; i < els.length; i++) {
    const s = spots[i];
    if (!s) break;
    const x = Math.min(Math.max(s.x, pad), w - pad);
    const y = Math.min(Math.max(s.y, pad), h - pad);
    els[i].style.transform = `translate(${x - R}px,${y - R}px) rotate(${s.a}rad)`;
  }
}

function createBounds(Matter: typeof import("matter-js").default, width: number, height: number) {
  const t = wallThickness();
  const { Bodies } = Matter;
  return [
    Bodies.rectangle(width / 2, height + t / 2, width + t * 4, t, { isStatic: true, label: "ground" }),
    Bodies.rectangle(-t / 2, height / 2, t, height + t * 4, { isStatic: true, label: "left" }),
    Bodies.rectangle(width + t / 2, height / 2, t, height + t * 4, { isStatic: true, label: "right" }),
    Bodies.rectangle(width / 2, -t / 2, width + t * 4, t, { isStatic: true, label: "ceiling" }),
  ];
}

function clampBodyIntoView(
  MatterApi: typeof import("matter-js").default,
  body: import("matter-js").Body,
  width: number,
  height: number,
  pad: number
) {
  const { Body } = MatterApi;
  const x = Math.min(Math.max(body.position.x, pad), width - pad);
  const y = Math.min(Math.max(body.position.y, pad), height - pad);
  if (x !== body.position.x || y !== body.position.y) {
    Body.setPosition(body, { x, y });
    Body.setVelocity(body, { x: 0, y: 0 });
  }
}

function buildMountHtml(theme: MatterThemeTokens): string {
  const chipPx = theme.chipPx ?? DEFAULT_CHIP_PX;
  const chips = theme.chips
    .map(
      (svg, i) => `
  <div class="hero-matter-chip hero-matter-chip-visual pointer-events-none absolute left-0 top-0 z-10 will-change-transform" data-chip="${i}" style="width:${chipPx}px;height:${chipPx}px" aria-hidden="true">${svg}</div>`
    )
    .join("");

  const followers = theme.followerShadows
    ? [0, 1, 2]
        .map(
          (i) => `
  <div class="hero-matter-follower pointer-events-none absolute left-0 top-0 z-[5] will-change-transform" data-follower="${i}" style="width:${chipPx * 1.1}px;height:${chipPx * 0.35}px;background:rgba(26,74,101,0.14);border-radius:9999px;filter:blur(6px)" aria-hidden="true"></div>`
        )
        .join("")
    : "";

  const sceneClass = theme.sceneMatInset
    ? "absolute inset-[1.25px] min-h-0 min-w-0 overflow-hidden rounded-[inherit]"
    : "absolute inset-0 min-h-0 min-w-0 overflow-hidden rounded-[inherit]";

  const ambient = theme.ambientCanvas
    ? `<canvas class="hero-matter-ambient-canvas pointer-events-none absolute z-0" style="left:-80px;top:-80px;width:calc(100% + 160px);height:calc(100% + 160px)" aria-hidden="true"></canvas>`
    : "";

  const fxBleed = theme.fxCanvasBleed
    ? `class="hero-matter-fx-canvas pointer-events-none absolute z-[2]" style="left:-1.25px;top:-1.25px;width:calc(100% + 2.5px);height:calc(100% + 2.5px)"`
    : `class="hero-matter-fx-canvas pointer-events-none absolute inset-0 z-[2] h-full w-full"`;

  return `
  <div data-hero-matter-scene class="${sceneClass}">
    ${ambient}
    ${theme.layersHtml}
    <canvas ${fxBleed} aria-hidden="true"></canvas>
    ${chips}
    ${followers}
  </div>`;
}

function applyMatterRootShell(root: HTMLElement, themeId: MatterThemeId, tokens: MatterThemeTokens) {
  root.dataset.heroMatterSlide = themeId;
  root.className = `relative isolate h-full min-h-0 w-full cursor-grab touch-none overflow-hidden rounded-[inherit] select-none active:cursor-grabbing ${tokens.rootClass}`;
  root.style.setProperty("--matter-chip-hover-filter", tokens.chipHoverFilter);
  root.style.setProperty("--matter-chip-drag-filter", tokens.chipDragFilter);
  root.setAttribute(
    "aria-label",
    tokens.ariaLabel ??
      "Interactive physics. Drag chips, hover for glow, tap empty space to add more, double-click a chip to nudge."
  );
}

export function createMatterHeroSlide(themeId: MatterThemeId): HeroSlideFactory {
  return (prefersReducedMotion: boolean) => {
    const tokens = THEMES[themeId];
    let root: HTMLElement | null = null;
    let engineStop: (() => void) | null = null;
    let staticRo: ResizeObserver | null = null;
    let active = false;

    function ensureSceneDom() {
      if (!root) return;
      if (!root.querySelector(".hero-matter-fx-canvas")) {
        root.innerHTML = buildMountHtml(tokens);
      }
      applyMatterRootShell(root, themeId, tokens);
    }

    function startOrStaticAfterMatter(Matter: typeof import("matter-js").default) {
      if (!root) return;
      const canvas = root.querySelector<HTMLCanvasElement>(".hero-matter-fx-canvas");
      const els = Array.from(root.querySelectorAll<HTMLElement>(".hero-matter-chip"));
      if (!canvas || els.length < 3) return;
      if (!active) {
        const scene = root.querySelector<HTMLElement>("[data-hero-matter-scene]") ?? root;
        resizeCanvas(canvas, scene);
        const amb = root.querySelector<HTMLCanvasElement>(".hero-matter-ambient-canvas");
        if (amb) resizeAmbientCanvas(amb, scene, 80);
        applyStaticChips(root, els, getChipRadius(tokens));
        return;
      }
      engineStop?.();
      engineStop = startPhysicsEngine(Matter, root, tokens, canvas, els);
    }

    const slide: HeroIllustrationSlide = {
      mount(el) {
        root = el;
        ensureSceneDom();
        if (prefersReducedMotion) {
          const canvas = root.querySelector<HTMLCanvasElement>(".hero-matter-fx-canvas");
          const els = Array.from(root.querySelectorAll<HTMLElement>(".hero-matter-chip"));
          if (canvas) {
            const scene = root.querySelector<HTMLElement>("[data-hero-matter-scene]") ?? root;
            resizeCanvas(canvas, scene);
          }
          const amb = root.querySelector<HTMLCanvasElement>(".hero-matter-ambient-canvas");
          if (amb) {
            const scene = root.querySelector<HTMLElement>("[data-hero-matter-scene]") ?? root;
            const bleed = 80;
            resizeAmbientCanvas(amb, scene, bleed);
            const ambCtx = amb.getContext("2d");
            if (ambCtx) {
              const sw = scene.clientWidth + bleed * 2;
              const sh = scene.clientHeight + bleed * 2;
              paintAmbientWater(ambCtx, sw, sh, 0);
            }
          }
          applyStaticChips(root, els, getChipRadius(tokens));
          staticRo = new ResizeObserver(() => {
            if (!root) return;
            const scene = root.querySelector<HTMLElement>("[data-hero-matter-scene]") ?? root;
            const c = root.querySelector<HTMLCanvasElement>(".hero-matter-fx-canvas");
            const a = root.querySelector<HTMLCanvasElement>(".hero-matter-ambient-canvas");
            const e = Array.from(root.querySelectorAll<HTMLElement>(".hero-matter-chip"));
            const bleed = 80;
            if (c) resizeCanvas(c, scene);
            if (a) {
              resizeAmbientCanvas(a, scene, bleed);
              const actx = a.getContext("2d");
              if (actx) paintAmbientWater(actx, scene.clientWidth + bleed * 2, scene.clientHeight + bleed * 2, 0);
            }
            applyStaticChips(root, e, getChipRadius(tokens));
          });
          staticRo.observe(root);
        }
      },
      pause() {
        active = false;
        engineStop?.();
        engineStop = null;
        if (!prefersReducedMotion && root) {
          root.innerHTML = buildMountHtml(tokens);
          applyMatterRootShell(root, themeId, tokens);
        }
      },
      resume() {
        if (prefersReducedMotion || !root) return;
        active = true;
        ensureSceneDom();
        void import("matter-js")
          .then((mod) => {
            if (!root) return;
            startOrStaticAfterMatter(mod.default);
          })
          .catch(() => {
            if (!root) return;
            const els = Array.from(root.querySelectorAll<HTMLElement>(".hero-matter-chip"));
            applyStaticChips(root, els, getChipRadius(tokens));
          });
      },
      destroy() {
        active = false;
        engineStop?.();
        engineStop = null;
        staticRo?.disconnect();
        staticRo = null;
        if (root) {
          root.innerHTML = "";
          root.removeAttribute("data-hero-matter-slide");
        }
        root = null;
      },
    };
    return slide;
  };
}

function startPhysicsEngine(
  Matter: typeof import("matter-js").default,
  root: HTMLElement,
  tokens: MatterThemeTokens,
  canvas: HTMLCanvasElement,
  initialEls: HTMLElement[]
): () => void {
  const scene = root.querySelector<HTMLElement>("[data-hero-matter-scene]") ?? root;
  const R = getChipRadius(tokens);
  const ambientCanvas = root.querySelector<HTMLCanvasElement>(".hero-matter-ambient-canvas");
  const followerEls = Array.from(root.querySelectorAll<HTMLElement>(".hero-matter-follower"));

  const { Engine, Runner, World, Bodies, Body, Mouse, MouseConstraint, Events, Query } = Matter;

  let wallBodies: import("matter-js").Body[] = [];
  let bodies: import("matter-js").Body[] = [];
  let mouseConstraint: import("matter-js").MouseConstraint | null = null;
  let rafId = 0;
  let runner: import("matter-js").Runner | null = null;
  let engine: import("matter-js").Engine | null = null;
  let els = [...initialEls];
  let ripples: { x: number; y: number; born: number; scale: number }[] = [];
  let attractorT0 = 0;
  let hoverIdx = -1;
  let frameCount = 0;

  const ac = new AbortController();
  const { signal } = ac;

  const syncMouse = (mouse: import("matter-js").Mouse) => {
    mouse.offset.x = 0;
    mouse.offset.y = 0;
    mouse.scale.x = 1;
    mouse.scale.y = 1;
  };

  const isChipBody = (b: import("matter-js").Body) => bodies.indexOf(b) >= 0;

  const setHover = (next: number) => {
    if (next === hoverIdx) return;
    hoverIdx = next;
    for (let i = 0; i < els.length; i++) {
      els[i].classList.toggle("hero-matter-chip--hover", i === hoverIdx);
    }
  };

  const clearDragClasses = () => {
    for (let i = 0; i < els.length; i++) els[i].classList.remove("hero-matter-chip--drag");
  };

  const pointerInRoot = (clientX: number, clientY: number) => {
    const rect = scene.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const rebuildWorldSize = () => {
    if (!engine || bodies.length === 0) return;
    const width = scene.clientWidth;
    const height = scene.clientHeight;
    if (width < 32 || height < 32) return;

    resizeCanvas(canvas, scene);
    if (ambientCanvas) resizeAmbientCanvas(ambientCanvas, scene, 80);

    wallBodies.forEach((b) => World.remove(engine!.world, b));
    wallBodies = createBounds(Matter, width, height);
    World.add(engine!.world, wallBodies);

    const pad = R + 4;
    bodies.forEach((b) => clampBodyIntoView(Matter, b, width, height, pad));
  };

  const gScale = tokens.gravityScale ?? 1;

  const beforeUpdate = () => {
    if (!engine) return;
    const w = scene.clientWidth;
    const h = scene.clientHeight;
    if (w < 32 || h < 32 || bodies.length < 2) return;

    const t = (performance.now() - attractorT0) / 1000;
    const ax = w * (0.5 + 0.08 * Math.sin(t * 0.35));
    const ay = h * (0.42 + 0.06 * Math.cos(t * 0.28));
    const pulse = 0.55 + 0.45 * Math.sin(t * 0.7);

    for (const b of bodies) {
      const dx = ax - b.position.x;
      const dy = ay - b.position.y;
      Body.applyForce(b, b.position, {
        x: dx * 1.1e-5 * pulse * gScale,
        y: dy * 1.1e-5 * pulse * gScale,
      });
    }

    const pair = 4.5e-6 * gScale;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const d = Math.hypot(dx, dy) + 24;
        const fx = (dx / d) * pair;
        const fy = (dy / d) * pair;
        Body.applyForce(a, a.position, { x: fx, y: fy });
        Body.applyForce(b, b.position, { x: -fx, y: -fy });
      }
    }
  };

  const collisionStart = (ev: {
    pairs?: { bodyA: import("matter-js").Body; bodyB: import("matter-js").Body; collision?: { supports?: { x: number; y: number }[] } }[];
  }) => {
    const pairs = ev.pairs || [];
    for (let p = 0; p < pairs.length; p++) {
      const pair = pairs[p];
      const a = pair.bodyA;
      const b = pair.bodyB;
      const ca = isChipBody(a);
      const cb = isChipBody(b);
      if (!ca && !cb) continue;

      let scale = 0.55;
      if (ca && cb) scale = 1;

      const col = pair.collision;
      let x = (a.position.x + b.position.x) / 2;
      let y = (a.position.y + b.position.y) / 2;
      if (col && col.supports && col.supports.length) {
        const s0 = col.supports[0];
        x = s0.x;
        y = s0.y;
      }

      if (ripples.length > 14) ripples.shift();
      ripples.push({ x, y, born: performance.now(), scale });
    }
  };

  const width = scene.clientWidth;
  const height = scene.clientHeight;
  if (width < 32 || height < 32) return () => {};

  attractorT0 = performance.now();
  ripples = [];

  engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 * gScale } });
  const world = engine.world;

  runner = Runner.create();
  Runner.run(runner, engine);

  wallBodies = createBounds(Matter, width, height);
  World.add(world, wallBodies);

  const opts = { restitution: 0.6, friction: 0.06, frictionAir: 0.012, density: 0.002 };
  bodies = [
    Bodies.circle(width * 0.22, height * 0.35, R, opts),
    Bodies.circle(width * 0.52, height * 0.38, R, opts),
    Bodies.circle(width * 0.78, height * 0.32, R, opts),
  ];
  World.add(world, bodies);

  const chipPrototypes = els.slice(0, 3);

  const spawnChipAt = (px: number, py: number) => {
    if (!engine || bodies.length >= MAX_CHIPS) return false;
    const bw = scene.clientWidth;
    const bh = scene.clientHeight;
    if (bw < 32 || bh < 32) return false;
    const pad = R + 6;
    const x = Math.min(Math.max(px, pad), bw - pad);
    const y = Math.min(Math.max(py, pad), bh - pad);
    if (Query.point(bodies, { x, y }).length > 0) return false;

    const variant = bodies.length % 3;
    const clone = chipPrototypes[variant].cloneNode(true) as HTMLElement;
    clone.setAttribute("data-chip", String(bodies.length));
    clone.style.transform = `translate(${x - R}px,${y - R}px) rotate(0rad)`;
    scene.appendChild(clone);

    const body = Bodies.circle(x, y, R, opts);
    World.add(world, body);
    bodies.push(body);
    els.push(clone);

    Body.setVelocity(body, {
      x: (Math.random() - 0.5) * 0.35,
      y: (Math.random() - 0.5) * 0.35,
    });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);

    if (ripples.length > 14) ripples.shift();
    ripples.push({ x, y, born: performance.now(), scale: 0.72 });
    return true;
  };

  let pointerDownHitChip = false;
  let lastSpawnAt = 0;

  const syncPointerDownHit = (clientX: number, clientY: number) => {
    if (!engine || bodies.length === 0) return;
    const pt = pointerInRoot(clientX, clientY);
    pointerDownHitChip = Query.point(bodies, pt).length > 0;
  };

  const mouse = Mouse.create(scene);
  syncMouse(mouse);

  mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.28,
      damping: 0.08,
      render: { visible: false },
    },
  });
  mouseConstraint.constraint.render.visible = false;
  World.add(world, mouseConstraint);

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    syncPointerDownHit(e.clientX, e.clientY);
  };
  const onTouchStart = (e: TouchEvent) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    syncPointerDownHit(t.clientX, t.clientY);
  };
  const onClick = (e: MouseEvent) => {
    if (!engine || bodies.length === 0) return;
    if (pointerDownHitChip) return;
    const now = performance.now();
    if (now - lastSpawnAt < 220) return;
    const pt = pointerInRoot(e.clientX, e.clientY);
    if (Query.point(bodies, pt).length > 0) return;
    if (spawnChipAt(pt.x, pt.y)) lastSpawnAt = now;
  };

  const releaseMouseIfOutside = () => {
    if (mouseConstraint?.mouse) mouseConstraint.mouse.button = -1;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!engine || bodies.length === 0) return;
    const pt = pointerInRoot(e.clientX, e.clientY);
    const found = Query.point(bodies, pt);
    const idx = found.length ? bodies.indexOf(found[0]) : -1;
    if (mouseConstraint?.body) {
      setHover(-1);
      return;
    }
    setHover(idx);
  };

  const onMouseLeave = () => setHover(-1);

  const onDblClick = (e: MouseEvent) => {
    if (!engine || bodies.length === 0) return;
    const pt = pointerInRoot(e.clientX, e.clientY);
    const found = Query.point(bodies, pt);
    if (!found.length) return;
    const b = found[0];
    const dx = b.position.x - pt.x;
    const dy = b.position.y - pt.y;
    const len = Math.hypot(dx, dy) || 1;
    const push = 0.00042;
    Body.applyForce(b, b.position, { x: (dx / len) * push, y: (dy / len) * push });
    Body.setAngularVelocity(b, b.angularVelocity + (Math.random() - 0.5) * 0.08);
  };

  scene.addEventListener("mousedown", onMouseDown, { passive: true, signal });
  scene.addEventListener("touchstart", onTouchStart, { passive: true, signal });
  scene.addEventListener("click", onClick, { passive: true, signal });
  scene.addEventListener("mousemove", onMouseMove, { passive: true, signal });
  scene.addEventListener("mouseleave", onMouseLeave, { passive: true, signal });
  scene.addEventListener("dblclick", onDblClick, { passive: true, signal });
  window.addEventListener("mouseup", releaseMouseIfOutside, { passive: true, signal });
  window.addEventListener("touchend", releaseMouseIfOutside, { passive: true, signal });

  const onStartDrag = (ev: { body: import("matter-js").Body | null }) => {
    const i = ev.body != null ? bodies.indexOf(ev.body) : -1;
    if (i >= 0) els[i].classList.add("hero-matter-chip--drag");
  };
  const onEndDrag = (ev: { body: import("matter-js").Body | null }) => {
    const i = ev.body != null ? bodies.indexOf(ev.body) : -1;
    if (i >= 0) els[i].classList.remove("hero-matter-chip--drag");
    else clearDragClasses();
  };

  Events.on(mouseConstraint, "startdrag", onStartDrag);
  Events.on(mouseConstraint, "enddrag", onEndDrag);
  Events.on(engine, "beforeUpdate", beforeUpdate);
  Events.on(engine, "collisionStart", collisionStart);

  const ctx = canvas.getContext("2d");
  const ambCtx = ambientCanvas?.getContext("2d") ?? null;
  const bleed = 80;

  const drawAmbient = (t: number) => {
    if (!ambCtx || !ambientCanvas) return;
    const sw = scene.clientWidth + bleed * 2;
    const sh = scene.clientHeight + bleed * 2;
    paintAmbientWater(ambCtx, sw, sh, t);
  };

  const loop = () => {
    const cw = scene.clientWidth;
    const ch = scene.clientHeight;
    const now = performance.now();
    frameCount++;

    if (ambientCanvas && ambCtx && frameCount % 2 === 0) {
      drawAmbient(now);
    }

    if (ctx && cw > 0 && ch > 0) {
      ctx.clearRect(0, 0, cw, ch);
      const [r0, g0, b0] = tokens.rippleRgb.split(",").map((s) => parseFloat(s.trim()));
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const age = now - r.born;
        const life = 380;
        if (age > life) {
          ripples.splice(i, 1);
          continue;
        }
        const u = age / life;
        const radius = (6 + u * 52) * r.scale;
        ctx.strokeStyle = `rgba(${r0}, ${g0}, ${b0}, ${0.55 * (1 - u)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      els[i].style.transform = `translate(${b.position.x - R}px,${b.position.y - R}px) rotate(${b.angle}rad)`;
      const fe = followerEls[i];
      if (fe) {
        const fw = R * 2.2;
        fe.style.transform = `translate(${b.position.x - fw / 2}px,${b.position.y + R * 0.72}px) rotate(${b.angle * 0.35}rad)`;
      }
    }
    rafId = window.requestAnimationFrame(loop);
  };
  resizeCanvas(canvas, scene);
  if (ambientCanvas) resizeAmbientCanvas(ambientCanvas, scene, bleed);
  if (ambCtx) drawAmbient(performance.now());
  rafId = window.requestAnimationFrame(loop);

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const ro = new ResizeObserver(() => {
    if (resizeTimer !== undefined) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeTimer = undefined;
      if (!engine) return;
      rebuildWorldSize();
      if (mouseConstraint) syncMouse(mouseConstraint.mouse);
    }, 120);
  });
  ro.observe(scene);

  return () => {
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (resizeTimer !== undefined) window.clearTimeout(resizeTimer);
    resizeTimer = undefined;
    ac.abort();
    ro.disconnect();

    if (mouseConstraint) {
      Events.off(mouseConstraint, "startdrag", onStartDrag);
      Events.off(mouseConstraint, "enddrag", onEndDrag);
    }
    if (engine) {
      Events.off(engine, "beforeUpdate", beforeUpdate);
      Events.off(engine, "collisionStart", collisionStart);
    }

    if (runner) Runner.stop(runner);
    runner = null;

    if (engine) {
      World.clear(engine.world);
      Engine.clear(engine);
    }
    engine = null;
    mouseConstraint = null;
    bodies = [];
    wallBodies = [];
    ripples = [];
  };
}
