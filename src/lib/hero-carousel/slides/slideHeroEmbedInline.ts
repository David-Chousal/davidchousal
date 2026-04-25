import type { HeroIllustrationSlide, HeroSlideFactory } from "../types";
import { mountHeroEmbed } from "../../hero-embeds/loadHeroEmbed";

export interface HeroEmbedInlineOptions {
  basePath: string;
  title: string;
  /** Optional background class for the slide wrapper */
  wrapperClassName?: string;
}

export function createHeroEmbedInlineSlide(opts: HeroEmbedInlineOptions): HeroSlideFactory {
  return () => {
    let rootEl: HTMLElement | null = null;
    let mounted = false;

    const slide: HeroIllustrationSlide = {
      async mount(root) {
        rootEl = root;
        root.textContent = "";
        root.className =
          opts.wrapperClassName ??
          "relative flex h-full min-h-[160px] w-full flex-col overflow-hidden rounded-[inherit] bg-[#faf7f2]";

        const stage = document.createElement("div");
        stage.className = "hero-embed-inline-stage h-full w-full";
        stage.setAttribute("data-hero-embed-stage", "");
        root.appendChild(stage);

        await mountHeroEmbed({ basePath: opts.basePath, mountEl: stage });

        // If the embed expects full-viewport body defaults, force the stage to fill.
        stage.querySelectorAll("svg").forEach((svg) => {
          svg.removeAttribute("width");
          svg.removeAttribute("height");
        });

        mounted = true;
      },
      pause() {
        // GSAP timelines keep running; no-op (matches old iframe behavior)
      },
      resume() {
        // no-op
      },
      destroy() {
        if (rootEl) {
          rootEl.textContent = "";
          rootEl.className = "";
        }
        rootEl = null;
        mounted = false;
      },
    };

    return slide;
  };
}

