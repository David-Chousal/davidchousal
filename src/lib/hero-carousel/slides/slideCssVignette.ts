import type { HeroIllustrationSlide, HeroSlideFactory } from "../types";

const MOOD_DEBOUNCE_MS = 380;
const SPRING_K = 0.16;
const SPRING_K_REDUCED = 0.28;
const EPS = 0.002;
const VELOCITY_THRESHOLD = 0.35;
const TILT_IMPULSE_SCALE = 14;
const TILT_MAX_DEG = 6;
const TILT_MAX_DEG_REDUCED = 1;
const TILT_DECAY = 0.85;
const PROXIMITY_RADIUS = 0.42;
/** Normalized slide Y of mascot “anchor” (below center); tuned for flex layout. */
const PROXIMITY_MASCOT_NY = 0.3;
const PROXIMITY_MIN_NY = 0.08;
const PROXIMITY_PARALLAX_FLOOR = 0.12;
const GAZE_MAX_X = 1.25;
const GAZE_MAX_Y = 0.9;
const GAZE_REDUCED_FACTOR = 0.25;

/**
 * CSS/SVG vignette: morphing blob, spring parallax, gaze, velocity tilt, mood cycle,
 * grain/floaters, proximity micro-reaction, tap to boop. Uses rAF only while active;
 * pause/resume/destroy stop listeners and animation frames.
 */
