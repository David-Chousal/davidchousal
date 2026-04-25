/**
 * Duck pond slide — autonomous swimming ducks, feed interactions, food particles.
 * Matter.js zero-gravity for water physics; heading smoothed from velocity.
 */
import type { HeroIllustrationSlide, HeroSlideFactory } from "../types";

const DUCK_PX = 52;
const DUCK_R = DUCK_PX / 2;
const MAX_DUCKS = 20;
const FEED_MS = 2200;
const FOOD_LIFE_MS = 4500;
const SPAWN_COOL_MS = 250;

const SVG_A = `<svg viewBox="0 0 48 48" class="h-full w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="24" cy="26" rx="7" ry="8.5" fill="#ede8e0"/>
  <path d="M17.5 28 Q20 34 24 35 Q28 34 30.5 28" fill="#d8d0c4" opacity="0.45"/>
  <ellipse cx="24" cy="18.5" rx="2.3" ry="1.5" fill="#e8e2d8"/>
  <circle cx="24" cy="15.2" r="3.2" fill="#faf7f2" stroke="#c8c0b2" stroke-width="0.35"/>
  <circle cx="21.3" cy="15" r="0.55" fill="#1a1a1a"/><circle cx="26.7" cy="15" r="0.55" fill="#1a1a1a"/>
  <circle cx="21.5" cy="14.8" r="0.18" fill="white" opacity="0.65"/><circle cx="26.9" cy="14.8" r="0.18" fill="white" opacity="0.65"/>
  <path d="M20.8 13.5 Q20.2 11.5 21.5 10 Q24 8.5 26.5 10 Q27.8 11.5 27.2 13.5 Z" fill="#f0c060" stroke="#c07820" stroke-width="0.3" opacity="0.9"/>
</svg>`;

const SVG_B = `<svg viewBox="0 0 48 48" class="h-full w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="24" cy="26" rx="7" ry="8.5" fill="#e8e4dc"/>
  <path d="M17.5 28 Q20 34 24 35 Q28 34 30.5 28" fill="#cec6ba" opacity="0.4"/>
  <ellipse cx="24" cy="18.5" rx="2.3" ry="1.5" fill="#f0ebe3"/>
  <circle cx="24" cy="15.2" r="3.2" fill="#f8f6f1" stroke="#b8b0a0" stroke-width="0.35"/>
  <circle cx="21.3" cy="15" r="0.55" fill="#1a1a1a"/><circle cx="26.7" cy="15" r="0.55" fill="#1a1a1a"/>
  <path d="M20.8 13.5 Q20.2 11.5 21.5 10 Q24 8.5 26.5 10 Q27.8 11.5 27.2 13.5 Z" fill="#e8a848" stroke="#a06018" stroke-width="0.35" opacity="0.95"/>
  <path d="M22 34 Q24 38 26 34" fill="none" stroke="#b8a898" stroke-width="0.8" stroke-linecap="round"/>
</svg>`;

const SVG_C = `<svg viewBox="0 0 48 48" class="h-full w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="24" cy="26" rx="7" ry="8.5" fill="#f2eee6"/>
  <path d="M17.5 28 Q20 34 24 35 Q28 34 30.5 28" fill="#d4ccc0" opacity="0.38"/>
  <path d="M17 21 Q15.5 26.5 17 32.5 Q19.5 27 17 21Z" fill="#e8e2d8" opacity="0.9"/>
  <path d="M31 21 Q32.5 26.5 31 32.5 Q28.5 27 31 21Z" fill="#e8e2d8" opacity="0.9"/>
  <ellipse cx="24" cy="18.5" rx="2.3" ry="1.5" fill="#ede8e0"/>
  <circle cx="24" cy="15.2" r="3.2" fill="#fffefb" stroke="#d0c8bc" stroke-width="0.3"/>
  <circle cx="21.3" cy="15" r="0.55" fill="#1a1a1a"/><circle cx="26.7" cy="15" r="0.55" fill="#1a1a1a"/>
  <path d="M20.8 13.5 Q20.2 11.5 21.5 10 Q24 8.5 26.5 10 Q27.8 11.5 27.2 13.5 Z" fill="#f5c86a" stroke="#b07020" stroke-width="0.28" opacity="0.92"/>
</svg>`;

