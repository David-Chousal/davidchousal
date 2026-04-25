/**
 * Carousel orchestrator. Matter-backed slides use disableSwipe: horizontal swipe is
 * disabled while those slides are active so chip drag is never confused with slide change.
 */
import type { HeroIllustrationSlide, HeroSlideDefinition } from "./types";
import { createMatterHeroSlide } from "./slides/matterHeroSlide";
import { createRiveHeroSlide } from "./slides/slideRive";
import { createDuckPondSlide } from "./slides/slideDuckPond";
import { createIframeHeroSlide } from "./slides/slideIframeEmbed";
import { withBase } from "../withBase";

const RIVE_SLIDE: HeroSlideDefinition = {
  id: "rive",
  label: "Rive",
  disableSwipe: false,
  create: createRiveHeroSlide({
    src: withBase("/rive/hero.riv"),
    fallbackSrc: withBase("/rive/hero-fallback.svg"),
  }),
};

/** Third carousel slide only — stays in the page hero. */
export const landingHeroIllustrationDefinitions: HeroSlideDefinition[] = [RIVE_SLIDE];

/** All other illustrations — carousel below “See more work”. */
export const moreWorkIllustrationDefinitions: HeroSlideDefinition[] = [
  {
    id: "embed-svg-puzzle",
    label: "SVG puzzle",
    disableSwipe: true,
    create: createIframeHeroSlide({
      src: withBase("/hero-embeds/svg-puzzle/index.html"),
      title: "Animated interactive SVG puzzle",
    }),
  },
  { id: "matter-picnic", label: "Sunny picnic", disableSwipe: true, create: createMatterHeroSlide("sunnyPicnic") },
  { id: "matter-pond", label: "Duck pond", disableSwipe: true, create: createDuckPondSlide },
  {
    id: "embed-pinocchio",
    label: "Pinocchio",
    disableSwipe: true,
    create: createIframeHeroSlide({
      src: withBase("/hero-embeds/pinocchio/index.html"),
      title: "Pure CSS Pinocchio",
    }),
  },
];

