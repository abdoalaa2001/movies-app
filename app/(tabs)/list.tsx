import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

// عدد الأقسام تحت بعض (زي ArabSeed)
const SECTIONS_COUNT = 8;
// عدد العناصر في كل Card
const ITEMS_PER_SECTION = 10;
// Auto slide ms
const AUTO_MS = 2500;

interface Content {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
  modified?: string;
  _embedded?: {
    "wp:featuredmedia"?: { source_url: string }[];
  };
}

type SlideItem = {
  id: number;
  title: string;
  image: string;
  onPress: () => void;
};

/* =========================
   Slider Card (Banner واحد + Auto + أسهم)
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

  // reset when items change
  useEffect(() => {
    setIndex(0);
    if (items.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: 0, animated: false });
      }, 50);
    }
  }, [items.length]);

  // Auto slide
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
      {/* Header row زي ArabSeed */}
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
            <Text style={{ color: "#fff", opacity: 0.7 }}>لا توجد نتائج</Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={(r) => {
                listRef.current = r; // ✅ callback ref لازم يرجع void
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
   LIST SCREEN (same idea بس بالداتا الموجودة)
========================= */
export default function ListScreen() {
  const router = useRouter();

  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"latest" | "trending">("latest");

  useEffect(() => {
    loadContent();
     
  }, []);

  const loadContent = async () => {
    setLoading(true);
    try {
      // هنجيب كمية أكبر مرة واحدة عشان نقسمها Sections
      const response = await axios.get(`${API_BASE}/posts`, {
        params: {
          per_page: 80, // 8 sections * 10 items
          page: 1,
          _embed: true,
          order: "desc",
          orderby: "date",
        },
      });
      setContent(response.data || []);
    } catch (e) {
      console.log("Error:", e);
      setContent([]);
    } finally {
      setLoading(false);
    }
  };

  const cleanTitle = (htmlTitle: string): string =>
    htmlTitle
      .replace(/<[^>]*>/g, "")
      .replace(/&#\d+;/g, "")
      .replace(/&[a-z]+;/gi, "")
      .trim();

  const getFeaturedImage = (item: Content): string => {
    const u = item._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
    return (
      u || "https://via.placeholder.com/1200x700/111111/ffffff?text=No+Image"
    );
  };

  // ✅ ترند هنا "تقريب" (لو عندك views لاحقاً نبدله)
  const sortedContent = useMemo(() => {
    const arr = [...content];
    if (mode === "latest") {
      arr.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    } else {
      // trending approximation: modified desc (لو موجود)
      arr.sort(
        (a: any, b: any) =>
          new Date(b.modified || b.date).getTime() -
          new Date(a.modified || a.date).getTime(),
      );
    }
    return arr;
  }, [content, mode]);

  // ✅ تقسيم الداتا إلى 8 Sections (كل واحد 10 عناصر)
  const sections = useMemo(() => {
    const result: { title: string; items: Content[] }[] = [];
    for (let i = 0; i < SECTIONS_COUNT; i++) {
      const start = i * ITEMS_PER_SECTION;
      const end = start + ITEMS_PER_SECTION;
      const slice = sortedContent.slice(start, end);
      result.push({
        title: `قسم ${i + 1}`, // لو عايز اسماء ثابتة قولّي وهنحطها
        items: slice,
      });
    }
    return result;
  }, [sortedContent]);

  const toSliderItems = (posts: Content[]): SlideItem[] =>
    posts.map((p) => ({
      id: p.id,
      title: cleanTitle(p.title?.rendered || "Untitled"),
      image: getFeaturedImage(p),
      onPress: () =>
        router.push({
          pathname: "/player",
          params: { url: p.link, title: cleanTitle(p.title.rendered) },
        } as any),
    }));

  return (
    <ThemedView style={styles.container}>
      {/* Filters top زي ArabSeed */}
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

      {/* Loading */}
      {loading ? (
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
          {sections.map((s, idx) => (
            <SectionSlider
              key={idx}
              sectionTitle={s.title}
              leftButtonText={mode === "latest" ? "احدث" : "ترند"}
              items={toSliderItems(s.items)}
              autoMs={AUTO_MS}
            />
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

/* =========================
   Styles (same theme)
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
});
