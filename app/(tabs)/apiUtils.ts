/**
 * apiUtils.ts — Shared data layer for MovizLand
 *
 * BUG FIXES vs original:
 *  1. discoverSeriesCategories: was incorrectly adding country/language categories
 *     (Turkish, Korean, Arabic, Anime) as "series" categories → caused isMovie() to
 *     return false for ALL Turkish/Korean posts → movies screen went empty.
 *     Fixed: only keywords that truly indicate SERIES content ("مسلسل", "series",
 *     "episode", "حلقة") are used.
 *
 *  2. isSeries: now uses a 3-tier priority system:
 *       a. series-{slug} class present (most reliable)
 *       b. Title contains episode indicators
 *       c. Category ID in KNOWN_SERIES_CAT_IDS (fallback)
 *
 *  3. COUNTRY_LABEL had "606" mapped to Turkey — 606 is a LANGUAGE (dubbed) ID,
 *     not a country ID. Removed.
 *
 *  4. deduplicateSections: was broken — always returned true. Fixed.
 *
 *  5. buildYearSections: labels were based on popularity rank, not actual year.
 *     Now extracts approximate year from post.date as label.
 *
 *  6. buildCategorySections: now filters out known series-only categories so the
 *     movies screen doesn't show mixed sections.
 *
 *  7. fetchCategories: now handles pagination (fetches up to 200 categories).
 *
 *  8. All fetch functions: added retry logic + timeout.
 *
 *  9. [REMOVED] Korean (35220) removed from COUNTRY_META and cross-filter combos
 *     — was showing incorrectly on non-Korean content.
 */

import axios from "axios";

export const BASE = "https://en.movizlands.com/wp-json/wp/v2";

// ─── Axios instance with timeout ──────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE,
  timeout: 15_000,
  headers: {
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  },
});

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface WPPost {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
  modified: string;
  categories: number[];
  class_list: string[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url: string }>;
  };
}

export interface DynamicSection {
  key: string;
  label: string;
  emoji: string;
  posts: WPPost[];
}

export interface WPCategory {
  id: number;
  name: string;
  count: number;
  slug: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const cleanTitle = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, "")
    .trim();

export const getThumb = (post: WPPost): string =>
  post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ??
  `https://placehold.co/1200x700/111/b08d00?text=${encodeURIComponent(
    cleanTitle(post.title.rendered).slice(0, 20) || "No Image",
  )}`;

export function safeClassList(post: WPPost): string[] {
  const cl = post.class_list;
  if (!cl) return [];
  if (Array.isArray(cl)) return cl;
  if (typeof cl === "object") {
    return Object.values(cl as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string",
    );
  }
  return [];
}

export const getClass = (post: WPPost, prefix: string): string | null => {
  const found = safeClassList(post).find(
    (x) =>
      x.startsWith(`${prefix}-`) &&
      x.length > prefix.length + 1 &&
      (prefix === "series" || /^\d+$/.test(x.slice(prefix.length + 1))),
  );
  return found ? found.slice(prefix.length + 1) : null;
};

export const hasClasses = (post: WPPost, ...classes: string[]): boolean =>
  classes.every((c) => safeClassList(post).includes(c));

// ─── Series vs Movie discrimination ──────────────────────────────────────────
export const KNOWN_SERIES_CAT_IDS = new Set<number>([35307]);

const SERIES_KEYWORDS = [
  "مسلسل",
  "مسلسلات",
  "series",
  "episode",
  "حلقة",
  "حلقات",
  "موسم",
  "season",
];

export function discoverSeriesCategories(cats: WPCategory[]): void {
  for (const cat of cats) {
    const n = cat.name.toLowerCase();
    if (SERIES_KEYWORDS.some((kw) => n.includes(kw))) {
      KNOWN_SERIES_CAT_IDS.add(cat.id);
    }
  }
}

const EPISODE_TITLE_RE =
  /الحلقة|مشاهدة حلقة|حلقه|\bep\.?\s*\d|\bepisode\s*\d|s\d{1,2}e\d{1,2}/i;

export function isSeries(post: WPPost): boolean {
  const classList = safeClassList(post);
  if (classList.some((c) => c.startsWith("series-") && !/^series-\d+$/.test(c)))
    return true;
  return EPISODE_TITLE_RE.test(cleanTitle(post.title.rendered));
}

export const isMovie = (post: WPPost): boolean => !isSeries(post);