export function mountHeroCarousel(
  regionRoot: HTMLElement,
  defs: HeroSlideDefinition[]
): () => void {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const autoplayMs = Math.max(
    0,
    parseInt(regionRoot.dataset.autoplayMs || "0", 10) || 0
  );
  const track = regionRoot.querySelector<HTMLElement>("[data-hero-carousel-track]");
  const announcer = regionRoot.querySelector<HTMLElement>("[data-hero-carousel-live]");
  const prevBtn = regionRoot.querySelector<HTMLButtonElement>('[data-hero-carousel-prev]');
  const nextBtn = regionRoot.querySelector<HTMLButtonElement>('[data-hero-carousel-next]');
  const dots = Array.from(regionRoot.querySelectorAll<HTMLButtonElement>("[data-hero-carousel-dot]"));
  const panels = Array.from(regionRoot.querySelectorAll<HTMLElement>("[data-hero-slide-panel]"));

  const instances: HeroIllustrationSlide[] = defs.map((d) => d.create(prefersReducedMotion));
  const mounted = new Set<number>();

  let index = 0;
  let autoplayTimer: ReturnType<typeof setInterval> | undefined;
  let hoverPause = false;
  let focusPause = false;
  let io: IntersectionObserver | null = null;

  function announce() {
    if (!announcer) return;
    const d = defs[index];
    announcer.textContent = `Slide ${index + 1} of ${defs.length}: ${d.label}`;
  }

  function setDisabledStates() {
    const panelId = `${regionRoot.id}-panel-${index}`;
    if (prevBtn) {
      prevBtn.disabled = false;
      prevBtn.setAttribute("aria-controls", panelId);
    }
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.setAttribute("aria-controls", panelId);
    }
    dots.forEach((dot, i) => {
      const on = i === index;
      dot.setAttribute("aria-selected", on ? "true" : "false");
      dot.setAttribute("tabindex", on ? "0" : "-1");
      dot.setAttribute("aria-current", on ? "true" : "false");
      dot.classList.toggle("bg-[#2a2520]/70", on);
      dot.classList.toggle("bg-[#2a2520]/20", !on);
      dot.classList.toggle("hover:bg-[#2a2520]/40", !on);
    });
    panels.forEach((panel, i) => {
      const on = i === index;
      panel.toggleAttribute("inert", !on);
      panel.setAttribute("aria-hidden", on ? "false" : "true");
      panel.classList.toggle("opacity-0", !on);
      panel.classList.toggle("pointer-events-none", !on);
      panel.classList.toggle("z-10", on);
      panel.classList.toggle("z-0", !on);
    });
  }

  function pauseAutoplay() {
    if (autoplayTimer != null) {
      window.clearInterval(autoplayTimer);
      autoplayTimer = undefined;
    }
  }

  function maybeStartAutoplay() {
    pauseAutoplay();
    if (prefersReducedMotion || autoplayMs <= 0) return;
    if (hoverPause || focusPause) return;
    autoplayTimer = window.setInterval(() => {
      if (hoverPause || focusPause) return;
      goTo((index + 1) % defs.length);
    }, autoplayMs);
  }

  function pauseOthers() {
    instances.forEach((inst, i) => {
      if (i !== index) inst.pause();
    });
  }

  function goTo(next: number) {
    const len = defs.length;
    if (len < 1) return;
    const n = ((next % len) + len) % len;
    if (n === index && mounted.has(n)) {
      instances[index].resume();
      announce();
      setDisabledStates();
      maybeStartAutoplay();
      return;
    }
    instances[index]?.pause();
    index = n;

    const panel = panels[index];
    const mountEl = panel?.querySelector<HTMLElement>("[data-hero-slide-mount]");
    if (panel && mountEl) {
      const target = index;
      if (!mounted.has(index)) {
        void Promise.resolve(instances[index].mount(mountEl)).then(() => {
          if (index !== target) {
            instances[target].pause();
            return;
          }
          mounted.add(target);
          instances[target].resume();
        });
      } else {
        instances[index].resume();
      }
    }

    pauseOthers();
    announce();
    setDisabledStates();
    maybeStartAutoplay();
  }

  function next() {
    goTo(index + 1);
  }
  function prev() {
    goTo(index - 1);
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!regionRoot.contains(document.activeElement) && document.activeElement !== regionRoot) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
  };

  prevBtn?.addEventListener("click", () => prev());
  nextBtn?.addEventListener("click", () => next());
  dots.forEach((dot, i) => dot.addEventListener("click", () => goTo(i)));
  regionRoot.addEventListener("keydown", onKeyDown);

  /** Swipe: only when active slide allows (not Matter). */
  let swipeDown = false;
  let sx = 0;
  let sy = 0;
  const onTouchStart = (e: TouchEvent) => {
    if (defs[index]?.disableSwipe) return;
    const t = e.changedTouches[0];
    if (!t) return;
    swipeDown = true;
    sx = t.clientX;
    sy = t.clientY;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (!swipeDown || defs[index]?.disableSwipe) return;
    swipeDown = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.abs(dx) < Math.abs(dy) * 1.2 || Math.abs(dx) < 48) return;
    if (dx < 0) next();
    else prev();
  };
  track?.addEventListener("touchstart", onTouchStart, { passive: true });
  track?.addEventListener("touchend", onTouchEnd, { passive: true });

  const onVis = () => {
    if (document.hidden) {
      instances.forEach((s) => s.pause());
    } else {
      instances[index]?.resume();
      maybeStartAutoplay();
    }
  };
  document.addEventListener("visibilitychange", onVis);

  const onPointerEnter = () => {
    hoverPause = true;
    pauseAutoplay();
  };
  const onPointerLeave = () => {
    hoverPause = false;
    maybeStartAutoplay();
  };
  /** Pause autoplay only while pointer is over the slide area, not the detached toolbar. */
  const hoverPauseTarget = track ?? regionRoot;
  hoverPauseTarget.addEventListener("pointerenter", onPointerEnter);
  hoverPauseTarget.addEventListener("pointerleave", onPointerLeave);

  const onFocusIn = () => {
    focusPause = true;
    pauseAutoplay();
  };
  const onFocusOut = (e: FocusEvent) => {
    if (!regionRoot.contains(e.relatedTarget as Node)) {
      focusPause = false;
      maybeStartAutoplay();
    }
  };
  regionRoot.addEventListener("focusin", onFocusIn);
  regionRoot.addEventListener("focusout", onFocusOut);

  io = new IntersectionObserver(
    (entries) => {
      const vis = entries.some((en) => en.isIntersecting && en.intersectionRatio > 0.05);
      if (!vis) instances.forEach((s) => s.pause());
      else instances[index]?.resume();
    },
    { threshold: [0, 0.05, 0.1] }
  );
  io.observe(regionRoot);

  goTo(0);

  return () => {
    pauseAutoplay();
    document.removeEventListener("visibilitychange", onVis);
    regionRoot.removeEventListener("keydown", onKeyDown);
    hoverPauseTarget.removeEventListener("pointerenter", onPointerEnter);
    hoverPauseTarget.removeEventListener("pointerleave", onPointerLeave);
    regionRoot.removeEventListener("focusin", onFocusIn);
    regionRoot.removeEventListener("focusout", onFocusOut);
    track?.removeEventListener("touchstart", onTouchStart);
    track?.removeEventListener("touchend", onTouchEnd);
    io?.disconnect();
    io = null;
    instances.forEach((s) => s.destroy());
    mounted.clear();
  };
}
