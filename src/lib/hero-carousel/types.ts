/** Client-only hero carousel slide contract (see HeroIllustrationCarousel.astro). */

export interface HeroIllustrationSlide {
  mount(root: HTMLElement): void | Promise<void>;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export type HeroSlideFactory = (prefersReducedMotion: boolean) => HeroIllustrationSlide;

export interface HeroSlideDefinition {
  id: string;
  label: string;
  /** Matter (and similar): do not use horizontal swipe — use dots / arrows / keyboard only. */
  disableSwipe: boolean;
  create: HeroSlideFactory;
}
