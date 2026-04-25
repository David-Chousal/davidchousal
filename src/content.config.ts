import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const videoEntry = z.object({
  url: z.string(),
  title: z.string(),
});

const tocEntry = z.object({
  id: z.string(),
  label: z.string(),
});

const relatedLink = z.object({
  href: z.string().url(),
  label: z.string(),
  kind: z.enum(["public", "article"]).optional(),
});

/** Landing grid card hover affordances (see ProjectCard landing variant). */
const landingHoverChrome = z
  .object({
    topRight: z.enum(["none", "external"]).default("none"),
    bottomRight: z.enum(["none", "code", "scraps", "scraps+code"]).default("code"),
  })
  .optional();

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    longDescription: z.string().optional(),
    tags: z.array(z.string()).max(3),
    thumbnail: z.string(),
    link: z.string().url().optional(),
    role: z.string().optional(),
    technologies: z.array(z.string()).optional(),
    gallery: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
        })
      )
      .optional(),
    videos: z.array(videoEntry).optional(),
    layout: z.enum(["default"]).default("default"),
    /**
     * When true, `[slug].astro` renders CaseStudyShell + MDX body.
     * Also accepts string "true"/"false" so MDX/YAML quirks never leave pages on the legacy layout.
     */
    caseStudy: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === true || v === "true")),
    year: z.union([z.string(), z.number()]).optional(),
    logo: z.string().optional(),
    landingHoverChrome,
    /**
     * Homepage landing card: fill frame with this video (paused), play on hover.
     * Use with a poster image (`thumbnail` or `landingVideoPoster`).
     */
    landingHomepageHeroVideo: z.string().optional(),
    /** Optional poster URL for `landingHomepageHeroVideo` (defaults to `thumbnail`). */
    landingVideoPoster: z.string().optional(),
    /** Frosted hover pills show this image as background when the card is hovered. */
    landingHoverPillBgUrl: z.string().optional(),
    /**
     * Full project pill: background image revealed when the card is hovered (gray at rest).
     * Omit for a warm neutral gradient on hover instead.
     */
    landingFrameHoverBg: z.string().optional(),
    /** Landing pill: larger centered mockup/video (`large` = more frame fill, still clipped). */
    landingMediaProminence: z.enum(["default", "large"]).optional(),
    heroVideos: z.array(videoEntry).optional(),
    toc: z.array(tocEntry).optional(),
    duration: z.string().optional(),
    skills: z.array(z.string()).optional(),
    team: z.array(z.string()).optional(),
    tools: z.string().optional(),
    roles: z.array(z.string()).optional(),
    liveUrl: z.string().url().optional(),
    relatedLinks: z.array(relatedLink).optional(),
    note: z.string().optional(),
    seoDescription: z.string().optional(),
  }),
});

export const collections = { projects };
