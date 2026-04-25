/**
 * Rive asset pipeline: place `.riv` files under `public/rive/` and reference by URL
 * (e.g. `/rive/hero.riv`). Runtime and WASM load only when this slide is first activated.
 */
import type { HeroIllustrationSlide, HeroSlideFactory } from "../types";

export interface RiveSlideOptions {
  src: string;
  fallbackSrc: string;
}

export function createRiveHeroSlide(opts: RiveSlideOptions): HeroSlideFactory {
  return (prefersReducedMotion: boolean) => {
    let root: HTMLElement | null = null;
    let riveRef: import("@rive-app/canvas").Rive | null = null;
    let ro: ResizeObserver | null = null;
    let interactionHandler: (() => void) | null = null;

    const slide: HeroIllustrationSlide = {
      mount(el) {
        root = el;
        root.className =
          "relative flex h-full min-h-[160px] w-full items-center justify-center overflow-hidden rounded-[inherit] bg-[#faf7f2]";
        if (prefersReducedMotion) {
          root.innerHTML = `
            <button type="button" class="hero-rive-static-hit flex h-full w-full cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a2520]/35" aria-label="Play a little wiggle">
              <img class="hero-rive-static-img max-h-full max-w-full object-contain p-8" src="${opts.fallbackSrc}" alt="" />
            </button>
          `;
          const hit = root.querySelector(".hero-rive-static-hit");
          const img = root.querySelector(".hero-rive-static-img");
          const wiggle = () => {
            img?.classList.remove("hero-rive-static-wiggle");
            void img?.offsetWidth;
            img?.classList.add("hero-rive-static-wiggle");
            window.setTimeout(() => img?.classList.remove("hero-rive-static-wiggle"), 600);
          };
          hit?.addEventListener("click", wiggle, { passive: true });
          return;
        }
        root.innerHTML = `
          <canvas class="hero-rive-canvas h-full max-h-full w-full max-w-full cursor-grab object-contain active:cursor-grabbing" aria-hidden="true"></canvas>
          <button type="button" class="hero-rive-fallback-hit pointer-events-none absolute inset-0 hidden cursor-pointer border-0 bg-transparent p-0 focus-visible:pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a2520]/35" aria-label="Tap: wiggle fallback art">
            <img class="hero-rive-fallback h-full w-full object-contain p-8" src="${opts.fallbackSrc}" alt="" />
          </button>
        `;
      },
      pause() {
        try {
          riveRef?.pause();
        } catch {
          /* ignore */
        }
      },
      resume() {
        if (prefersReducedMotion || !root) return;
        void bootRive();
        try {
          riveRef?.play();
        } catch {
          /* ignore */
        }
      },
      destroy() {
        teardown();
        if (root) root.innerHTML = "";
        root = null;
      },
    };

    function teardown() {
      interactionHandler?.();
      interactionHandler = null;
      ro?.disconnect();
      ro = null;
      try {
        riveRef?.removeRiveListeners();
      } catch {
        /* ignore */
      }
      try {
        riveRef?.cleanup();
      } catch {
        /* ignore */
      }
      riveRef = null;
    }

    async function bootRive() {
      if (!root || prefersReducedMotion || riveRef) return;
      const canvas = root.querySelector<HTMLCanvasElement>(".hero-rive-canvas");
      if (!canvas) return;

      try {
        const { Rive, Layout, Fit } = await import("@rive-app/canvas");
        const r = new Rive({
          src: opts.src,
          canvas,
          autoplay: true,
          layout: new Layout({ fit: Fit.Contain }),
          onLoad: () => {
            try {
              r.resizeDrawingSurfaceToCanvas();
            } catch {
              /* ignore */
            }
            try {
              r.setupRiveListeners({ isTouchScrollEnabled: true });
            } catch {
              /* ignore */
            }
            root.querySelector(".hero-rive-fallback-hit")?.classList.add("hidden");
          },
          onLoadError: () => {
            canvas.classList.add("hidden");
            const fbHit = root.querySelector<HTMLButtonElement>(".hero-rive-fallback-hit");
            fbHit?.classList.remove("hidden", "pointer-events-none");
            fbHit?.classList.add("pointer-events-auto");
            try {
              r.cleanup();
            } catch {
              /* ignore */
            }
            riveRef = null;
            wireFallbackWiggle(root);
          },
        });
        riveRef = r;

        ro = new ResizeObserver(() => {
          try {
            r.resizeDrawingSurfaceToCanvas();
          } catch {
            /* ignore */
          }
        });
        ro.observe(root);

        const nudge = () => {
          try {
            r.play();
          } catch {
            /* ignore */
          }
        };
        const onPtr = () => nudge();
        root.addEventListener("pointerenter", onPtr, { passive: true });
        root.addEventListener("pointerdown", onPtr, { passive: true });
        interactionHandler = () => {
          root.removeEventListener("pointerenter", onPtr);
          root.removeEventListener("pointerdown", onPtr);
        };
      } catch {
        canvas.classList.add("hidden");
        const fbHit = root.querySelector<HTMLButtonElement>(".hero-rive-fallback-hit");
        fbHit?.classList.remove("hidden", "pointer-events-none");
        fbHit?.classList.add("pointer-events-auto");
        wireFallbackWiggle(root);
      }
    }

    function wireFallbackWiggle(el: HTMLElement) {
      const img = el.querySelector(".hero-rive-fallback, .hero-rive-static-img");
      const hit = el.querySelector(".hero-rive-fallback-hit");
      const go = () => {
        img?.classList.remove("hero-rive-static-wiggle");
        void img?.offsetWidth;
        img?.classList.add("hero-rive-static-wiggle");
        window.setTimeout(() => img?.classList.remove("hero-rive-static-wiggle"), 600);
      };
      hit?.addEventListener("click", go, { passive: true });
    }

    return slide;
  };
}