const SVG_VARIANTS = [SVG_A, SVG_B, SVG_C];

interface Duck {
  body: import("matter-js").Body;
  el: HTMLElement;
  shadow: HTMLElement | null;
  bornAt: number;
  heading: number;
  targetHeading: number;
  bobPhase: number;
  bobSpeed: number;
  wanderAngle: number;
  wanderTimer: number;
  feedUntil: number;
  /** Timestamp when the current speed burst ends (0 = not dashing). */
  dashUntil: number;
  /** Timestamp when the next dash should trigger. */
  dashTimer: number;
  /** Throttle for movement-trail ripples. */
  rippleTimer: number;
}

interface Ripple { x: number; y: number; born: number; scale: number; }
interface Crumb { x: number; y: number; vx: number; vy: number; born: number; r: number; }
interface Food { x: number; y: number; born: number; }

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

function sizeFx(canvas: HTMLCanvasElement, el: HTMLElement): void {
  const dpr = window.devicePixelRatio || 1;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function makeDuckEl(variant: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "dp-duck pointer-events-none absolute left-0 top-0 z-10 will-change-transform";
  el.style.cssText = `width:${DUCK_PX}px;height:${DUCK_PX}px`;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = SVG_VARIANTS[variant % 3];
  return el;
}

function makeShadowEl(): HTMLElement {
  const el = document.createElement("div");
  el.className = "dp-shadow pointer-events-none absolute left-0 top-0 z-[5] will-change-transform";
  el.style.cssText = `width:${DUCK_PX * 1.1}px;height:${DUCK_PX * 0.3}px;background:rgba(26,74,101,0.12);border-radius:9999px;filter:blur(5px)`;
  el.setAttribute("aria-hidden", "true");
  return el;
}

function buildDom(): string {
  const initialDucks = SVG_VARIANTS.map(
    (svg, i) =>
      `<div class="dp-duck pointer-events-none absolute left-0 top-0 z-10 will-change-transform" style="width:${DUCK_PX}px;height:${DUCK_PX}px" aria-hidden="true">${svg}</div>`
  ).join("");
  const initialShadows = [0, 1, 2]
    .map(
      () =>
        `<div class="dp-shadow pointer-events-none absolute left-0 top-0 z-[5] will-change-transform" style="width:${DUCK_PX * 1.1}px;height:${DUCK_PX * 0.3}px;background:rgba(26,74,101,0.12);border-radius:9999px;filter:blur(5px)" aria-hidden="true"></div>`
    )
    .join("");
  return `<div data-dp-scene class="absolute inset-[1.25px] overflow-hidden rounded-[inherit]">
    <div class="pointer-events-none absolute inset-0" style="background:linear-gradient(168deg,#9dd5c8 0%,#62b8a6 38%,#40a090 62%,#2e8070 100%)"></div>
    <div class="pointer-events-none absolute inset-0" style="background:radial-gradient(ellipse 68% 58% at 50% 58%,rgba(12,52,44,0.30) 0%,transparent 80%)"></div>
    <div class="pointer-events-none absolute inset-0" style="background:radial-gradient(ellipse 55% 45% at 32% 20%,rgba(255,255,255,0.20) 0%,transparent 70%),radial-gradient(ellipse 30% 25% at 75% 12%,rgba(255,255,255,0.12) 0%,transparent 65%)"></div>
    <svg class="pointer-events-none absolute inset-0 z-[1] w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- grassy bank bottom -->
      <ellipse cx="50" cy="105" rx="72" ry="20" fill="#4e9248" opacity="0.28"/>
      <ellipse cx="8" cy="100" rx="22" ry="14" fill="#4e9248" opacity="0.20"/>
      <!-- water shimmer streaks -->
      <line x1="26" y1="18" x2="48" y2="18" stroke="white" stroke-width="0.7" stroke-linecap="round" opacity="0.22"/>
      <line x1="55" y1="26" x2="72" y2="26" stroke="white" stroke-width="0.5" stroke-linecap="round" opacity="0.16"/>
      <line x1="14" y1="34" x2="30" y2="34" stroke="white" stroke-width="0.5" stroke-linecap="round" opacity="0.14"/>
      <line x1="68" y1="42" x2="80" y2="42" stroke="white" stroke-width="0.4" stroke-linecap="round" opacity="0.12"/>
      <!-- lily pad 1 — large, lower-left -->
      <g transform="translate(19,72) rotate(20)">
        <ellipse cx="0" cy="0" rx="7.0" ry="5.0" fill="#3e8838" opacity="0.75"/>
        <ellipse cx="0" cy="0" rx="7.0" ry="5.0" fill="none" stroke="#62ac54" stroke-width="0.55" opacity="0.55"/>
        <line x1="0" y1="0" x2="0" y2="-5.0" stroke="#2d6620" stroke-width="0.45" opacity="0.45"/>
        <line x1="0" y1="0" x2="4.2" y2="3.0" stroke="#2d6620" stroke-width="0.35" opacity="0.38"/>
        <line x1="0" y1="0" x2="-4.2" y2="3.0" stroke="#2d6620" stroke-width="0.35" opacity="0.38"/>
        <path d="M0,-5 L1.4,-5 A0.8,0.8 0 0 0 -1.4,-5 Z" fill="#2d8832" opacity="0.5"/>
      </g>
      <!-- lily pad 2 — small with flower, upper-right -->
      <g transform="translate(73,30) rotate(-18)">
        <ellipse cx="0" cy="0" rx="4.5" ry="3.2" fill="#4a9a42" opacity="0.68"/>
        <ellipse cx="0" cy="0" rx="4.5" ry="3.2" fill="none" stroke="#72c062" stroke-width="0.45" opacity="0.50"/>
        <line x1="0" y1="0" x2="0" y2="-3.2" stroke="#2d6620" stroke-width="0.35" opacity="0.40"/>
        <circle cx="0.3" cy="-0.6" r="1.3" fill="white" opacity="0.78"/>
        <circle cx="0.3" cy="-0.6" r="0.6" fill="#f0b820" opacity="0.92"/>
        <circle cx="0.3" cy="-0.6" r="0.25" fill="#d08000" opacity="0.8"/>
      </g>
      <!-- lily pad 3 — medium, bottom-center -->
      <g transform="translate(52,84) rotate(75)">
        <ellipse cx="0" cy="0" rx="6.0" ry="4.2" fill="#367a32" opacity="0.62"/>
        <ellipse cx="0" cy="0" rx="6.0" ry="4.2" fill="none" stroke="#58a050" stroke-width="0.50" opacity="0.42"/>
        <line x1="0" y1="0" x2="0" y2="-4.2" stroke="#245820" stroke-width="0.40" opacity="0.38"/>
        <line x1="0" y1="0" x2="3.6" y2="2.5" stroke="#245820" stroke-width="0.30" opacity="0.32"/>
      </g>
      <!-- lily pad 4 — small, right-center -->
      <g transform="translate(85,50) rotate(145)">
        <ellipse cx="0" cy="0" rx="4.0" ry="2.9" fill="#3e8838" opacity="0.60"/>
        <ellipse cx="0" cy="0" rx="4.0" ry="2.9" fill="none" stroke="#60a852" stroke-width="0.40" opacity="0.44"/>
        <line x1="0" y1="0" x2="0" y2="-2.9" stroke="#2d6620" stroke-width="0.30" opacity="0.35"/>
      </g>
      <!-- lily pad 5 — tiny accent, far right -->
      <g transform="translate(93,67) rotate(210)">
        <ellipse cx="0" cy="0" rx="2.8" ry="2.0" fill="#4a9a42" opacity="0.52"/>
      </g>
      <!-- lily pad 6 — tiny, upper-left area -->
      <g transform="translate(33,14) rotate(55)">
        <ellipse cx="0" cy="0" rx="3.2" ry="2.4" fill="#4a9a42" opacity="0.48"/>
      </g>
      <!-- floating algae/duckweed -->
      <ellipse cx="62" cy="76" rx="4.5" ry="2.0" fill="#5aaa40" opacity="0.20"/>
      <ellipse cx="28" cy="85" rx="3.5" ry="1.6" fill="#5aaa40" opacity="0.16"/>
      <ellipse cx="44" cy="55" rx="2.5" ry="1.2" fill="#5aaa40" opacity="0.14"/>
    </svg>
    <canvas class="dp-fx pointer-events-none absolute inset-0 z-[2] w-full h-full" aria-hidden="true"></canvas>
    ${initialDucks}${initialShadows}
    <button class="dp-spawn pointer-events-auto absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full bg-white/65 backdrop-blur-sm border border-white/40 px-2.5 py-1 text-[11px] font-medium text-teal-950 hover:bg-white/85 active:scale-95 transition-all shadow-sm select-none" aria-label="Add a duck to the pond">
      <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Duck
    </button>
  </div>`;
}

function staticPlace(root: HTMLElement): void {
  const scene = root.querySelector<HTMLElement>("[data-dp-scene]");
  if (!scene) return;
  const w = scene.clientWidth;
  const h = scene.clientHeight;
  const spots = [
    { x: w * 0.22, y: h * 0.38, a: -0.2 },
    { x: w * 0.52, y: h * 0.45, a: 0.15 },
    { x: w * 0.78, y: h * 0.35, a: -0.05 },
  ];
  const ducks = Array.from(root.querySelectorAll<HTMLElement>(".dp-duck"));
  ducks.forEach((el, i) => {
    const s = spots[i];
    if (!s) return;
    el.style.transform = `translate(${s.x - DUCK_R}px,${s.y - DUCK_R}px) rotate(${s.a}rad)`;
  });
}

export const createDuckPondSlide: HeroSlideFactory = (prefersReducedMotion) => {
  let root: HTMLElement | null = null;
  let stop: (() => void) | null = null;
  let staticRo: ResizeObserver | null = null;
  let active = false;
  /** Set by startEngine; called when spawn button is clicked. */
  let spawnRef: (() => void) | null = null;

  const slide: HeroIllustrationSlide = {
    mount(el) {
      root = el;
      el.dataset.duckPond = "1";
      el.className =
        "relative isolate h-full min-h-0 w-full cursor-grab touch-none overflow-hidden rounded-[inherit] select-none active:cursor-grabbing bg-[#2e8070]";
      el.setAttribute(
        "aria-label",
        "Duck pond. Click ducks to feed them, click water to drop food, press the Duck button or Space to add more ducks."
      );
      el.innerHTML = buildDom();
      const scene = el.querySelector<HTMLElement>("[data-dp-scene]");
      const canvas = scene?.querySelector<HTMLCanvasElement>(".dp-fx");
      if (scene && canvas) sizeFx(canvas, scene);

      // Register spawn button listener once — delegates to spawnRef set by engine.
      const spawnBtn = el.querySelector<HTMLButtonElement>(".dp-spawn");
      spawnBtn?.addEventListener("click", (e: MouseEvent) => {
        e.stopPropagation();
        spawnRef?.();
      });

      if (prefersReducedMotion) {
        staticPlace(el);
        staticRo = new ResizeObserver(() => {
          if (root) staticPlace(root);
        });
        staticRo.observe(el);
      }
    },
    pause() {
      active = false;
      stop?.();
      stop = null;
    },
    resume() {
      if (prefersReducedMotion || !root) return;
      if (active) return;
      active = true;
      if (!root.querySelector("[data-dp-scene]")) {
        root.innerHTML = buildDom();
      }
      void import("matter-js")
        .then((mod) => {
          if (!active || !root) return;
          stop?.();
          stop = startEngine(mod.default, root, (fn) => { spawnRef = fn; });
        })
        .catch(() => {
          if (root) staticPlace(root);
        });
    },
    destroy() {
      active = false;
      stop?.();
      stop = null;
      staticRo?.disconnect();
      staticRo = null;
      if (root) {
        root.innerHTML = "";
        delete root.dataset.duckPond;
      }
      root = null;
    },
  };
  return slide;
};

function startEngine(
  Matter: typeof import("matter-js").default,
  root: HTMLElement,
  setSpawnRef: (fn: (() => void) | null) => void
): () => void {
  const scene = root.querySelector<HTMLElement>("[data-dp-scene]");
  const canvas = scene?.querySelector<HTMLCanvasElement>(".dp-fx");
  if (!scene || !canvas) return () => {};

  let W = scene.clientWidth;
  let H = scene.clientHeight;
  if (W < 32 || H < 32) return () => {};

  sizeFx(canvas, scene);

  const { Engine, Runner, World, Bodies, Body, Mouse, MouseConstraint, Events, Query } = Matter;
  const ac = new AbortController();
  const { signal } = ac;

  const engine = Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
  const world = engine.world;
  const runner = Runner.create();
  Runner.run(runner, engine);

  const wallT = 48;
  const makeWalls = (w: number, h: number) => [
    Bodies.rectangle(w / 2, h + wallT / 2, w + wallT * 4, wallT, { isStatic: true }),
    Bodies.rectangle(-wallT / 2, h / 2, wallT, h + wallT * 4, { isStatic: true }),
    Bodies.rectangle(w + wallT / 2, h / 2, wallT, h + wallT * 4, { isStatic: true }),
    Bodies.rectangle(w / 2, -wallT / 2, w + wallT * 4, wallT, { isStatic: true }),
  ];
  let walls = makeWalls(W, H);
  World.add(world, walls);

  const ducks: Duck[] = [];
  let ripples: Ripple[] = [];
  let crumbs: Crumb[] = [];
  let food: Food | null = null;
  let rafId = 0;
  let lastSpawn = 0;
  let frameN = 0;

  const duckOpts = { restitution: 0.35, friction: 0.01, frictionAir: 0.012, density: 0.0015 };

  const proto = {
    ducks: Array.from(scene.querySelectorAll<HTMLElement>(".dp-duck")),
    shadows: Array.from(scene.querySelectorAll<HTMLElement>(".dp-shadow")),
  };

  const addDuckToScene = (
    x: number,
    y: number,
    duckEl: HTMLElement,
    shadowEl: HTMLElement | null,
    angle: number
  ): Duck => {
    const body = Bodies.circle(x, y, DUCK_R, duckOpts);
    Body.setVelocity(body, { x: Math.cos(angle) * 0.6, y: Math.sin(angle) * 0.6 });
    World.add(world, body);
    const duck: Duck = {
      body,
      el: duckEl,
      shadow: shadowEl,
      bornAt: performance.now(),
      heading: angle + Math.PI / 2,
      targetHeading: angle + Math.PI / 2,
      bobPhase: Math.random() * Math.PI * 2,
      bobSpeed: 0.75 + Math.random() * 0.5,
      wanderAngle: angle,
      wanderTimer: performance.now() + 2000 + Math.random() * 3000,
      feedUntil: 0,
      dashUntil: 0,
      dashTimer: performance.now() + 4000 + Math.random() * 8000,
      rippleTimer: 0,
    };
    ducks.push(duck);
    return duck;
  };

  // Initialise 3 ducks from pre-rendered prototype elements — spread across pond quadrants
  const initialPositions = [
    { x: W * 0.18, y: H * 0.22 },
    { x: W * 0.72, y: H * 0.62 },
    { x: W * 0.42, y: H * 0.80 },
  ];
  for (let i = 0; i < 3; i++) {
    const p = initialPositions[i];
    const angle = Math.random() * Math.PI * 2;
    addDuckToScene(p.x, p.y, proto.ducks[i], proto.shadows[i] ?? null, angle);
  }

  const spawnDuck = (px: number, py: number): boolean => {
    const now = performance.now();
    if (now - lastSpawn < SPAWN_COOL_MS) return false;
    const pad = DUCK_R + 8;
    const x = Math.min(Math.max(px, pad), W - pad);
    const y = Math.min(Math.max(py, pad), H - pad);
    if (Query.point(ducks.map((d) => d.body), { x, y }).length) return false;

    if (ducks.length >= MAX_DUCKS) {
      const oldest = ducks.shift()!;
      World.remove(world, oldest.body);
      oldest.el.remove();
      oldest.shadow?.remove();
    }

    const variant = ducks.length % 3;
    const duckEl = makeDuckEl(variant);
    const shadowEl = makeShadowEl();
    const spawnBtn = scene.querySelector<HTMLButtonElement>(".dp-spawn");
    scene.insertBefore(shadowEl, spawnBtn);
    scene.insertBefore(duckEl, spawnBtn);

    const angle = Math.random() * Math.PI * 2;
    addDuckToScene(x, y, duckEl, shadowEl, angle);
    if (ripples.length > 14) ripples.shift();
    ripples.push({ x, y, born: now, scale: 0.85 });
    lastSpawn = now;
    return true;
  };

  const feedDuck = (duck: Duck): void => {
    const now = performance.now();
    duck.feedUntil = now + FEED_MS;
    const vx = duck.body.velocity.x;
    const vy = duck.body.velocity.y;
    Body.setVelocity(duck.body, { x: vx * 0.3, y: vy * 0.3 });
    if (ripples.length > 14) ripples.shift();
    ripples.push({ x: duck.body.position.x, y: duck.body.position.y, born: now, scale: 0.65 });
    for (let i = 0; i < 7; i++) {
      if (crumbs.length > 50) crumbs.shift();
      crumbs.push({
        x: duck.body.position.x + (Math.random() - 0.5) * 28,
        y: duck.body.position.y - 8 + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 0.4 + Math.random() * 0.6,
        born: now,
        r: 1.5 + Math.random() * 2,
      });
    }
  };

  const dropFood = (x: number, y: number): void => {
    const now = performance.now();
    food = { x, y, born: now };
    if (ripples.length > 14) ripples.shift();
    ripples.push({ x, y, born: now, scale: 0.7 });
    for (let i = 0; i < 5; i++) {
      if (crumbs.length > 50) crumbs.shift();
      crumbs.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y - 4,
        vx: (Math.random() - 0.5) * 1.0,
        vy: 0.3 + Math.random() * 0.5,
        born: now,
        r: 1.5 + Math.random() * 2,
      });
    }
  };

  const beforeUpdate = () => {
    const now = performance.now();
    const foodActive = food !== null && now - food.born < FOOD_LIFE_MS;

    for (const duck of ducks) {
      const { x, y } = duck.body.position;
      const isFeeding = now < duck.feedUntil;

      if (isFeeding) continue;

      // Eat food when close enough
      if (foodActive && food && Math.hypot(food.x - x, food.y - y) < DUCK_R + 14) {
        feedDuck(duck);
        food = null;
        continue;
      }

      // Occasional speed burst every 8–20 s
      if (now > duck.dashTimer) {
        const dashAngle = foodActive && food
          ? Math.atan2(food.y - y, food.x - x) + (Math.random() - 0.5) * 0.5
          : Math.random() * Math.PI * 2;
        const dashSpeed = 1.5 + Math.random() * 0.5;
        duck.wanderAngle = dashAngle;
        Body.setVelocity(duck.body, { x: Math.cos(dashAngle) * dashSpeed, y: Math.sin(dashAngle) * dashSpeed });
        duck.dashUntil = now + 700 + Math.random() * 600;
        duck.dashTimer = now + 8000 + Math.random() * 12000;
        duck.wanderTimer = now + 900 + Math.random() * 700;
        continue;
      }

      // Cruise wander — retick faster when chasing food
      const wanderInterval = foodActive ? 500 + Math.random() * 400 : 2200 + Math.random() * 1800;
      if (now > duck.wanderTimer) {
        const angle = foodActive && food
          ? Math.atan2(food.y - y, food.x - x) + (Math.random() - 0.5) * 0.7
          : Math.random() * Math.PI * 2;
        duck.wanderAngle = angle;
        const cruiseSpeed = 0.5 + Math.random() * 0.3; // ~0.5–0.8 px/step ≈ 30–48 px/s
        Body.setVelocity(duck.body, { x: Math.cos(angle) * cruiseSpeed, y: Math.sin(angle) * cruiseSpeed });
        duck.wanderTimer = now + wanderInterval;
      }

      // Speed cap
      const isDashing = now < duck.dashUntil;
      const maxSpeed = isDashing ? 2.1 : 0.9;
      const svx = duck.body.velocity.x;
      const svy = duck.body.velocity.y;
      const spd2 = svx * svx + svy * svy;
      if (spd2 > maxSpeed * maxSpeed) {
        const s = maxSpeed / Math.sqrt(spd2);
        Body.setVelocity(duck.body, { x: svx * s, y: svy * s });
      }
    }
  };

  Events.on(engine, "beforeUpdate", beforeUpdate);

  const collisionStart = (ev: {
    pairs?: { bodyA: import("matter-js").Body; bodyB: import("matter-js").Body }[];
  }) => {
    const bodySet = new Set(ducks.map((d) => d.body));
    for (const pair of ev.pairs ?? []) {
      if (!bodySet.has(pair.bodyA) && !bodySet.has(pair.bodyB)) continue;
      const cx = (pair.bodyA.position.x + pair.bodyB.position.x) / 2;
      const cy = (pair.bodyA.position.y + pair.bodyB.position.y) / 2;
      if (ripples.length > 14) ripples.shift();
      ripples.push({ x: cx, y: cy, born: performance.now(), scale: 0.4 });
    }
  };
  Events.on(engine, "collisionStart", collisionStart);

  // Mouse drag
  const mouse = Mouse.create(scene);
  mouse.offset.x = 0; mouse.offset.y = 0;
  mouse.scale.x = 1; mouse.scale.y = 1;
  const mc = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.22, damping: 0.1, render: { visible: false } },
  });
  mc.constraint.render.visible = false;
  World.add(world, mc);

  const scenePos = (cX: number, cY: number) => {
    const r = scene.getBoundingClientRect();
    return { x: cX - r.left, y: cY - r.top };
  };
  const duckAt = (pt: { x: number; y: number }) => {
    const hits = Query.point(ducks.map((d) => d.body), pt);
    if (!hits.length) return null;
    return ducks.find((d) => d.body === hits[0]) ?? null;
  };

  let downOnDuck = false;
  scene.addEventListener("mousedown", (e: MouseEvent) => {
    if (e.button !== 0) return;
    downOnDuck = duckAt(scenePos(e.clientX, e.clientY)) !== null;
  }, { passive: true, signal });
  scene.addEventListener("touchstart", (e: TouchEvent) => {
    const t = e.changedTouches[0];
    if (t) downOnDuck = duckAt(scenePos(t.clientX, t.clientY)) !== null;
  }, { passive: true, signal });

  scene.addEventListener("click", (e: MouseEvent) => {
    const pt = scenePos(e.clientX, e.clientY);
    const duck = duckAt(pt);
    if (duck) { feedDuck(duck); return; }
    if (downOnDuck) return;
    dropFood(pt.x, pt.y);
  }, { passive: true, signal });

  scene.addEventListener("touchend", (e: TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t) return;
    const pt = scenePos(t.clientX, t.clientY);
    const duck = duckAt(pt);
    if (duck) { feedDuck(duck); return; }
    if (!downOnDuck) dropFood(pt.x, pt.y);
  }, { passive: true, signal });

  const spawnBtn = scene.querySelector<HTMLButtonElement>(".dp-spawn");
  // Stop mousedown/touchstart propagation so Matter.js doesn't call preventDefault() and block click.
  spawnBtn?.addEventListener("mousedown", (e: MouseEvent) => e.stopPropagation(), { signal });
  spawnBtn?.addEventListener("touchstart", (e: TouchEvent) => e.stopPropagation(), { signal });
  // Expose spawnDuck for the permanent click handler registered in mount().
  setSpawnRef(() => {
    spawnDuck(
      DUCK_R * 2 + Math.random() * (W - DUCK_R * 4),
      DUCK_R * 2 + Math.random() * (H - DUCK_R * 4)
    );
  });

  scene.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== " " && e.key !== "Enter") return;
    if (document.activeElement !== scene && document.activeElement !== root) return;
    e.preventDefault();
    spawnDuck(
      DUCK_R * 2 + Math.random() * (W - DUCK_R * 4),
      DUCK_R * 2 + Math.random() * (H - DUCK_R * 4)
    );
  }, { signal });
  scene.setAttribute("tabindex", "0");

  window.addEventListener("mouseup", () => { if (mc.mouse) mc.mouse.button = -1; }, { passive: true, signal });
  window.addEventListener("touchend", () => { if (mc.mouse) mc.mouse.button = -1; }, { passive: true, signal });

  // Render loop
  const ctx = canvas.getContext("2d");
  const loop = () => {
    const now = performance.now();
    frameN++;

    if (food && now - food.born >= FOOD_LIFE_MS) food = null;

    if (ctx && W > 0 && H > 0) {
      ctx.clearRect(0, 0, W, H);

      // Crumbs (food particles)
      for (let i = crumbs.length - 1; i >= 0; i--) {
        const c = crumbs[i];
        const age = now - c.born;
        if (age > 1400) { crumbs.splice(i, 1); continue; }
        c.x += c.vx; c.y += c.vy;
        c.vy *= 0.97; c.vx *= 0.96;
        const alpha = 0.85 * (1 - age / 1400);
        ctx.fillStyle = `rgba(210,155,65,${alpha})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Food target ring
      if (food) {
        const age = now - food.born;
        const pulse = 0.28 + 0.18 * Math.sin(age * 0.006);
        ctx.strokeStyle = `rgba(175,135,55,${pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(food.x, food.y, 13, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        const age = now - rp.born;
        if (age > 520) { ripples.splice(i, 1); continue; }
        const u = age / 520;
        ctx.strokeStyle = `rgba(125,211,252,${0.5 * (1 - u)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, (5 + u * 58) * rp.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Sync duck elements
    for (const duck of ducks) {
      const { body, el, shadow } = duck;
      const { x, y } = body.position;
      const { x: vx, y: vy } = body.velocity;
      const isFeeding = now < duck.feedUntil;
      const isDashing = now < duck.dashUntil;

      // Movement-trail ripple
      const spd = Math.hypot(vx, vy);
      if (spd > 0.45 && now > duck.rippleTimer) {
        if (ripples.length > 18) ripples.shift();
        ripples.push({ x, y, born: now, scale: 0.28 + spd * 0.04 });
        duck.rippleTimer = now + (isDashing ? 380 : 820) + Math.random() * 160;
      }

      // Smooth heading — turn faster while dashing
      if (spd > 0.12) duck.targetHeading = Math.atan2(vy, vx) + Math.PI / 2;
      duck.heading = lerpAngle(duck.heading, duck.targetHeading, isDashing ? 0.12 : 0.06);

      // Bob — faster & deeper when dashing
      const bobRate = isDashing ? duck.bobSpeed * 2.4 : duck.bobSpeed;
      const bobAmp = isFeeding ? 4.5 : isDashing ? 4.0 : 2.2;
      const bob = Math.sin(now * 0.001 * bobRate + duck.bobPhase) * bobAmp;

      el.style.transform = `translate(${x - DUCK_R}px,${y - DUCK_R + bob}px) rotate(${duck.heading}rad)`;
      el.style.filter = isFeeding ? "drop-shadow(0 0 8px rgba(255,200,80,.55))" : "";

      if (shadow) {
        const sw = DUCK_R * 2.2;
        shadow.style.transform = `translate(${x - sw / 2}px,${y + DUCK_R * 0.7}px)`;
        shadow.style.opacity = isFeeding ? "0.55" : "0.75";
      }
    }

    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  // Resize
  let resizeT: ReturnType<typeof setTimeout> | undefined;
  const ro = new ResizeObserver(() => {
    if (resizeT !== undefined) clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      resizeT = undefined;
      W = scene.clientWidth;
      H = scene.clientHeight;
      if (W < 32 || H < 32) return;
      sizeFx(canvas, scene);
      walls.forEach((b) => World.remove(world, b));
      walls = makeWalls(W, H);
      World.add(world, walls);
      const pad = DUCK_R + 4;
      for (const d of ducks) {
        const nx = Math.min(Math.max(d.body.position.x, pad), W - pad);
        const ny = Math.min(Math.max(d.body.position.y, pad), H - pad);
        if (nx !== d.body.position.x || ny !== d.body.position.y) {
          Body.setPosition(d.body, { x: nx, y: ny });
        }
      }
      mouse.offset.x = 0; mouse.offset.y = 0;
      mouse.scale.x = 1; mouse.scale.y = 1;
    }, 120);
  });
  ro.observe(scene);

  return () => {
    setSpawnRef(null);
    cancelAnimationFrame(rafId);
    if (resizeT !== undefined) clearTimeout(resizeT);
    ac.abort();
    ro.disconnect();
    Events.off(engine, "beforeUpdate", beforeUpdate);
    Events.off(engine, "collisionStart", collisionStart);
    Runner.stop(runner);
    World.clear(world);
    Engine.clear(engine);
  };
}