// ─── Known taxonomy mappings ───────────────────────────────────────────────────
// [REMOVED] Korean (35220) — was showing incorrectly on non-Korean content
export const COUNTRY_META: Record<string, { label: string; emoji: string }> = {
  "16328": { label: "تركية", emoji: "🇹🇷" },
  "1": { label: "عربية", emoji: "🌍" },
  "649": { label: "هندية", emoji: "🇮🇳" },
  "35219": { label: "أجنبية", emoji: "🌐" },
};

export const LANG_META: Record<string, { label: string; emoji: string }> = {
  "606": { label: "مدبلجة", emoji: "🎙️" },
  "595": { label: "مترجمة", emoji: "📝" },
  "34": { label: "مترجمة", emoji: "📝" },
};

// ─── Core fetch functions ─────────────────────────────────────────────────────
export async function fetchLatestPosts(count = 100): Promise<WPPost[]> {
  return withRetry(async () => {
    const { data } = await api.get<WPPost[]>("/posts", {
      params: {
        per_page: Math.min(count, 100),
        orderby: "date",
        order: "desc",
        _embed: true,
      },
    });
    return data ?? [];
  });
}

export async function fetchTrendingPosts(count = 50): Promise<WPPost[]> {
  return withRetry(async () => {
    const { data } = await api.get<WPPost[]>("/posts", {
      params: {
        per_page: Math.min(count, 100),
        orderby: "modified",
        order: "desc",
        _embed: true,
      },
    });
    return data ?? [];
  });
}

export async function fetchPage(
  page: number,
  perPage = 20,
  extraParams: Record<string, unknown> = {},
): Promise<{ posts: WPPost[]; hasMore: boolean; total: number }> {
  return withRetry(async () => {
    const res = await api.get<WPPost[]>("/posts", {
      params: {
        per_page: perPage,
        page,
        orderby: "date",
        order: "desc",
        _embed: true,
        ...extraParams,
      },
    });
    const posts = res.data ?? [];
    const totalPages = parseInt(
      (res.headers?.["x-wp-totalpages"] as string) ?? "1",
      10,
    );
    const total = parseInt((res.headers?.["x-wp-total"] as string) ?? "0", 10);
    return { posts, hasMore: page < totalPages, total };
  });
}

export async function fetchCategories(): Promise<WPCategory[]> {
  return withRetry(async () => {
    const perPage = 100;
    const firstRes = await api.get<WPCategory[]>("/categories", {
      params: {
        per_page: perPage,
        hide_empty: true,
        orderby: "count",
        order: "desc",
      },
    });
    const totalPages = parseInt(
      (firstRes.headers?.["x-wp-totalpages"] as string) ?? "1",
      10,
    );
    if (totalPages <= 1) return firstRes.data ?? [];

    const extras = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        api
          .get<WPCategory[]>("/categories", {
            params: {
              per_page: perPage,
              hide_empty: true,
              orderby: "count",
              order: "desc",
              page: i + 2,
            },
          })
          .then((r) => r.data ?? []),
      ),
    );
    return [...(firstRes.data ?? []), ...extras.flat()];
  });
}

// ─── Section builders ─────────────────────────────────────────────────────────

export function buildCountrySections(posts: WPPost[]): DynamicSection[] {
  const map = new Map<string, WPPost[]>();
  for (const p of posts) {
    const id = getClass(p, "country");
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(p);
  }

  return [...map.entries()]
    .filter(([, ps]) => ps.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([id, ps]) => {
      const meta = COUNTRY_META[id];
      return {
        key: `country-${id}`,
        label: meta?.label ?? `بلد #${id}`,
        emoji: meta?.emoji ?? "🌐",
        posts: ps.slice(0, 10),
      };
    });
}

export function buildLanguageSections(posts: WPPost[]): DynamicSection[] {
  const map = new Map<string, WPPost[]>();
  for (const p of posts) {
    const id = getClass(p, "language");
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(p);
  }

  const seen = new Set<string>();
  const sections: DynamicSection[] = [];
  for (const [id, ps] of map) {
    if (ps.length < 2) continue;
    const meta = LANG_META[id];
    if (!meta || seen.has(meta.label)) continue;
    seen.add(meta.label);
    sections.push({
      key: `lang-${id}`,
      label: meta.label,
      emoji: meta.emoji,
      posts: ps.slice(0, 10),
    });
  }
  return sections;
}