export const createCssVignetteSlide: HeroSlideFactory = (prefersReducedMotion) => {
  let rootEl: HTMLElement | null = null;
  let blinkId: ReturnType<typeof setInterval> | undefined;
  const ac = new AbortController();

  let paused = true;
  let rafId: number | null = null;
  let lastMoodTapAt = 0;
  let proximityTimer: ReturnType<typeof setTimeout> | undefined;
  let boopTimer: ReturnType<typeof setTimeout> | undefined;
  let moodFlashTimer: ReturnType<typeof setTimeout> | undefined;

  let targetNx = 0;
  let targetNy = 0;
  let curNx = 0;
  let curNy = 0;
  let lastPx = 0;
  let lastPy = 0;
  let lastPt = 0;
  let tiltMascot = 0;
  let tiltBlob = 0;
  let proximityActive = false;

  let cancelRafImpl: () => void = () => {};
  let scheduleTickImpl: () => void = () => {};
  let startBlinkImpl: () => void = () => {};

  const html = `
<div class="hero-css-slide relative flex h-full w-full cursor-crosshair items-center justify-center overflow-hidden rounded-[inherit] bg-[#f5f0e8] p-6">
  <svg class="hero-css-grain-svg pointer-events-none absolute inset-0 h-full w-full opacity-[0.055]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="__HERO_CSS_GRAIN_ID__" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="2" result="noise">
          <animate attributeName="baseFrequency" values="0.85;0.92;0.85" dur="28s" repeatCount="indefinite" class="hero-css-grain-anim"/>
        </feTurbulence>
        <feColorMatrix in="noise" type="saturate" values="0" result="grey"/>
        <feComponentTransfer in="grey" result="grain">
          <feFuncA type="linear" slope="0.4" intercept="0"/>
        </feComponentTransfer>
      </filter>
    </defs>
    <rect width="100%" height="100%" filter="url(#__HERO_CSS_GRAIN_ID__)" opacity="0.9"/>
  </svg>
  <div class="pointer-events-none absolute inset-0 opacity-40 hero-css-vignette-bg" aria-hidden="true"
    style="background: radial-gradient(ellipse 70% 60% at 50% 40%, rgba(214,188,250,0.35), transparent 60%);"></div>
  <div class="hero-css-floaters pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div class="hero-css-floater hero-css-floater--1"><span class="hero-css-floater-motion hero-css-floater-motion--1"></span></div>
    <div class="hero-css-floater hero-css-floater--2"><span class="hero-css-floater-motion hero-css-floater-motion--2"></span></div>
    <div class="hero-css-floater hero-css-floater--3"><span class="hero-css-floater-motion hero-css-floater-motion--3"></span></div>
    <div class="hero-css-floater hero-css-floater--4"><span class="hero-css-floater-motion hero-css-floater-motion--4"></span></div>
  </div>
  <div class="hero-css-blob-parallax pointer-events-auto absolute left-1/2 top-1/2 z-[1] h-[min(55%,220px)] w-[min(55%,220px)]" style="transform: translate(-50%, -50%); will-change: transform;">
    <div class="hero-css-blob relative h-full w-full rounded-[42%_58%_70%_30%/40%_40%_60%_60%] bg-gradient-to-br from-[#c4b5fd]/90 to-[#fde68a]/85 will-change-transform" data-mood="0" aria-hidden="true"></div>
    <button type="button" class="hero-css-blob-mood-btn absolute inset-0 z-[2] cursor-pointer touch-manipulation rounded-[inherit] border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#57534e]/40" aria-label="Change blob color mood (cycles three palettes)"></button>
  </div>
  <div class="relative z-10 flex flex-col items-center">
    <button type="button" class="hero-css-mascot-wrap cursor-pointer touch-manipulation rounded-full border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#57534e]/40" aria-label="Bounce the mascot">
      <svg class="hero-css-mascot h-24 w-24 drop-shadow-sm" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g class="hero-css-mascot-body">
          <ellipse cx="48" cy="58" rx="28" ry="22" fill="#fafaf9" stroke="#57534e" stroke-width="2"/>
        </g>
        <circle cx="48" cy="38" r="22" fill="#fafaf9" stroke="#57534e" stroke-width="2"/>
        <g class="hero-css-eye-l" style="transform-box: fill-box; transform-origin: center">
          <ellipse cx="40" cy="36" rx="5" ry="6" fill="#fafaf9"/>
          <ellipse class="hero-css-pupil-l" cx="40" cy="36" rx="3" ry="3.5" fill="#292524"/>
        </g>
        <g class="hero-css-eye-r" style="transform-box: fill-box; transform-origin: center">
          <ellipse cx="56" cy="36" rx="5" ry="6" fill="#fafaf9"/>
          <ellipse class="hero-css-pupil-r" cx="56" cy="36" rx="3" ry="3.5" fill="#292524"/>
        </g>
        <path class="hero-css-mouth-idle" d="M38 52 Q48 58 58 52" fill="none" stroke="#57534e" stroke-width="2" stroke-linecap="round"/>
        <path class="hero-css-mouth-warm" d="M36 52 Q48 60 60 52" fill="none" stroke="#57534e" stroke-width="2" stroke-linecap="round" opacity="0"/>
      </svg>
    </button>
  </div>
</div>`;

  const slide: HeroIllustrationSlide = {
    mount(root) {
      targetNx = 0;
      targetNy = 0;
      curNx = 0;
      curNy = 0;
      lastPx = 0;
      lastPy = 0;
      lastPt = 0;
      tiltMascot = 0;
      tiltBlob = 0;
      proximityActive = false;
      lastMoodTapAt = 0;

      rootEl = root;
      const grainId = `hcssgrain-${Math.random().toString(36).slice(2, 11)}`;
      root.innerHTML = html.replaceAll("__HERO_CSS_GRAIN_ID__", grainId);
      const slideEl = root.querySelector<HTMLElement>(".hero-css-slide");
      const blobWrap = root.querySelector<HTMLElement>(".hero-css-blob-parallax");
      const blobInner = root.querySelector<HTMLElement>(".hero-css-blob");
      const moodBtn = root.querySelector<HTMLButtonElement>(".hero-css-blob-mood-btn");
      const vignette = root.querySelector<HTMLElement>(".hero-css-vignette-bg");
      const floaters = root.querySelector<HTMLElement>(".hero-css-floaters");
      const mascotWrap = root.querySelector<HTMLElement>(".hero-css-mascot-wrap");
      const mascot = root.querySelector<HTMLElement>(".hero-css-mascot");
      const grainAnim = root.querySelector(".hero-css-grain-anim");

      if (prefersReducedMotion && grainAnim instanceof SVGAnimateElement) {
        grainAnim.remove();
      }

      if (blobInner && !prefersReducedMotion) {
        blobInner.classList.add("hero-css-blob-morph");
      }

      const parallaxCap = prefersReducedMotion ? 4 : 22;
      const springK = prefersReducedMotion ? SPRING_K_REDUCED : SPRING_K;
      const mascotTxScale = prefersReducedMotion ? 3 : 8;
      const mascotTyScale = prefersReducedMotion ? 2 : 5;
      const vignetteNx = prefersReducedMotion ? 3 : 8;
      const vignetteNy = prefersReducedMotion ? 2.5 : 6;
      const floaterParallaxScale = prefersReducedMotion ? 0.35 : 1;

      const pupils = () => ({
        l: root.querySelector<SVGElement>(".hero-css-pupil-l"),
        r: root.querySelector<SVGElement>(".hero-css-pupil-r"),
      });

      const applyGaze = (nx: number, ny: number) => {
        const gazeMul = prefersReducedMotion ? GAZE_REDUCED_FACTOR : 1;
        const gx = Math.max(-1, Math.min(1, nx)) * GAZE_MAX_X * gazeMul;
        const gy = Math.max(-1, Math.min(1, ny)) * GAZE_MAX_Y * gazeMul;
        const t = `translate(${gx.toFixed(3)}px,${gy.toFixed(3)}px)`;
        pupils().l?.setAttribute("transform", t);
        pupils().r?.setAttribute("transform", t);
      };

      const clearGaze = () => {
        pupils().l?.removeAttribute("transform");
        pupils().r?.removeAttribute("transform");
      };

      const needsAnotherFrame = () => {
        if (paused) return false;
        const tgt = Math.hypot(targetNx, targetNy);
        const cur = Math.hypot(curNx, curNy);
        const tilt = Math.abs(tiltMascot) + Math.abs(tiltBlob);
        if (tgt > EPS) return true;
        if (cur > EPS || tilt > 0.02) return true;
        return false;
      };

      const tick = () => {
        rafId = null;
        if (paused || !slideEl || !blobWrap || !mascot || !vignette) return;

        curNx += (targetNx - curNx) * springK;
        curNy += (targetNy - curNy) * springK;

        tiltMascot *= TILT_DECAY;
        tiltBlob *= TILT_DECAY;
        if (Math.abs(tiltMascot) < 0.02) tiltMascot = 0;
        if (Math.abs(tiltBlob) < 0.02) tiltBlob = 0;

        const nx = Math.max(-1, Math.min(1, curNx));
        const ny = Math.max(-1, Math.min(1, curNy));
        const dx = nx * parallaxCap;
        const dy = ny * parallaxCap;

        blobWrap.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${tiltBlob.toFixed(2)}deg)`;
        mascot.style.transform = `translate(${nx * mascotTxScale}px, ${ny * mascotTyScale}px) rotate(${tiltMascot.toFixed(2)}deg)`;
        vignette.style.backgroundPosition = `${50 + nx * vignetteNx}% ${40 + ny * vignetteNy}%`;

        if (floaters) {
          const fx = (-nx * 10 * floaterParallaxScale).toFixed(2);
          const fy = (-ny * 8 * floaterParallaxScale).toFixed(2);
          floaters.style.setProperty("--hero-floater-px", `${fx}px`);
          floaters.style.setProperty("--hero-floater-py", `${fy}px`);
        }

        applyGaze(nx, ny);

        /*
         * Proximity micro-reaction: in normalized pointer space (slide rect, -1..1),
         * mascot sits near (0, PROXIMITY_MASCOT_NY). When pointer is within PROXIMITY_RADIUS
         * of that anchor, ny is biased toward mascot (below center), and spring offset is
         * meaningful, trigger a short squash + warm mouth (CSS).
         */
        const rawNx = Math.max(-1, Math.min(1, targetNx));
        const rawNy = Math.max(-1, Math.min(1, targetNy));
        const dist = Math.hypot(rawNx, rawNy - PROXIMITY_MASCOT_NY);
        const parallaxMag = Math.hypot(nx, ny);
        const close =
          dist < PROXIMITY_RADIUS && rawNy > PROXIMITY_MIN_NY && parallaxMag > PROXIMITY_PARALLAX_FLOOR;
        if (close && !proximityActive && mascotWrap) {
          proximityActive = true;
          mascotWrap.classList.add("hero-css-mascot-proximity-squash");
          mascotWrap.classList.add("hero-css-mascot-proximity-mouth");
          if (proximityTimer) window.clearTimeout(proximityTimer);
          proximityTimer = window.setTimeout(() => {
            proximityActive = false;
            mascotWrap?.classList.remove("hero-css-mascot-proximity-squash");
            mascotWrap?.classList.remove("hero-css-mascot-proximity-mouth");
            proximityTimer = undefined;
          }, 420);
        }

        if (needsAnotherFrame()) {
          rafId = requestAnimationFrame(tick);
        } else {
          curNx = 0;
          curNy = 0;
          clearGaze();
        }
      };

      const scheduleTick = () => {
        if (paused || rafId != null) return;
        rafId = requestAnimationFrame(tick);
      };

      cancelRafImpl = () => {
        if (rafId != null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      };
      scheduleTickImpl = scheduleTick;

      const onPointerMove = (e: PointerEvent) => {
        if (!slideEl) return;
        const r = slideEl.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
        targetNx = Math.max(-1, Math.min(1, nx));
        targetNy = Math.max(-1, Math.min(1, ny));

        const now = performance.now();
        const dt = Math.max(8, now - lastPt);
        const spx = (e.clientX - lastPx) / dt;
        const spy = (e.clientY - lastPy) / dt;
        const speed = Math.hypot(spx, spy);
        if (!prefersReducedMotion && speed > VELOCITY_THRESHOLD && lastPt > 0) {
          const dir = Math.sign(e.clientX - lastPx) || 1;
          const cap = TILT_MAX_DEG;
          const impulse = Math.min(cap, speed * TILT_IMPULSE_SCALE * 0.01) * -dir;
          tiltMascot = Math.max(-cap, Math.min(cap, tiltMascot + impulse * 0.55));
          tiltBlob = Math.max(-cap, Math.min(cap, tiltBlob + impulse * 0.35));
        } else if (prefersReducedMotion && speed > VELOCITY_THRESHOLD * 1.4 && lastPt > 0) {
          const dir = Math.sign(e.clientX - lastPx) || 1;
          const cap = TILT_MAX_DEG_REDUCED;
          const impulse = Math.min(cap, speed * 4 * 0.01) * -dir;
          tiltMascot = Math.max(-cap, Math.min(cap, tiltMascot + impulse * 0.4));
          tiltBlob = Math.max(-cap, Math.min(cap, tiltBlob + impulse * 0.25));
        }
        lastPx = e.clientX;
        lastPy = e.clientY;
        lastPt = now;

        scheduleTick();
      };

      const resetParallax = () => {
        targetNx = 0;
        targetNy = 0;
        scheduleTick();
      };

      const onBoop = () => {
        if (!mascotWrap) return;
        mascotWrap.classList.remove("hero-css-mascot-boop");
        void mascotWrap.offsetWidth;
        mascotWrap.classList.add("hero-css-mascot-boop");
        if (boopTimer) window.clearTimeout(boopTimer);
        boopTimer = window.setTimeout(() => {
          mascotWrap.classList.remove("hero-css-mascot-boop");
          boopTimer = undefined;
        }, 500);
      };

      const cycleMood = () => {
        if (!blobInner) return;
        const m = (parseInt(blobInner.dataset.mood || "0", 10) + 1) % 3;
        blobInner.dataset.mood = String(m);
        blobInner.classList.remove("hero-css-blob-mood-flash");
        void blobInner.offsetWidth;
        blobInner.classList.add("hero-css-blob-mood-flash");
        if (moodFlashTimer) window.clearTimeout(moodFlashTimer);
        moodFlashTimer = window.setTimeout(() => {
          blobInner.classList.remove("hero-css-blob-mood-flash");
          moodFlashTimer = undefined;
        }, 220);
      };

      const onMoodClick = () => {
        const now = performance.now();
        if (now - lastMoodTapAt < MOOD_DEBOUNCE_MS) return;
        lastMoodTapAt = now;
        cycleMood();
      };

      if (slideEl) {
        slideEl.addEventListener("pointermove", onPointerMove, { passive: true, capture: true, signal: ac.signal });
        slideEl.addEventListener("pointerleave", resetParallax, { passive: true, signal: ac.signal });
      }
      mascotWrap?.addEventListener("click", onBoop, { signal: ac.signal });
      moodBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        onMoodClick();
      }, { signal: ac.signal });

      const blinkIntervalMs = prefersReducedMotion ? 3200 : 2800;
      const setupBlink = () => {
        if (blinkId != null) window.clearInterval(blinkId);
        let blink = 0;
        const eyes = () => root.querySelectorAll<SVGElement>(".hero-css-eye-l, .hero-css-eye-r");
        blinkId = window.setInterval(() => {
          blink ^= 1;
          eyes().forEach((el) => {
            el.style.opacity = blink ? "0.2" : "1";
            el.style.transform = blink ? "scaleY(0.15)" : "scaleY(1)";
            el.style.transformOrigin = "center";
            el.style.transition = "opacity 0.08s ease, transform 0.08s ease";
          });
        }, blinkIntervalMs);
      };

      startBlinkImpl = setupBlink;
      setupBlink();
    },

    pause() {
      paused = true;
      cancelRafImpl();
      if (blinkId != null) {
        window.clearInterval(blinkId);
        blinkId = undefined;
      }
    },

    resume() {
      paused = false;
      scheduleTickImpl();
      if (rootEl && blinkId == null) startBlinkImpl();
    },

    destroy() {
      paused = true;
      cancelRafImpl();
      startBlinkImpl = () => {};
      scheduleTickImpl = () => {};
      cancelRafImpl = () => {};
      ac.abort();
      if (blinkId != null) window.clearInterval(blinkId);
      blinkId = undefined;
      if (proximityTimer) window.clearTimeout(proximityTimer);
      proximityTimer = undefined;
      if (boopTimer) window.clearTimeout(boopTimer);
      boopTimer = undefined;
      if (moodFlashTimer) window.clearTimeout(moodFlashTimer);
      moodFlashTimer = undefined;
      if (rootEl) rootEl.innerHTML = "";
      rootEl = null;
    },
  };

  return slide;
};
