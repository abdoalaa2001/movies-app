import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const API_BASE = "https://en.movizlands.com/wp-json/wp/v2";
const MOVIES_CATEGORY = 79;

// عدد الأقسام اللي تحت بعض (زي ArabSeed)
const SECTIONS_COUNT = 8;

// Slider timing
const AUTO_MS = 2500;

type TaxMode = "categories" | "tags";

interface WPPost {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
  modified: string;
  _embedded?: {
    "wp:featuredmedia"?: { source_url: string }[];
  };
}

interface WPTerm {
  id: number;
  name: string;
  count?: number;
  slug?: string;
}

type Section = {
  id: number;
  title: string;
};

type SlideItem = {
  id: number;
  title: string;
  image: string;
  onPress: () => void;
};

/* =========================
   SectionSlider (Card كبير + Auto + أسهم)
========================= */
function SectionSlider({
  sectionTitle,
  leftButtonText,
  items,
  autoMs = AUTO_MS,
}: {
  sectionTitle: string;
  leftButtonText: string;
  items: SlideItem[];
  autoMs?: number;
}) {
  const listRef = useRef<FlatList<SlideItem> | null>(null);
  const [index, setIndex] = useState(0);

  const W = Dimensions.get("window").width;
  const cardW = W - 28;
  const cardH = Math.round(cardW * 0.52);

  useEffect(() => {
    setIndex(0);
    if (items.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: 0, animated: false });
      }, 50);
    }
  }, [items.length]);

  // Auto-slide
  useEffect(() => {
    if (items.length < 2) return;

    const t = setInterval(() => {
      setIndex((prev) => {
        const next = prev + 1 >= items.length ? 0 : prev + 1;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, autoMs);

    return () => clearInterval(t);
  }, [items.length, autoMs]);

  const goPrev = () => {
    if (!items.length) return;
    const prev = index - 1 < 0 ? items.length - 1 : index - 1;
    setIndex(prev);
    listRef.current?.scrollToIndex({ index: prev, animated: true });
  };

  const goNext = () => {
    if (!items.length) return;
    const next = index + 1 >= items.length ? 0 : index + 1;
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  };

  return (
    <View style={styles.sectionWrap}>
      {/* Header row */}
      <View style={styles.sectionHeader}>
        <Pressable style={styles.leftBtn}>
          <Text style={styles.leftBtnText}>↓</Text>
          <Text style={styles.leftBtnText}>{leftButtonText}</Text>
          <Text style={styles.leftBtnText}>≡</Text>
        </Pressable>

        <View style={styles.rightTitle}>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          <Text style={styles.icon}>🎬</Text>
        </View>
      </View>

      {/* Slider Card */}
      <View style={[styles.sliderCard, { width: cardW, height: cardH }]}>
        {items.length === 0 ? (
          <View style={styles.sliderEmpty}>
            <ActivityIndicator size="small" color="#b08d00" />
            <Text style={{ color: "#fff", opacity: 0.7, marginTop: 8 }}>
              لا توجد نتائج
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={(r) => {
                listRef.current = r; // ✅ مهم: callback يرجع void
              }}
              horizontal
              pagingEnabled
              data={items}
              keyExtractor={(x) => String(x.id)}
              showsHorizontalScrollIndicator={false}
              getItemLayout={(_, i) => ({
                length: cardW,
                offset: cardW * i,
                index: i,
              })}
              onMomentumScrollEnd={(e) => {
                const newIndex = Math.round(
                  e.nativeEvent.contentOffset.x / cardW,
                );
                setIndex(newIndex);
              }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={item.onPress}
                  style={{ width: cardW, height: cardH }}
                >
                  <Image
                    source={{ uri: item.image }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                  <View style={styles.fade} />
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </Pressable>
              )}
            />

            {/* Arrows */}
            <Pressable
              style={[styles.arrow, styles.arrowLeft]}
              onPress={goPrev}
            >
              <Text style={styles.arrowText}>‹</Text>
            </Pressable>

            <Pressable
              style={[styles.arrow, styles.arrowRight]}
              onPress={goNext}
            >
              <Text style={styles.arrowText}>›</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

/* =========================
   Movies Screen (ArabSeed layout)
========================= */
export default function MoviesScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<"trending" | "latest">("latest");
  const [taxMode, setTaxMode] = useState<TaxMode | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [postsBySection, setPostsBySection] = useState<
    Record<number, WPPost[]>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // لما المستخدم يغيّر ترند/مضاف حديثاً
    if (taxMode && sections.length) loadAllSections(taxMode, sections, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const init = async () => {
    setLoading(true);
    try {
      // 1) حاول Categories الأول (غالباً ده اللي ArabSeed بيستخدمه)
      const cats = await fetchTerms("categories");
      const goodCats = pickGoodTerms(cats);

      if (goodCats.length >= 3) {
        setTaxMode("categories");
        const secs = goodCats
          .slice(0, SECTIONS_COUNT)
          .map((t) => ({ id: t.id, title: t.name }));
        setSections(secs);
        await loadAllSections("categories", secs, mode);
        return;
      }

      // 2) لو categories مش نافعة → جرّب Tags
      const tags = await fetchTerms("tags");
      const goodTags = pickGoodTerms(tags);

      setTaxMode("tags");
      const secs = goodTags
        .slice(0, SECTIONS_COUNT)
        .map((t) => ({ id: t.id, title: t.name }));
      setSections(secs);
      await loadAllSections("tags", secs, mode);
    } catch (e) {
      console.log("init error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTerms = async (mode: TaxMode): Promise<WPTerm[]> => {
    const res = await axios.get(`${API_BASE}/${mode}`, {
      params: {
        per_page: 100,
        hide_empty: true,
      },
    });
    return (res.data || []) as WPTerm[];
  };

  // فلترة بسيطة عشان نطلع أقسام "حقيقية" (كورية/تركي/هندي... إلخ)
  const pickGoodTerms = (terms: WPTerm[]) => {
    return terms
      .filter((t) => t && t.name && t.id)
      .filter((t) => (t.count ?? 0) > 0)
      .filter((t) => t.id !== MOVIES_CATEGORY) // لو نفس ID يظهر
      .filter((t) => {
        const n = t.name.toLowerCase();
        return !["uncategorized", "غير مصنف"].some((x) => n.includes(x));
      })
      .slice(0, 30);
  };

  const loadAllSections = async (
    modeTax: TaxMode,
    secs: Section[],
    m: "trending" | "latest",
  ) => {
    setLoading(true);
    try {
      const results = await Promise.all(
        secs.map(async (s) => {
          const posts = await fetchPostsForSection(modeTax, s.id, m);
          return [s.id, posts] as const;
        }),
      );

      const map: Record<number, WPPost[]> = {};
      results.forEach(([id, posts]) => (map[id] = posts));
      setPostsBySection(map);
    } catch (e) {
      console.log("loadAllSections error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPostsForSection = async (
    modeTax: TaxMode,
    termId: number,
    m: "trending" | "latest",
  ) => {
    // IMPORTANT:
    // "ترند" في WP الافتراضي مفيش orderby=views
    // فبنقربها بـ modified (أحدث تفاعل/تحديث)
    const orderby = m === "latest" ? "date" : "modified";
    const order = "desc";

    const params: any = {
      per_page: 10,
      page: 1,
      _embed: true,
      orderby,
      order,
      categories: MOVIES_CATEGORY, // أفلام فقط
    };

    if (modeTax === "tags") {
      params.tags = termId;
    } else {
      // categories: لازم تضم MOVIES_CATEGORY + termId
      params.categories = `${MOVIES_CATEGORY},${termId}`;
    }

    const res = await axios.get(`${API_BASE}/posts`, { params });
    return (res.data || []) as WPPost[];
  };

  const cleanTitle = (htmlTitle: string) =>
    htmlTitle
      .replace(/<[^>]*>/g, "")
      .replace(/&#\d+;/g, "")
      .replace(/&[a-z]+;/gi, "")
      .trim();

  const getFeaturedImage = (post: WPPost) => {
    const u = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
    return (
      u || "https://via.placeholder.com/1200x700/111111/ffffff?text=No+Image"
    );
  };

  const toSliderItems = (posts: WPPost[]) => {
    return posts.map<SlideItem>((p) => ({
      id: p.id,
      title: cleanTitle(p.title?.rendered || "Untitled"),
      image: getFeaturedImage(p),
      onPress: () =>
        router.push({
          pathname: "/player",
          params: { url: p.link, title: cleanTitle(p.title.rendered) },
        } as any),
    }));
  };

  const leftBtnText = mode === "latest" ? "مضاف حديثًا" : "ترند";

  return (
    <ThemedView style={styles.container}>
      {/* Top: logo area is optional — هنا بس فلترين زي ArabSeed */}
      <View style={styles.topFilters}>
        <Pressable
          onPress={() => setMode("trending")}
          style={[
            styles.filterBtn,
            mode === "trending" && styles.filterBtnActive,
          ]}
        >
          <Text style={styles.filterText}>ترند</Text>
        </Pressable>

        <Pressable
          onPress={() => setMode("latest")}
          style={[
            styles.filterBtn,
            mode === "latest" && styles.filterBtnActive,
          ]}
        >
          <Text style={styles.filterText}>مضاف حديثًا</Text>
        </Pressable>
      </View>

      {loading && sections.length === 0 ? (
        <View style={styles.pageLoading}>
          <ActivityIndicator size="large" color="#b08d00" />
          <ThemedText style={{ marginTop: 10, color: "#fff", opacity: 0.8 }}>
            جاري التحميل...
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((s) => (
            <SectionSlider
              key={s.id}
              sectionTitle={s.title}
              leftButtonText={`احدث الأفلام`}
              items={toSliderItems(postsBySection[s.id] || [])}
              autoMs={AUTO_MS}
            />
          ))}

          {/* تحميل خفيف أثناء تغيير المود */}
          {loading ? (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#b08d00" />
              <Text style={{ color: "#fff", opacity: 0.7, marginTop: 8 }}>
                تحديث {leftBtnText}...
              </Text>
            </View>
          ) : null}

          {/* Debug صغير (اختياري) */}
          <Text style={styles.debug}>
            {taxMode ? `Filter Source: ${taxMode}` : ""}
          </Text>
        </ScrollView>
      )}
    </ThemedView>
  );
}

/* =========================
   Styles (ArabSeed vibe)
========================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0b" },

  topFilters: {
    marginTop: 46,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
  },
  filterBtnActive: {
    borderColor: "#b08d00",
    backgroundColor: "rgba(176,141,0,0.10)",
  },
  filterText: { color: "#fff", fontWeight: "900" },

  pageLoading: { flex: 1, justifyContent: "center", alignItems: "center" },

  sectionWrap: { marginTop: 14, alignItems: "center" },

  sectionHeader: {
    width: "100%",
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  leftBtn: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  leftBtnText: { color: "#b08d00", fontWeight: "800" },

  rightTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: "#b08d00", fontWeight: "900", fontSize: 20 },
  icon: { fontSize: 20 },

  sliderCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sliderEmpty: { flex: 1, justifyContent: "center", alignItems: "center" },

  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  itemTitle: {
    position: "absolute",
    right: 14,
    bottom: 14,
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    maxWidth: "75%",
    textAlign: "right",
  },

  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15,15,15,0.80)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  arrowText: { color: "#cfcfcf", fontSize: 28, fontWeight: "900" },

  debug: {
    marginTop: 16,
    textAlign: "center",
    color: "rgba(255,255,255,0.35)",
  },
});