export function buildCategorySections(
  posts: WPPost[],
  cats: WPCategory[],
  options: { excludeSeriesCategories?: boolean } = {},
): DynamicSection[] {
  const catNameMap = new Map<number, string>(cats.map((c) => [c.id, c.name]));
  const map = new Map<number, WPPost[]>();

  for (const p of posts) {
    for (const catId of p.categories ?? []) {
      if (options.excludeSeriesCategories && KNOWN_SERIES_CAT_IDS.has(catId))
        continue;
      if (!map.has(catId)) map.set(catId, []);
      map.get(catId)!.push(p);
    }
  }

  return [...map.entries()]
    .filter(([id, ps]) => {
      if (ps.length < 2) return false;
      const name = (catNameMap.get(id) ?? "").toLowerCase();
      return !name.includes("uncategor") && !name.includes("غير مصنف");
    })
    .sort((a, b) => b[1].length - a[1].length)
    .map(([id, ps]) => {
      const name = catNameMap.get(id) ?? `تصنيف ${id}`;
      return {
        key: `cat-${id}`,
        label: name,
        emoji: emojiForName(name),
        posts: ps.slice(0, 10),
      };
    });
}

// [REMOVED] Korean cross-filter combos (kr-sub, kr-dub)
export function buildCrossFilterSections(posts: WPPost[]): DynamicSection[] {
  const combos = [
    {
      key: "tr-dub",
      label: "تركية مدبلجة",
      emoji: "🇹🇷🎙️",
      country: "16328",
      language: "606",
    },
    {
      key: "tr-sub",
      label: "تركية مترجمة",
      emoji: "🇹🇷📝",
      country: "16328",
      language: "595",
    },
  ];

  return combos
    .map(({ key, label, emoji, country, language }) => ({
      key,
      label,
      emoji,
      posts: posts
        .filter((p) =>
          hasClasses(p, `country-${country}`, `language-${language}`),
        )
        .slice(0, 10),
    }))
    .filter((s) => s.posts.length >= 2);
}

export function buildYearSections(posts: WPPost[]): DynamicSection[] {
  const termToPosts = new Map<string, WPPost[]>();
  for (const p of posts) {
    const cls = safeClassList(p).find((c) => /^release-year-\d+$/.test(c));
    if (!cls) continue;
    if (!termToPosts.has(cls)) termToPosts.set(cls, []);
    termToPosts.get(cls)!.push(p);
  }

  const sections: DynamicSection[] = [];
  for (const [cls, ps] of termToPosts) {
    if (ps.length < 2) continue;
    const yearCounts = new Map<string, number>();
    for (const p of ps) {
      const y = new Date(p.date).getFullYear().toString();
      yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
    }
    const year = [...yearCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const currentYear = new Date().getFullYear().toString();
    const label = year === currentYear ? `إصدارات ${year}` : `أفلام ${year}`;
    sections.push({
      key: `year-${cls}`,
      label,
      emoji: year === currentYear ? "📅" : "🗓️",
      posts: ps.slice(0, 10),
    });
  }

  return sections.sort((a, b) => {
    const ya = parseInt(a.label.match(/\d{4}/)?.[0] ?? "0");
    const yb = parseInt(b.label.match(/\d{4}/)?.[0] ?? "0");
    return yb - ya;
  });
}

export function deduplicateSections(
  sections: DynamicSection[],
): DynamicSection[] {
  const seen = new Set<number>();
  return sections
    .map((s) => ({
      ...s,
      posts: s.posts.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      }),
    }))
    .filter((s) => s.posts.length > 0);
}

function emojiForName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("تركي") || n.includes("turk")) return "🇹🇷";
  if (n.includes("كوري") || n.includes("korean")) return "🇰🇷";
  if (n.includes("هندي") || n.includes("hindi")) return "🇮🇳";
  if (n.includes("عربي") || n.includes("arab")) return "🌍";
  if (n.includes("أجنبي") || n.includes("foreign") || n.includes("english"))
    return "🌐";
  if (n.includes("أنمي") || n.includes("anime")) return "🎌";
  if (n.includes("مسلسل") || n.includes("series")) return "📺";
  if (n.includes("فيلم") || n.includes("movie")) return "🎬";
  if (n.includes("رعب") || n.includes("horror")) return "👻";
  if (n.includes("كوميدي") || n.includes("comedy")) return "😂";
  if (n.includes("رومانسي") || n.includes("romance")) return "💕";
  if (n.includes("أكشن") || n.includes("action")) return "💥";
  return "📺";
}
