function setMenuOpen(open: boolean) {
  const sidebar = document.querySelector<HTMLElement>("[data-case-sidebar]");
  const overlay = document.querySelector<HTMLElement>("[data-case-overlay]");
  const btn = document.querySelector<HTMLButtonElement>("[data-case-menu-button]");
  if (!sidebar || !overlay || !btn) return;

  btn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    sidebar.classList.remove("-translate-x-full");
    sidebar.classList.add("translate-x-0");
    overlay.classList.remove("pointer-events-none", "opacity-0");
    overlay.classList.add("opacity-100");
    overlay.setAttribute("aria-hidden", "false");
  } else {
    sidebar.classList.add("-translate-x-full");
    sidebar.classList.remove("translate-x-0");
    overlay.classList.add("pointer-events-none", "opacity-0");
    overlay.classList.remove("opacity-100");
    overlay.setAttribute("aria-hidden", "true");
  }
}

function initMobileMenu(root: HTMLElement) {
  const btn = root.querySelector<HTMLButtonElement>("[data-case-menu-button]");
  const overlay = root.querySelector<HTMLElement>("[data-case-overlay]");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") !== "true";
    setMenuOpen(open);
  });
  overlay?.addEventListener("click", () => setMenuOpen(false));

  window.matchMedia("(min-width: 768px)").addEventListener("change", (e) => {
    if (e.matches) setMenuOpen(false);
  });
}

function initScrollSpy(root: HTMLElement) {
  const main = root.querySelector<HTMLElement>("[data-case-main]");
  if (!main) return;

  const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-case-section]"));
  if (!sections.length) return;

  const tocButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-case-toc]"));
  const dots = Array.from(root.querySelectorAll<HTMLElement>("[data-case-dot]"));

  const setActive = (id: string | null) => {
    tocButtons.forEach((b) => {
      const on = !!(id && b.dataset.caseTocFor === id);
      b.dataset.active = on ? "true" : "false";
    });
    dots.forEach((d) => {
      const on = !!(id && d.dataset.caseDotFor === id);
      d.dataset.on = on ? "true" : "false";
    });
  };

  tocButtons.forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.dataset.caseTocFor;
      if (!id) return;
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      setMenuOpen(false);
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
      const id = visible?.target.id ?? null;
      if (id) setActive(id);
    },
    { root: main, rootMargin: "-18% 0px -52% 0px", threshold: [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1] }
  );

  sections.forEach((s) => observer.observe(s));
  if (sections[0]?.id) setActive(sections[0].id);
}

function initHeroCarousel(root: HTMLElement) {
  const wrap = root.querySelector<HTMLElement>("[data-hero-carousel]");
  if (!wrap) return;

  const slides = Array.from(wrap.querySelectorAll<HTMLElement>("[data-hero-slide]"));
  if (slides.length <= 1) return;

  const prev = wrap.querySelector<HTMLButtonElement>("[data-hero-prev]");
  const next = wrap.querySelector<HTMLButtonElement>("[data-hero-next]");
  const dotButtons = Array.from(wrap.querySelectorAll<HTMLButtonElement>("[data-hero-dot]"));

  let index = 0;
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pauseAllVideos = () => {
    slides.forEach((s) => {
      s.querySelectorAll("video").forEach((v) => {
        v.pause();
      });
    });
  };

  const playActiveVideos = () => {
    if (prefersReduced) return;
    const active = slides[index];
    active?.querySelectorAll("video").forEach((v) => {
      void v.play().catch(() => {});
    });
  };

  const setIndex = (nextIndex: number) => {
    index = (nextIndex + slides.length) % slides.length;
    slides.forEach((el, i) => {
      el.classList.toggle("hidden", i !== index);
    });
    dotButtons.forEach((btn, i) => {
      btn.dataset.on = i === index ? "true" : "false";
    });
    pauseAllVideos();
    playActiveVideos();
  };

  dotButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => setIndex(i));
  });
  prev?.addEventListener("click", () => setIndex(index - 1));
  next?.addEventListener("click", () => setIndex(index + 1));

  pauseAllVideos();
  playActiveVideos();
}

export function initCaseStudyChrome() {
  if (typeof document === "undefined") return;
  const root = document.querySelector<HTMLElement>("[data-case-study-root]");
  if (!root) return;

  initMobileMenu(root);
  initScrollSpy(root);
  initHeroCarousel(root);
}
