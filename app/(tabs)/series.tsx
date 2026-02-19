/**
 * series.tsx — Series Screen
 * PERF: Lazy loads category sections one-by-one as they resolve.
 *       Pinned "latest" + "trending" sections appear immediately.
 */

import { ThemedView } from "@/components/themed-view";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  COUNTRY_META,
  DynamicSection,
  LANG_META,
  WPPost,
  cleanTitle,
  discoverSeriesCategories,
  fetchCategories,
  fetchLatestPosts,
  fetchPage,
  fetchTrendingPosts,
  getClass,
  getThumb,
  isSeries,
  safeClassList,
} from "./apiUtils";

const W = Dimensions.get("window").width;

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

function emojiForCat(name: string): string {
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
  if (n.includes("كوميد") || n.includes("comedy")) return "😂";
  if (n.includes("رومانس") || n.includes("romance")) return "💕";
  if (n.includes("أكشن") || n.includes("action")) return "💥";
  return "📺";
}

function extractSeriesName(classList: string[]): string | null {
  const cls = classList.find(
    (c) => c.startsWith("series-") && !/^series-\d+$/.test(c),
  );
  if (!cls) return null;
  return cls
    .slice(7)
    .replace(/-+/g, " ")
    .replace(/\b\w/g, (x) => x.toUpperCase())
    .trim();
}

function PostOverlay({ post }: { post: WPPost }) {
  const countryId = getClass(post, "country");
  const langId = getClass(post, "language");
  const flag = countryId ? COUNTRY_META[countryId]?.emoji : null;
  const lbl = langId ? LANG_META[langId]?.label : null;
  const series = extractSeriesName(safeClassList(post));

  return (
    <>
      {(flag || lbl) && (
        <View style={s.pill}>
          <Text style={s.pillTxt}>
            {[flag, lbl].filter(Boolean).join("  ")}
          </Text>
        </View>
      )}
      <Text style={s.itemTitle} numberOfLines={2}>
        {cleanTitle(post.title.rendered)}
      </Text>
      {series && (
        <View style={s.seriesBadge}>
          <Text style={s.seriesTxt} numberOfLines={1}>
            {series}
          </Text>
        </View>
      )}
    </>
  );
}

