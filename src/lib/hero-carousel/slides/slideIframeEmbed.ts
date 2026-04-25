import type { HeroIllustrationSlide, HeroSlideFactory } from "../types";

export interface IframeHeroSlideOptions {
  /** Path under site origin, e.g. /hero-embeds/toast/index.html */
  src: string;
  title: string;
}

export function createIframeHeroSlide(opts: IframeHeroSlideOptions): HeroSlideFactory {
  return () => {
    let root: HTMLElement | null = null;
    let iframe: HTMLIFrameElement | null = null;

    const slide: HeroIllustrationSlide = {
      mount(el) {
        root = el;
        root.textContent = "";
        root.className =
          "relative flex h-full min-h-[160px] w-full flex-col overflow-hidden rounded-[inherit] bg-[#faf7f2]";
        const frame = document.createElement("iframe");
        frame.className = "hero-embed-iframe min-h-0 w-full flex-1 border-0";
        frame.title = opts.title;
        frame.src = opts.src;
        frame.loading = "lazy";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.setAttribute("allow", "fullscreen");
        root.appendChild(frame);
        iframe = frame;
      },
      pause() {
        /* iframe keeps running; pause is a no-op */
      },
      resume() {
        /* no-op */
      },
      destroy() {
        iframe?.removeAttribute("src");
        iframe = null;
        if (root) {
          root.textContent = "";
          root.className = "";
        }
        root = null;
      },
    };

    return slide;
  };
}

// Note: currently unused (we removed iframe-based embeds), but kept around in case
// you want to bring back local “/hero-embeds/*” pages later.