function Banner({
  section,
  onPress,
}: {
  section: DynamicSection;
  onPress: (p: WPPost) => void;
}) {
  const listRef = useRef<FlatList<WPPost>>(null);
  const [idx, setIdx] = useState(0);
  const cW = W - 28;
  const cH = Math.round(cW * 0.52);
  const { posts } = section;

  useEffect(() => {
    if (posts.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => {
        const n = (i + 1) % posts.length;
        listRef.current?.scrollToIndex({ index: n, animated: true });
        return n;
      });
    }, 3500);
    return () => clearInterval(t);
  }, [posts.length]);

  const shift = (d: 1 | -1) => {
    const n = (idx + d + posts.length) % posts.length;
    setIdx(n);
    listRef.current?.scrollToIndex({ index: n, animated: true });
  };

  return (
    <View style={s.section}>
      <View style={s.hdr}>
        <Text style={s.hdrCount}>{posts.length} حلقة</Text>
        <Text style={s.hdrTitle}>
          {section.emoji} {section.label}
        </Text>
      </View>
      <View style={[s.card, { width: cW, height: cH }]}>
        <FlatList
          ref={listRef}
          horizontal
          pagingEnabled
          data={posts}
          keyExtractor={(x) => String(x.id)}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: cW, offset: cW * i, index: i })}
          onMomentumScrollEnd={(e) =>
            setIdx(Math.round(e.nativeEvent.contentOffset.x / cW))
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPress(item)}
              style={{ width: cW, height: cH }}
            >
              <Image
                source={{ uri: getThumb(item) }}
                style={s.img}
                resizeMode="cover"
              />
              <View style={s.fade} />
              <PostOverlay post={item} />
            </Pressable>
          )}
        />
        <View style={s.dots}>
          {posts.map((_: WPPost, i: number) => (
            <View key={i} style={[s.dot, i === idx && s.dotOn]} />
          ))}
        </View>
        {posts.length > 1 && (
          <>
            <Pressable style={[s.arrow, s.aL]} onPress={() => shift(-1)}>
              <Text style={s.arrowTxt}>‹</Text>
            </Pressable>
            <Pressable style={[s.arrow, s.aR]} onPress={() => shift(1)}>
              <Text style={s.arrowTxt}>›</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export default function SeriesScreen() {
  const router = useRouter();
  const [sections, setSections] = useState<DynamicSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const seenKeys = useRef<Set<string>>(new Set());

  const addSection = useCallback((sec: DynamicSection) => {
    if (seenKeys.current.has(sec.key) || sec.posts.length < 2) return;
    seenKeys.current.add(sec.key);
    setSections((prev) => [...prev, sec]);
  }, []);

  const load = useCallback(async () => {
    setError(false);
    seenKeys.current = new Set();
    setSections([]);

    try {
      // ── Step 1: fetch pinned data + categories simultaneously ──
      const [latest, trending, cats] = await Promise.all([
        fetchLatestPosts(100),
        fetchTrendingPosts(50),
        fetchCategories(),
      ]);

      discoverSeriesCategories(cats);

      const series = latest.filter(isSeries);
      const trendingSeries = trending.filter(isSeries);

      // ── Step 2: show pinned sections immediately ──
      addSection({
        key: "latest",
        label: "أحدث الحلقات",
        emoji: "🆕",
        posts: series.slice(0, 10),
      });
      addSection({
        key: "trending",
        label: "الأكثر تحديثًا",
        emoji: "🔥",
        posts: trendingSeries.slice(0, 10),
      });
      setLoading(false); // stop spinner now

      // ── Step 3: lazy load each series category as it resolves ──
      const seriesCats = cats.filter((cat) => {
        if (cat.count < 3) return false;
        const n = cat.name.toLowerCase();
        if (n.includes("uncategor") || n.includes("غير مصنف")) return false;
        return SERIES_KEYWORDS.some((kw) => n.includes(kw));
      });

      seriesCats.forEach((cat) => {
        fetchPage(1, 10, { categories: cat.id })
          .then(({ posts }) => {
            addSection({
              key: `cat-${cat.id}`,
              label: cat.name,
              emoji: emojiForCat(cat.name),
              posts,
            });
          })
          .catch(() => {});
      });
    } catch (e) {
      console.error("SeriesScreen load error:", e);
      setError(true);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, [addSection]);

  useEffect(() => {
    load();
  }, [load]);

  const navigate = (post: WPPost) =>
    router.push({
      pathname: "/player",
      params: { url: post.link, title: cleanTitle(post.title.rendered) },
    } as any);

  if (loading) {
    return (
      <ThemedView style={s.container}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#b08d00" />
          <Text style={s.loadTxt}>جاري تحميل المسلسلات...</Text>
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={s.container}>
        <View style={s.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
          <Text style={s.loadTxt}>فشل تحميل البيانات</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load}>
            <Text style={s.retryTxt}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={s.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 54 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#b08d00"
          />
        }
      >
        {sections.map((sec) => (
          <Banner key={sec.key} section={sec} onPress={navigate} />
        ))}
        {sections.length === 0 && (
          <View style={[s.center, { paddingTop: 100 }]}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>📺</Text>
            <Text style={s.loadTxt}>لا توجد مسلسلات حاليًا</Text>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0b" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadTxt: { color: "rgba(255,255,255,0.6)", marginTop: 12, fontSize: 14 },
  retryBtn: {
    marginTop: 20,
    backgroundColor: "#b08d00",
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  section: { marginTop: 22, alignItems: "center" },
  hdr: {
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hdrTitle: { color: "#b08d00", fontWeight: "900", fontSize: 18 },
  hdrCount: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
  card: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  img: { width: "100%", height: "100%" },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  itemTitle: {
    position: "absolute",
    right: 14,
    bottom: 30,
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
    maxWidth: "75%",
    textAlign: "right",
  },
  pill: {
    position: "absolute",
    left: 10,
    top: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(176,141,0,0.45)",
  },
  pillTxt: { color: "#f0d060", fontSize: 11, fontWeight: "800" },
  seriesBadge: {
    position: "absolute",
    right: 14,
    bottom: 10,
    backgroundColor: "rgba(176,141,0,0.18)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(176,141,0,0.4)",
    maxWidth: "70%",
  },
  seriesTxt: { color: "#c9a830", fontSize: 10, fontWeight: "700" },
  dots: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dotOn: { backgroundColor: "#b08d00", width: 16 },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  aL: { left: 8 },
  aR: { right: 8 },
  arrowTxt: { color: "#ddd", fontSize: 26, fontWeight: "900" },
});
